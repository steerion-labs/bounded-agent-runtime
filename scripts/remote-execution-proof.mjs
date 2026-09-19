import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const args=process.argv.slice(2);
const outIndex=args.indexOf('--out');
if(outIndex<0 || !args[outIndex+1]) throw new Error('REMOTE_PROOF_OUT_REQUIRED');
const out=path.resolve(args[outIndex+1]);
const sourceHead=process.env.GITHUB_SHA || null;
const runId=process.env.GITHUB_RUN_ID || null;
const result=spawnSync(process.execPath,['scripts/durability-proof.mjs','--out',path.join(path.dirname(out),'durability.json')],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
const proof={
  schemaVersion:'bar.remote-execution-proof.v1',
  status:result.status===0?'PASS':'FAIL',
  provider:'github-hosted-runner',
  ephemeral:true,
  sourceHead,
  runId,
  repositoryPermissions:'contents:read',
  checkoutCredentialsPersisted:false,
  secretsRequired:false,
  privateProjectDataRequired:false,
  protectedRemoteMutationAttempted:false,
  humanGateAuthorityRemote:false,
  durabilityProofExitCode:result.status
};
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify(proof,null,2)+'\n');
if(result.stdout) process.stdout.write(result.stdout);
if(result.stderr) process.stderr.write(result.stderr);
console.log('BAR_REMOTE_EXECUTION_PROOF='+proof.status);
if(result.status!==0) process.exit(result.status ?? 1);
