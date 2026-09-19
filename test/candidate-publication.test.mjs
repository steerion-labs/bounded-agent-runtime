import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCandidatePublicationLedger,
  createCandidatePublicationRequest,
  createCandidatePublicationReceipt,
  hashCandidatePublishValue,
  validateCandidatePublicationRequest,
  verifyCandidatePublicationReceipt
} from '../runtime/remote/candidate-publication.mjs';
import { createReferenceCandidatePublisher } from '../runtime/remote/reference-candidate-publisher.mjs';

const base='a'.repeat(40), candidate='b'.repeat(40), tree='c'.repeat(40);
const evidence='d'.repeat(64), fence='e'.repeat(64), remoteFingerprint='f'.repeat(64);

function fixture(overrides = {}) {
  const lease={generation:7,fencingTokenHash:fence};
  const request=createCandidatePublicationRequest({
    operationId:'op-1',
    repository:{nameWithOwner:'org/repo',remoteFingerprint},
    baseBranch:'main',
    baseHead:base,
    candidateSha:candidate,
    treeHash:tree,
    evidenceHash:evidence,
    candidateBranch:'bar-candidate/op-1-bbbbbbbb',
    providerId:'synthetic-candidate-publisher',
    worker:{identity:'worker:builder-1',role:'publisher',capabilitiesHash:'1'.repeat(64)},
    lease,
    ...overrides
  });
  return {lease,request};
}

test('candidate publication request is exact-state bound and deeply immutable',()=>{
  const {request}=fixture();
  assert.equal(validateCandidatePublicationRequest(request),true);
  assert.match(request.requestHash,/^[a-f0-9]{64}$/);
  assert.equal(Object.isFrozen(request),true);
  assert.equal(Object.isFrozen(request.repository),true);
  assert.equal(Object.isFrozen(request.worker),true);
  assert.equal(request.mergeAllowed,false);
  assert.equal(request.forcePushAllowed,false);
});

test('default branch, arbitrary branch and protected action attempts fail closed',()=>{
  assert.throws(()=>fixture({candidateBranch:'main'}),/CANDIDATE_BRANCH_PREFIX_REQUIRED|CANDIDATE_DEFAULT_BRANCH_WRITE_FORBIDDEN/);
  assert.throws(()=>fixture({candidateBranch:'feature/free-form'}),/CANDIDATE_BRANCH_PREFIX_REQUIRED/);
  assert.throws(()=>fixture({actions:['candidate_branch_create','merge']}),/CANDIDATE_PUBLISH_ACTION_NOT_ALLOWED/);
});

test('request mutation in transit is rejected',()=>{
  const {request}=fixture();
  const wire=JSON.parse(JSON.stringify(request));
  wire.candidateBranch='bar-candidate/attacker';
  assert.throws(()=>validateCandidatePublicationRequest(wire),/CANDIDATE_PUBLISH_REQUEST_HASH_MISMATCH/);
});

test('synthetic publisher returns candidate-bound receipt and cannot merge',()=>{
  const {request}=fixture();
  const provider=createReferenceCandidatePublisher({GITHUB_RUN_ID:'123'});
  const prepared=provider.prepare(request);
  const run=provider.publish(prepared);
  const receipt=provider.collect(run,{request,pullRequestNumber:42});
  assert.equal(provider.mergeAllowed,false);
  assert.equal(provider.forcePushAllowed,false);
  assert.equal(receipt.remoteCandidateSha,candidate);
  assert.equal(receipt.remoteTreeHash,tree);
  assert.equal(receipt.pullRequestNumber,42);
  assert.equal(receipt.mergeAttempted,false);
});

test('verification rejects base drift, stale fence and candidate drift',()=>{
  const {lease,request}=fixture();
  const receipt=createCandidatePublicationReceipt({
    request,providerId:request.providerId,providerRunId:'run-1',
    observedBaseHead:base,
    remoteBranchRef:`refs/heads/${request.candidateBranch}`,
    remoteCandidateSha:candidate,remoteTreeHash:tree,pullRequestNumber:7
  });
  assert.throws(()=>verifyCandidatePublicationReceipt({
    request,receipt,currentLease:lease,currentBaseHead:'9'.repeat(40),ledger:createCandidatePublicationLedger()
  }),/CANDIDATE_PUBLISH_BASE_HEAD_DRIFT/);
  assert.throws(()=>verifyCandidatePublicationReceipt({
    request,receipt,currentLease:{...lease,generation:8},currentBaseHead:base,ledger:createCandidatePublicationLedger()
  }),/CANDIDATE_PUBLISH_STALE_LEASE_OR_FENCE/);
  const tampered={...receipt,remoteCandidateSha:'8'.repeat(40)};
  assert.throws(()=>verifyCandidatePublicationReceipt({
    request,receipt:tampered,currentLease:lease,currentBaseHead:base,ledger:createCandidatePublicationLedger()
  }),/CANDIDATE_PUBLISH_RECEIPT_HASH_MISMATCH|CANDIDATE_PUBLISH_CANDIDATE_DRIFT/);
});

