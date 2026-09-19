import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRemoteDispatch, createRemoteResult, hashRemoteValue, validateRemoteDispatch, verifyRemoteResult } from '../runtime/remote/contracts.mjs';
import { createGithubHostedReferenceProvider } from '../runtime/remote/reference-provider.mjs';

const workflow=fs.readFileSync('.github/workflows/remote-execution-reference.yml','utf8');
const doc=fs.readFileSync('docs/25-REMOTE-EXECUTION.md','utf8');
const script=fs.readFileSync('scripts/remote-execution-proof.mjs','utf8');
const head='a'.repeat(40), tree='b'.repeat(40);
function fixture(expectedCandidate=null){
  const lease={generation:7,fencingTokenHash:'c'.repeat(64)};
  const dispatch=createRemoteDispatch({
    taskId:'remote-test',providerId:'test',taskHash:'d'.repeat(64),sourceHead:head,
    authority:{remoteActions:['build_local','verify'],protectedActions:['merge'],protectedEffectsAllowed:false},
    worker:{identity:'worker:test',role:'builder',capabilitiesHash:'e'.repeat(64)},
    lease,expectedCandidate
  });
  return {lease,dispatch};
}

test('reference remote execution is exact-head, read-only and credentialless',()=>{
  assert.match(workflow,/BAR_SOURCE_HEAD/);
  assert.match(workflow,/ref: \$\{\{ env\.BAR_SOURCE_HEAD \}\}/);
  assert.match(workflow,/permissions:\s*\n\s*contents: read/);
  assert.match(workflow,/persist-credentials: false/);
  assert.doesNotMatch(workflow,/secrets\./);
  assert.match(script,/privateProjectDataInBarSource:false/);
  assert.match(script,/protectedRemoteMutationAttempted:false/);
});
test('remote dispatch binds authority, worker and fence',()=>{
  const {dispatch}=fixture();
  assert.equal(validateRemoteDispatch(dispatch),true);
  assert.equal(dispatch.sourceHead,head);
  assert.equal(dispatch.authority.remoteActions.includes('merge'),false);
  assert.equal(dispatch.worker.identity,'worker:test');
  assert.equal(dispatch.lease.generation,7);
  assert.equal(dispatch.protectedEffectsAllowed,false);
});
test('remote protected authority widening is rejected',()=>{
  assert.throws(()=>createRemoteDispatch({
    taskId:'remote-test',providerId:'test',taskHash:'d'.repeat(64),sourceHead:head,
    authority:{remoteActions:['merge'],protectedActions:['merge'],protectedEffectsAllowed:false},
    worker:{identity:'worker:test',role:'builder',capabilitiesHash:'e'.repeat(64)},
    lease:{generation:1,fencingTokenHash:'f'.repeat(64)}
  }),/REMOTE_PROTECTED_ACTION_NOT_ALLOWED/);
});
test('result is bound to dispatch, candidate, evidence and current fence',()=>{
  const {lease,dispatch}=fixture({candidateSha:head,treeHash:tree});
  const result=createRemoteResult({dispatch,providerId:'test',providerRunId:'run-1',candidateSha:head,treeHash:tree,evidence:[{status:'PASS',digest:hashRemoteValue('ok')}]});
  assert.equal(verifyRemoteResult({dispatch,result,currentLease:lease,consumedResultHashes:new Set()}),true);
  assert.throws(()=>verifyRemoteResult({dispatch,result,currentLease:{...lease,generation:8},consumedResultHashes:new Set()}),/REMOTE_STALE_LEASE_OR_FENCE/);
  assert.throws(()=>verifyRemoteResult({dispatch,result:{...result,evidence:[{status:'FAIL'}]},currentLease:lease,consumedResultHashes:new Set()}),/REMOTE_RESULT_HASH_MISMATCH|REMOTE_RESULT_EVIDENCE_MISMATCH/);
});
test('candidate drift and result replay fail closed',()=>{
  const {lease,dispatch}=fixture({candidateSha:head,treeHash:tree});
  const drift='9'.repeat(40);
  const result=createRemoteResult({dispatch,providerId:'test',providerRunId:'run-2',candidateSha:drift,treeHash:tree,evidence:[{status:'PASS'}]});
  assert.throws(()=>verifyRemoteResult({dispatch,result,currentLease:lease,consumedResultHashes:new Set()}),/REMOTE_CANDIDATE_DRIFT/);
  const good=createRemoteResult({dispatch,providerId:'test',providerRunId:'run-3',candidateSha:head,treeHash:tree,evidence:[{status:'PASS'}]});
  const consumed=new Set();
  assert.equal(verifyRemoteResult({dispatch,result:good,currentLease:lease,consumedResultHashes:consumed}),true);
  assert.throws(()=>verifyRemoteResult({dispatch,result:good,currentLease:lease,consumedResultHashes:consumed}),/REMOTE_RESULT_REPLAY/);
});
test('provider contract is transport-neutral and cannot become authority',()=>{
  const provider=createGithubHostedReferenceProvider({GITHUB_RUN_ID:'123'});
  assert.equal(provider.protectedEffectsAllowed,false);
  for(const method of ['prepare','execute','collect','cancel']) assert.equal(typeof provider[method],'function');
  assert.match(doc,/provider is compute, never an authority source/i);
  assert.match(doc,/Remote workers cannot approve protected actions/i);
  assert.match(doc,/lease and fencing checks remain mandatory/i);
});

test('remote action aliases and missing replay ledger fail closed',()=>{
  assert.throws(()=>createRemoteDispatch({
    taskId:'remote-test',providerId:'test',taskHash:'d'.repeat(64),sourceHead:head,
    authority:{remoteActions:['Merge'],protectedActions:['merge'],protectedEffectsAllowed:false},
    worker:{identity:'worker:test',role:'builder',capabilitiesHash:'e'.repeat(64)},
    lease:{generation:1,fencingTokenHash:'f'.repeat(64)}
  }),/REMOTE_ACTION_INVALID/);
  const {lease,dispatch}=fixture({candidateSha:head,treeHash:tree});
  const result=createRemoteResult({dispatch,providerId:'test',providerRunId:'run-ledger',candidateSha:head,treeHash:tree,evidence:[{status:'PASS'}]});
  assert.throws(()=>verifyRemoteResult({dispatch,result,currentLease:lease}),/REMOTE_REPLAY_LEDGER_REQUIRED/);
});
