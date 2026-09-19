import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  createCandidatePublicationLedger,
  createCandidatePublicationRequest,
  hashCandidatePublishValue,
  verifyCandidatePublicationReceipt
} from '../runtime/remote/candidate-publication.mjs';
import { createReferenceCandidatePublisher } from '../runtime/remote/reference-candidate-publisher.mjs';

const args=process.argv.slice(2);
const outIndex=args.indexOf('--out');
if(outIndex<0 || !args[outIndex+1]) throw new Error('CANDIDATE_PUBLISH_PROOF_OUT_REQUIRED');
const out=path.resolve(args[outIndex+1]);

const sourceHead=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const treeHash=execFileSync('git',['rev-parse','HEAD^{tree}'],{encoding:'utf8'}).trim();
const runId=String(process.env.GITHUB_RUN_ID || 'local-synthetic-candidate-publish');
const generation=Math.max(1,Number.parseInt(process.env.GITHUB_RUN_ATTEMPT || '1',10) || 1);
const lease={generation,fencingTokenHash:hashCandidatePublishValue({runId,generation,sourceHead})};

const request=createCandidatePublicationRequest({
  operationId:'bar-public-candidate-publish-reference',
  repository:{
    nameWithOwner:'steerion-labs/bounded-agent-runtime',
    remoteFingerprint:hashCandidatePublishValue('https://github.com/steerion-labs/bounded-agent-runtime.git')
  },
  baseBranch:'main',
  baseHead:sourceHead,
  candidateSha:sourceHead,
  treeHash,
  evidenceHash:hashCandidatePublishValue({sourceHead,treeHash,proof:'synthetic-reference'}),
  candidateBranch:`bar-candidate/reference-${sourceHead.slice(0,8)}`,
  providerId:'synthetic-candidate-publisher',
  worker:{
    identity:`synthetic-publisher:${runId}`,
    role:'publisher',
    capabilitiesHash:hashCandidatePublishValue(['candidate-only','no-network-mutation','no-merge'])
  },
  lease
});

const provider=createReferenceCandidatePublisher();
const prepared=provider.prepare(request);
const run=provider.publish(prepared);
const receipt=provider.collect(run,{request,pullRequestNumber:1});
const ledger=createCandidatePublicationLedger();
const verified=verifyCandidatePublicationReceipt({
  request,receipt,currentLease:lease,currentBaseHead:sourceHead,ledger
});
const replay=verifyCandidatePublicationReceipt({
  request,receipt,currentLease:lease,currentBaseHead:sourceHead,ledger
});

let baseDriftRejected=false, branchCollisionRejected=false, protectedActionRejected=false;
try {
  verifyCandidatePublicationReceipt({
    request,receipt,currentLease:lease,currentBaseHead:'0'.repeat(40),ledger:createCandidatePublicationLedger()
  });
} catch(error) {
  baseDriftRejected=/CANDIDATE_PUBLISH_BASE_HEAD_DRIFT/.test(String(error.message));
}
try {
  createCandidatePublicationRequest({
    operationId:'bad-protected-action',
    repository:request.repository,
    baseBranch:'main',
    baseHead:sourceHead,
    candidateSha:sourceHead,
    treeHash,
    evidenceHash:request.evidenceHash,
    candidateBranch:'bar-candidate/bad-action',
    actions:['candidate_branch_create','merge'],
    providerId:request.providerId,
    worker:request.worker,
    lease
  });
} catch(error) {
  protectedActionRejected=/CANDIDATE_PUBLISH_ACTION_NOT_ALLOWED/.test(String(error.message));
}
try {
  const other=createCandidatePublicationRequest({
    operationId:'collision',
    repository:request.repository,
    baseBranch:'main',
    baseHead:sourceHead,
    candidateSha:'1'.repeat(40),
    treeHash:'2'.repeat(40),
    evidenceHash:'3'.repeat(64),
    candidateBranch:request.candidateBranch,
    providerId:request.providerId,
    worker:request.worker,
    lease
  });
  const otherRun=provider.publish(provider.prepare(other));
  const otherReceipt=provider.collect(otherRun,{request:other,pullRequestNumber:2});
  verifyCandidatePublicationReceipt({
    request:other,receipt:otherReceipt,currentLease:lease,currentBaseHead:sourceHead,ledger
  });
} catch(error) {
  branchCollisionRejected=/CANDIDATE_PUBLISH_BRANCH_COLLISION/.test(String(error.message));
}

const status=
  verified.status==='PASS' &&
  replay.idempotentReplay===true &&
  baseDriftRejected &&
  branchCollisionRejected &&
  protectedActionRejected
    ? 'PASS'
    : 'FAIL';

const evidence={
  schemaVersion:'bar.candidate-publication-proof.v1',
  status,
  sourceHead,
  treeHash,
  requestHash:request.requestHash,
  receiptHash:receipt.receiptHash,
  provider:provider.id,
  runId,
  exactHeadBound:true,
  repositoryPermissions:'contents:read',
  secretsRequired:false,
  credentialMaterialIncluded:false,
  actualRemoteMutationPerformed:false,
  candidateBranchCreated:false,
  pullRequestCreated:false,
  mergeAttempted:false,
  deployAttempted:false,
  releaseAttempted:false,
  idempotentReplayVerified:replay.idempotentReplay===true,
  baseDriftRejected,
  branchCollisionRejected,
  protectedActionRejected
};

fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify(evidence,null,2)+'\n');
console.log('BAR_CANDIDATE_PUBLICATION_PROOF='+status);
if(status!=='PASS') process.exit(1);
