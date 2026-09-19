import crypto from 'node:crypto';

export const CANDIDATE_PUBLISH_REQUEST_SCHEMA = 'bar.candidate-publication-request.v1';
export const CANDIDATE_PUBLISH_RECEIPT_SCHEMA = 'bar.candidate-publication-receipt.v1';

const ALLOWED_ACTIONS = new Set(['candidate_branch_create', 'candidate_pr_create']);
const CANDIDATE_BRANCH_PREFIX = 'bar-candidate/';
const SHA40 = /^[a-f0-9]{40}$/i;
const SHA64 = /^[a-f0-9]{64}$/i;
const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const ACTION = /^[a-z][a-z0-9_:-]{0,63}$/;
const BRANCH = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/;

const nonEmpty = value => typeof value === 'string' && value.trim().length > 0;
const sha40 = value => typeof value === 'string' && SHA40.test(value);
const sha64 = value => typeof value === 'string' && SHA64.test(value);
const iso = value => typeof value === 'string' && Number.isFinite(Date.parse(value));

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}

export function hashCandidatePublishValue(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function requestCore(request) {
  const { requestHash, ...core } = request;
  return core;
}

function receiptCore(receipt) {
  const { receiptHash, ...core } = receipt;
  return core;
}

function normalizeActions(values) {
  if (!Array.isArray(values) || values.length === 0) throw new Error('CANDIDATE_PUBLISH_ACTIONS_REQUIRED');
  const normalized = [...new Set(values.map(value => {
    if (typeof value !== 'string' || value !== value.trim() || value !== value.toLowerCase() || !ACTION.test(value)) {
      throw new Error('CANDIDATE_PUBLISH_ACTION_INVALID');
    }
    if (!ALLOWED_ACTIONS.has(value)) throw new Error('CANDIDATE_PUBLISH_ACTION_NOT_ALLOWED:' + value);
    return value;
  }))].sort();
  if (normalized.includes('candidate_pr_create') && !normalized.includes('candidate_branch_create')) {
    throw new Error('CANDIDATE_PR_REQUIRES_BRANCH_CREATE');
  }
  return normalized;
}

function assertBranchName(value) {
  if (!nonEmpty(value) || !BRANCH.test(value)) throw new Error('CANDIDATE_BRANCH_INVALID');
  if (value.includes('..') || value.includes('@{') || value.includes('//') || value.endsWith('/') || value.endsWith('.lock')) {
    throw new Error('CANDIDATE_BRANCH_INVALID');
  }
  if (!value.startsWith(CANDIDATE_BRANCH_PREFIX)) throw new Error('CANDIDATE_BRANCH_PREFIX_REQUIRED');
  return value;
}

function normalizeLease(lease) {
  if (!lease || !Number.isSafeInteger(lease.generation) || lease.generation < 0 || !sha64(lease.fencingTokenHash)) {
    throw new Error('CANDIDATE_PUBLISH_LEASE_INVALID');
  }
  return {
    generation: lease.generation,
    fencingTokenHash: lease.fencingTokenHash.toLowerCase()
  };
}

function normalizeRepository(repository) {
  if (!repository || !REPO.test(String(repository.nameWithOwner ?? '')) || !sha64(repository.remoteFingerprint)) {
    throw new Error('CANDIDATE_PUBLISH_REPOSITORY_INVALID');
  }
  return {
    nameWithOwner: repository.nameWithOwner,
    remoteFingerprint: repository.remoteFingerprint.toLowerCase()
  };
}

export function createCandidatePublicationRequest({
  operationId,
  repository,
  baseBranch,
  baseHead,
  candidateSha,
  treeHash,
  evidenceHash,
  candidateBranch,
  actions = ['candidate_branch_create', 'candidate_pr_create'],
  providerId,
  worker,
  lease,
  maxLifetimeSeconds = 600,
  now = new Date()
} = {}) {
  if (!nonEmpty(operationId) || operationId.length > 128) throw new Error('CANDIDATE_PUBLISH_OPERATION_ID_INVALID');
  const normalizedRepository = normalizeRepository(repository);
  if (!nonEmpty(baseBranch) || baseBranch.length > 200) throw new Error('CANDIDATE_PUBLISH_BASE_BRANCH_INVALID');
  if (!sha40(baseHead) || !sha40(candidateSha) || !sha40(treeHash) || !sha64(evidenceHash)) {
    throw new Error('CANDIDATE_PUBLISH_BINDING_INVALID');
  }
  const branch = assertBranchName(candidateBranch);
  if (branch === baseBranch) throw new Error('CANDIDATE_DEFAULT_BRANCH_WRITE_FORBIDDEN');
  if (!nonEmpty(providerId)) throw new Error('CANDIDATE_PUBLISH_PROVIDER_REQUIRED');
  if (!worker || !nonEmpty(worker.identity) || !nonEmpty(worker.role) || !sha64(worker.capabilitiesHash)) {
    throw new Error('CANDIDATE_PUBLISH_WORKER_INVALID');
  }
  if (!Number.isInteger(maxLifetimeSeconds) || maxLifetimeSeconds < 1 || maxLifetimeSeconds > 3600) {
    throw new Error('CANDIDATE_PUBLISH_LIFETIME_INVALID');
  }
  const normalizedActions = normalizeActions(actions);
  const normalizedLease = normalizeLease(lease);
  const createdAt = now.toISOString();
  const core = {
    schemaVersion: CANDIDATE_PUBLISH_REQUEST_SCHEMA,
    operationId,
    createdAt,
    expiresAt: new Date(now.getTime() + maxLifetimeSeconds * 1000).toISOString(),
    repository: normalizedRepository,
    repositoryIdentityHash: hashCandidatePublishValue(normalizedRepository),
    baseBranch,
    baseHead: baseHead.toLowerCase(),
    candidateSha: candidateSha.toLowerCase(),
    treeHash: treeHash.toLowerCase(),
    evidenceHash: evidenceHash.toLowerCase(),
    candidateBranch: branch,
    actions: normalizedActions,
    providerId,
    worker: {
      identity: worker.identity,
      role: worker.role,
      capabilitiesHash: worker.capabilitiesHash.toLowerCase()
    },
    lease: normalizedLease,
    forcePushAllowed: false,
    defaultBranchWriteAllowed: false,
    mergeAllowed: false,
    autoMergeAllowed: false,
    deployAllowed: false,
    releaseAllowed: false,
    productivePublishAllowed: false,
    credentialMaterialIncluded: false
  };
  return deepFreeze({ ...core, requestHash: hashCandidatePublishValue(core) });
}

export function validateCandidatePublicationRequest(request, now = new Date()) {
  if (!request || request.schemaVersion !== CANDIDATE_PUBLISH_REQUEST_SCHEMA || !sha64(request.requestHash)) {
    throw new Error('CANDIDATE_PUBLISH_REQUEST_SCHEMA_INVALID');
  }
  if (request.requestHash !== hashCandidatePublishValue(requestCore(request))) throw new Error('CANDIDATE_PUBLISH_REQUEST_HASH_MISMATCH');
  if (!nonEmpty(request.operationId) || !iso(request.createdAt) || !iso(request.expiresAt)) throw new Error('CANDIDATE_PUBLISH_REQUEST_ENVELOPE_INVALID');
  if (Date.parse(request.expiresAt) <= Date.parse(request.createdAt) || Date.parse(request.expiresAt) <= now.getTime()) {
    throw new Error('CANDIDATE_PUBLISH_REQUEST_EXPIRED');
  }
  const repository = normalizeRepository(request.repository);
  if (request.repositoryIdentityHash !== hashCandidatePublishValue(repository)) throw new Error('CANDIDATE_PUBLISH_REPOSITORY_HASH_MISMATCH');
  if (!nonEmpty(request.baseBranch) || !sha40(request.baseHead) || !sha40(request.candidateSha) || !sha40(request.treeHash) || !sha64(request.evidenceHash)) {
    throw new Error('CANDIDATE_PUBLISH_BINDING_INVALID');
  }
  assertBranchName(request.candidateBranch);
  if (request.candidateBranch === request.baseBranch) throw new Error('CANDIDATE_DEFAULT_BRANCH_WRITE_FORBIDDEN');
  normalizeActions(request.actions);
  normalizeLease(request.lease);
  if (!request.worker || !nonEmpty(request.worker.identity) || !nonEmpty(request.worker.role) || !sha64(request.worker.capabilitiesHash)) {
    throw new Error('CANDIDATE_PUBLISH_WORKER_INVALID');
  }
  if (!nonEmpty(request.providerId)) throw new Error('CANDIDATE_PUBLISH_PROVIDER_REQUIRED');
  const forbiddenTrue = [
    'forcePushAllowed',
    'defaultBranchWriteAllowed',
    'mergeAllowed',
    'autoMergeAllowed',
    'deployAllowed',
    'releaseAllowed',
    'productivePublishAllowed',
    'credentialMaterialIncluded'
  ];
  for (const key of forbiddenTrue) if (request[key] !== false) throw new Error('CANDIDATE_PUBLISH_BOUNDARY_WIDENED:' + key);
  return true;
}

export function createCandidatePublicationReceipt({
  request,
  providerId,
  providerRunId,
  observedBaseHead,
  remoteBranchRef,
  remoteCandidateSha,
  remoteTreeHash,
  pullRequestNumber = null,
  status = 'PASS',
  protectedEffectsAttempted = false,
  now = new Date()
} = {}) {
  validateCandidatePublicationRequest(request, now);
  if (!nonEmpty(providerId) || providerId !== request.providerId || !nonEmpty(providerRunId)) {
    throw new Error('CANDIDATE_PUBLISH_PROVIDER_MISMATCH');
  }
  if (!['PASS', 'FAIL', 'CANCELLED'].includes(status)) throw new Error('CANDIDATE_PUBLISH_RECEIPT_STATUS_INVALID');
  if (!sha40(observedBaseHead)) throw new Error('CANDIDATE_PUBLISH_BASE_HEAD_INVALID');
  if (status === 'PASS' && (!nonEmpty(remoteBranchRef) || !sha40(remoteCandidateSha) || !sha40(remoteTreeHash))) {
    throw new Error('CANDIDATE_PUBLISH_REMOTE_BINDING_REQUIRED');
  }
  if (request.actions.includes('candidate_pr_create') && status === 'PASS' && (!Number.isInteger(pullRequestNumber) || pullRequestNumber < 1)) {
    throw new Error('CANDIDATE_PUBLISH_PR_REQUIRED');
  }
  if (protectedEffectsAttempted !== false) throw new Error('CANDIDATE_PUBLISH_PROTECTED_EFFECT_ATTEMPTED');

  const core = {
    schemaVersion: CANDIDATE_PUBLISH_RECEIPT_SCHEMA,
    requestHash: request.requestHash,
    operationId: request.operationId,
    providerId,
    providerRunId,
    status,
    repositoryIdentityHash: request.repositoryIdentityHash,
    baseBranch: request.baseBranch,
    observedBaseHead: observedBaseHead.toLowerCase(),
    candidateBranch: request.candidateBranch,
    remoteBranchRef: remoteBranchRef ?? null,
    remoteCandidateSha: remoteCandidateSha?.toLowerCase() ?? null,
    remoteTreeHash: remoteTreeHash?.toLowerCase() ?? null,
    evidenceHash: request.evidenceHash,
    pullRequestNumber,
    worker: { ...request.worker },
    lease: { ...request.lease },
    forcePushAttempted: false,
    defaultBranchWriteAttempted: false,
    mergeAttempted: false,
    autoMergeAttempted: false,
    deployAttempted: false,
    releaseAttempted: false,
    productivePublishAttempted: false,
    credentialMaterialIncluded: false,
    collectedAt: now.toISOString()
  };
  return Object.freeze({ ...core, receiptHash: hashCandidatePublishValue(core) });
}

function assertLedger(ledger) {
  if (!ledger || !(ledger.operations instanceof Map) || !(ledger.branches instanceof Map)) {
    throw new Error('CANDIDATE_PUBLISH_LEDGER_REQUIRED');
  }
}

export function verifyCandidatePublicationReceipt({
  request,
  receipt,
  currentLease,
  currentBaseHead,
  ledger,
  now = new Date()
} = {}) {
  validateCandidatePublicationRequest(request, now);
  assertLedger(ledger);
  if (!receipt || receipt.schemaVersion !== CANDIDATE_PUBLISH_RECEIPT_SCHEMA || !sha64(receipt.receiptHash)) {
    throw new Error('CANDIDATE_PUBLISH_RECEIPT_SCHEMA_INVALID');
  }
  if (receipt.receiptHash !== hashCandidatePublishValue(receiptCore(receipt))) throw new Error('CANDIDATE_PUBLISH_RECEIPT_HASH_MISMATCH');
  if (receipt.requestHash !== request.requestHash || receipt.operationId !== request.operationId || receipt.providerId !== request.providerId) {
    throw new Error('CANDIDATE_PUBLISH_RECEIPT_REQUEST_MISMATCH');
  }
  if (receipt.repositoryIdentityHash !== request.repositoryIdentityHash || receipt.baseBranch !== request.baseBranch || receipt.candidateBranch !== request.candidateBranch) {
    throw new Error('CANDIDATE_PUBLISH_RECEIPT_TARGET_MISMATCH');
  }
  if (!sha40(currentBaseHead) || currentBaseHead.toLowerCase() !== request.baseHead) throw new Error('CANDIDATE_PUBLISH_BASE_HEAD_DRIFT');
  if (receipt.observedBaseHead !== request.baseHead) throw new Error('CANDIDATE_PUBLISH_OBSERVED_BASE_DRIFT');
  if (!currentLease || currentLease.generation !== request.lease.generation || currentLease.fencingTokenHash !== request.lease.fencingTokenHash) {
    throw new Error('CANDIDATE_PUBLISH_STALE_LEASE_OR_FENCE');
  }
  if (receipt.lease.generation !== request.lease.generation || receipt.lease.fencingTokenHash !== request.lease.fencingTokenHash) {
    throw new Error('CANDIDATE_PUBLISH_RECEIPT_LEASE_MISMATCH');
  }
  if (hashCandidatePublishValue(receipt.worker) !== hashCandidatePublishValue(request.worker)) throw new Error('CANDIDATE_PUBLISH_WORKER_MISMATCH');

  const forbiddenAttempted = [
    'forcePushAttempted',
    'defaultBranchWriteAttempted',
    'mergeAttempted',
    'autoMergeAttempted',
    'deployAttempted',
    'releaseAttempted',
    'productivePublishAttempted',
    'credentialMaterialIncluded'
  ];
  for (const key of forbiddenAttempted) if (receipt[key] !== false) throw new Error('CANDIDATE_PUBLISH_PROTECTED_EFFECT_ATTEMPTED:' + key);

  if (receipt.status !== 'PASS') throw new Error('CANDIDATE_PUBLISH_RECEIPT_NOT_PASS');
  if (receipt.remoteBranchRef !== `refs/heads/${request.candidateBranch}`) throw new Error('CANDIDATE_PUBLISH_REMOTE_BRANCH_MISMATCH');
  if (receipt.remoteCandidateSha !== request.candidateSha || receipt.remoteTreeHash !== request.treeHash || receipt.evidenceHash !== request.evidenceHash) {
    throw new Error('CANDIDATE_PUBLISH_CANDIDATE_DRIFT');
  }
  if (request.actions.includes('candidate_pr_create') && (!Number.isInteger(receipt.pullRequestNumber) || receipt.pullRequestNumber < 1)) {
    throw new Error('CANDIDATE_PUBLISH_PR_REQUIRED');
  }

  const branchKey = `${request.repositoryIdentityHash}:${request.candidateBranch}`;
  const candidateBinding = hashCandidatePublishValue({
    baseHead: request.baseHead,
    candidateSha: request.candidateSha,
    treeHash: request.treeHash,
    evidenceHash: request.evidenceHash
  });
  const existingBranch = ledger.branches.get(branchKey);
  if (existingBranch && existingBranch !== candidateBinding) throw new Error('CANDIDATE_PUBLISH_BRANCH_COLLISION');

  const existingOperation = ledger.operations.get(request.requestHash);
  if (existingOperation) {
    if (existingOperation !== receipt.receiptHash) throw new Error('CANDIDATE_PUBLISH_REPLAY_MISMATCH');
    return Object.freeze({ status: 'PASS', idempotentReplay: true });
  }

  ledger.branches.set(branchKey, candidateBinding);
  ledger.operations.set(request.requestHash, receipt.receiptHash);
  return Object.freeze({ status: 'PASS', idempotentReplay: false });
}

export function createCandidatePublicationLedger() {
  return {
    operations: new Map(),
    branches: new Map()
  };
}

export function assertCandidatePublisher(provider) {
  if (!provider || !nonEmpty(provider.id)) throw new Error('CANDIDATE_PUBLISHER_ID_REQUIRED');
  for (const method of ['prepare', 'publish', 'collect', 'cancel']) {
    if (typeof provider[method] !== 'function') throw new Error('CANDIDATE_PUBLISHER_METHOD_REQUIRED:' + method);
  }
  if (provider.protectedEffectsAllowed !== false || provider.mergeAllowed !== false || provider.forcePushAllowed !== false) {
    throw new Error('CANDIDATE_PUBLISHER_AUTHORITY_INVALID');
  }
  return true;
}