test('exact replay is idempotent but branch collision with another candidate fails',()=>{
  const {lease,request}=fixture();
  const receipt=createCandidatePublicationReceipt({
    request,providerId:request.providerId,providerRunId:'run-2',
    observedBaseHead:base,
    remoteBranchRef:`refs/heads/${request.candidateBranch}`,
    remoteCandidateSha:candidate,remoteTreeHash:tree,pullRequestNumber:8
  });
  const ledger=createCandidatePublicationLedger();
  const first=verifyCandidatePublicationReceipt({request,receipt,currentLease:lease,currentBaseHead:base,ledger});
  const second=verifyCandidatePublicationReceipt({request,receipt,currentLease:lease,currentBaseHead:base,ledger});
  assert.equal(first.idempotentReplay,false);
  assert.equal(second.idempotentReplay,true);

  const other=createCandidatePublicationRequest({
    operationId:'op-2',
    repository:{nameWithOwner:'org/repo',remoteFingerprint},
    baseBranch:'main',baseHead:base,candidateSha:'7'.repeat(40),treeHash:'6'.repeat(40),
    evidenceHash:'5'.repeat(64),candidateBranch:request.candidateBranch,
    providerId:'synthetic-candidate-publisher',
    worker:{identity:'worker:builder-2',role:'publisher',capabilitiesHash:'2'.repeat(64)},
    lease
  });
  const otherReceipt=createCandidatePublicationReceipt({
    request:other,providerId:other.providerId,providerRunId:'run-3',
    observedBaseHead:base,remoteBranchRef:`refs/heads/${other.candidateBranch}`,
    remoteCandidateSha:other.candidateSha,remoteTreeHash:other.treeHash,pullRequestNumber:9
  });
  assert.throws(()=>verifyCandidatePublicationReceipt({
    request:other,receipt:otherReceipt,currentLease:lease,currentBaseHead:base,ledger
  }),/CANDIDATE_PUBLISH_BRANCH_COLLISION/);
});

test('credential material is not part of request or receipt schemas',()=>{
  const {request}=fixture();
  const receipt=createCandidatePublicationReceipt({
    request,providerId:request.providerId,providerRunId:'run-4',
    observedBaseHead:base,remoteBranchRef:`refs/heads/${request.candidateBranch}`,
    remoteCandidateSha:candidate,remoteTreeHash:tree,pullRequestNumber:10
  });
  const serialized=JSON.stringify({request,receipt});
  assert.doesNotMatch(serialized,/authorization|password|private.?key|api.?key|secret-token/i);
  assert.equal(request.credentialMaterialIncluded,false);
  assert.equal(receipt.credentialMaterialIncluded,false);
});

test('worker comparison is canonical rather than object-key-order sensitive',()=>{
  const {lease,request}=fixture();
  const receipt=createCandidatePublicationReceipt({
    request,providerId:request.providerId,providerRunId:'run-5',
    observedBaseHead:base,remoteBranchRef:`refs/heads/${request.candidateBranch}`,
    remoteCandidateSha:candidate,remoteTreeHash:tree,pullRequestNumber:11
  });
  const reordered={...receipt,worker:{
    capabilitiesHash:receipt.worker.capabilitiesHash,
    role:receipt.worker.role,
    identity:receipt.worker.identity
  }};
  const core={...reordered}; delete core.receiptHash;
  reordered.receiptHash=hashCandidatePublishValue(core);
  const result=verifyCandidatePublicationReceipt({
    request,receipt:reordered,currentLease:lease,currentBaseHead:base,ledger:createCandidatePublicationLedger()
  });
  assert.equal(result.status,'PASS');
});
