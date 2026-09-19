import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { createGithubHostedReferenceProvider } from '../runtime/remote/reference-provider.mjs';
import { createRemoteDispatch, hashRemoteValue, validateRemoteDispatch, verifyRemoteResult } from '../runtime/remote/contracts.mjs';

const args=process.argv.slice(2);
const outIndex=args.indexOf('--out');
if(outIndex<0 || !args[outIndex+1]) throw new Error('REMOTE_PROOF_OUT_REQUIRED');
const out=path.resolve(args[outIndex+1]);
const actualHead=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const sourceHead=process.env.BAR_SOURCE_HEAD || actualHead;
if(!/^[a-f0-9]{40}$/i.test(sourceHead) || actualHead!==sourceHead) throw new Error('REMOTE_EXACT_HEAD_BINDING_FAILED');
const treeHash=execFileSync('git',['rev-parse','HEAD^{tree}'],{encoding:'utf8'}).trim();
const runId=String(process.env.GITHUB_RUN_ID || 'local-reference-proof');
const generation=Math.max(1,Number.parseInt(process.env.GITHUB_RUN_ATTEMPT || '1',10) || 1);
const durabilityPath=path.join(path.dirname(out),'durability.json');
const result=spawnSync(process.execPath,['scripts/durability-proof.mjs','--out',durabilityPath],{encoding:'utf8',stdio:['ignore','pipe','pipe']});

let protocolPass=false,replayRejected=false,staleFenceRejected=false,evidenceDriftRejected=false,authorityWideningRejected=false;
let remoteResult=null,dispatch=null;
try {
  const lease={generation,fencingTokenHash:hashRemoteValue({runId,generation,sourceHead})};
  dispatch=createRemoteDispatch({
    taskId:'bar-public-remote-reference',
    providerId:'github-hosted-runner',
    taskHash:hashRemoteValue({fixture:'public-reference-proof',sourceHead}),
    sourceHead,
    authority:{remoteActions:['build_local','review','verify'],protectedActions:['deploy','merge','release'],protectedEffectsAllowed:false},
    worker:{identity:`github-hosted-runner:${runId}`,role:'verification',capabilitiesHash:hashRemoteValue(['ephemeral','linux','node22','read-only-checkout'])},
    lease,
    maxLifetimeSeconds:600,
    networkPolicy:'DECLARED_EGRESS',
    isolation:'EPHEMERAL_GITHUB_HOSTED_RUNNER',
    expectedCandidate:{candidateSha:sourceHead,treeHash}
  });
  const provider=createGithubHostedReferenceProvider();
  const prepared=provider.prepare(dispatch);
  const run=provider.execute(prepared);
  const durability=fs.existsSync(durabilityPath)?JSON.parse(fs.readFileSync(durabilityPath,'utf8')):{status:'FAIL'};
  remoteResult=provider.collect(run,{dispatch,candidateSha:sourceHead,treeHash,evidence:[{type:'durability-proof',status:durability.status,digest:hashRemoteValue(durability)}]});
  const consumed=new Set();
  protocolPass=verifyRemoteResult({dispatch,result:remoteResult,currentLease:lease,consumedResultHashes:consumed});
  try { verifyRemoteResult({dispatch,result:remoteResult,currentLease:lease,consumedResultHashes:consumed}); } catch (error) { replayRejected=/REMOTE_RESULT_REPLAY/.test(String(error.message)); }
  try { verifyRemoteResult({dispatch,result:remoteResult,currentLease:{...lease,generation:lease.generation+1},consumedResultHashes:new Set()}); } catch (error) { staleFenceRejected=/REMOTE_STALE_LEASE_OR_FENCE/.test(String(error.message)); }
  try {
    const tampered={...remoteResult,evidence:[...remoteResult.evidence,{type:'tamper'}]};
    verifyRemoteResult({dispatch,result:tampered,currentLease:lease,consumedResultHashes:new Set()});
  } catch (error) { evidenceDriftRejected=/REMOTE_RESULT_HASH_MISMATCH|REMOTE_RESULT_EVIDENCE_MISMATCH/.test(String(error.message)); }
  try {
    validateRemoteDispatch({...dispatch,authority:{...dispatch.authority,remoteActions:[...dispatch.authority.remoteActions,'merge']}});
  } catch (error) { authorityWideningRejected=/REMOTE_PROTECTED_ACTION_NOT_ALLOWED|REMOTE_AUTHORITY_HASH_MISMATCH/.test(String(error.message)); }
} catch (error) {
  if(result.status===0) process.stderr.write(String(error.stack||error)+'\n');
}
const status=result.status===0&&protocolPass&&replayRejected&&staleFenceRejected&&evidenceDriftRejected&&authorityWideningRejected?'PASS':'FAIL';
const proof={
  schemaVersion:'bar.remote-execution-proof.v1',
  status,
  provider:'github-hosted-runner',
  ephemeral:true,
  sourceHead,
  actualHead,
  exactHeadBound:sourceHead===actualHead,
  candidateSha:remoteResult?.candidateSha||null,
  treeHash:remoteResult?.treeHash||null,
  dispatchHash:dispatch?hashRemoteValue(dispatch):null,
  resultHash:remoteResult?.resultHash||null,
  runId,
  repositoryPermissions:'contents:read',
  checkoutCredentialsPersisted:false,
  secretsRequired:false,
  privateProjectDataRequired:false,
  privateProjectDataInBarSource:false,
  protectedRemoteMutationAttempted:false,
  humanGateAuthorityRemote:false,
  protocolPass,
  replayRejected,
  staleFenceRejected,
  evidenceDriftRejected,
  authorityWideningRejected,
  durabilityProofExitCode:result.status
};
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify(proof,null,2)+'\n');
if(result.stdout) process.stdout.write(result.stdout);
if(result.stderr) process.stderr.write(result.stderr);
console.log('BAR_REMOTE_EXECUTION_PROOF='+proof.status);
if(status!=='PASS') process.exit(1);
