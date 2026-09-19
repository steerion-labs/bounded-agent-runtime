import crypto from 'node:crypto';

export const REMOTE_TASK_SCHEMA = 'bar.remote-task.v1';
export const REMOTE_RESULT_SCHEMA = 'bar.remote-result.v1';

const PROTECTED_REMOTE_ACTIONS = new Set([
  'merge','deploy','release','publish','remote_mutation','live_trading',
  'credential_escalation','authority_expansion','irreversible_productive_mutation'
]);

const nonEmpty = value => typeof value === 'string' && value.trim().length > 0;
const sha40 = value => typeof value === 'string' && /^[a-f0-9]{40}$/i.test(value);
const sha64 = value => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
const iso = value => typeof value === 'string' && Number.isFinite(Date.parse(value));

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}
export function hashRemoteValue(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}
function uniqueSorted(values = []) {
  if (!Array.isArray(values)) throw new Error('REMOTE_AUTHORITY_ARRAY_REQUIRED');
  return [...new Set(values.map(String))].sort();
}
function normalizeAuthority(authority = {}) {
  const remoteActions = uniqueSorted(authority.remoteActions);
  const protectedActions = uniqueSorted(authority.protectedActions);
  if (authority.protectedEffectsAllowed !== false) throw new Error('REMOTE_PROTECTED_EFFECTS_MUST_BE_FALSE');
  for (const action of remoteActions) {
    if (!nonEmpty(action)) throw new Error('REMOTE_ACTION_INVALID');
    if (protectedActions.includes(action) || PROTECTED_REMOTE_ACTIONS.has(action)) throw new Error('REMOTE_PROTECTED_ACTION_NOT_ALLOWED:' + action);
  }
  return { remoteActions, protectedActions, protectedEffectsAllowed: false };
}
export function createRemoteDispatch({
  taskId, taskHash, sourceHead, authority, worker, lease,
  maxLifetimeSeconds = 600, networkPolicy = 'DENY_BY_DEFAULT',
  isolation = 'EPHEMERAL', expectedCandidate = null, now = new Date()
}) {
  if (!nonEmpty(taskId) || !sha64(taskHash) || !sha40(sourceHead)) throw new Error('REMOTE_TASK_BINDING_INVALID');
  const normalizedAuthority = normalizeAuthority(authority);
  if (!worker || !nonEmpty(worker.identity) || !nonEmpty(worker.role) || !sha64(worker.capabilitiesHash)) throw new Error('REMOTE_WORKER_BINDING_INVALID');
  if (!lease || !Number.isSafeInteger(lease.generation) || lease.generation < 0 || !sha64(lease.fencingTokenHash)) throw new Error('REMOTE_LEASE_BINDING_INVALID');
  if (!Number.isInteger(maxLifetimeSeconds) || maxLifetimeSeconds < 1 || maxLifetimeSeconds > 3600) throw new Error('REMOTE_LIFETIME_INVALID');
  if (!['DENY_BY_DEFAULT','DECLARED_EGRESS'].includes(networkPolicy)) throw new Error('REMOTE_NETWORK_POLICY_INVALID');
  if (!nonEmpty(isolation)) throw new Error('REMOTE_ISOLATION_REQUIRED');
  if (expectedCandidate && (!sha40(expectedCandidate.candidateSha) || !sha40(expectedCandidate.treeHash))) throw new Error('REMOTE_EXPECTED_CANDIDATE_INVALID');
  const createdAt = now.toISOString();
  const dispatch = {
    schemaVersion: REMOTE_TASK_SCHEMA,
    dispatchId: crypto.randomUUID(),
    createdAt,
    expiresAt: new Date(now.getTime() + maxLifetimeSeconds * 1000).toISOString(),
    taskId,
    taskHash: taskHash.toLowerCase(),
    sourceHead: sourceHead.toLowerCase(),
    authority: normalizedAuthority,
    authorityHash: hashRemoteValue(normalizedAuthority),
    worker: { identity: worker.identity, role: worker.role, capabilitiesHash: worker.capabilitiesHash.toLowerCase() },
    lease: { generation: lease.generation, fencingTokenHash: lease.fencingTokenHash.toLowerCase() },
    expectedCandidate: expectedCandidate ? {
      candidateSha: expectedCandidate.candidateSha.toLowerCase(),
      treeHash: expectedCandidate.treeHash.toLowerCase()
    } : null,
    isolation,
    networkPolicy,
    privateProjectDataInBarSource: false,
    protectedEffectsAllowed: false
  };
  return Object.freeze(dispatch);
}
export function validateRemoteDispatch(dispatch, now = new Date()) {
  if (!dispatch || dispatch.schemaVersion !== REMOTE_TASK_SCHEMA) throw new Error('REMOTE_TASK_SCHEMA_INVALID');
  if (!nonEmpty(dispatch.dispatchId) || !iso(dispatch.createdAt) || !iso(dispatch.expiresAt)) throw new Error('REMOTE_TASK_ENVELOPE_INVALID');
  if (Date.parse(dispatch.expiresAt) <= Date.parse(dispatch.createdAt) || Date.parse(dispatch.expiresAt) <= now.getTime()) throw new Error('REMOTE_TASK_EXPIRED');
  if (!nonEmpty(dispatch.taskId) || !sha64(dispatch.taskHash) || !sha40(dispatch.sourceHead)) throw new Error('REMOTE_TASK_BINDING_INVALID');
  const authority = normalizeAuthority(dispatch.authority);
  if (dispatch.authorityHash !== hashRemoteValue(authority)) throw new Error('REMOTE_AUTHORITY_HASH_MISMATCH');
  if (!dispatch.worker || !nonEmpty(dispatch.worker.identity) || !nonEmpty(dispatch.worker.role) || !sha64(dispatch.worker.capabilitiesHash)) throw new Error('REMOTE_WORKER_BINDING_INVALID');
  if (!dispatch.lease || !Number.isSafeInteger(dispatch.lease.generation) || !sha64(dispatch.lease.fencingTokenHash)) throw new Error('REMOTE_LEASE_BINDING_INVALID');
  if (dispatch.expectedCandidate && (!sha40(dispatch.expectedCandidate.candidateSha) || !sha40(dispatch.expectedCandidate.treeHash))) throw new Error('REMOTE_EXPECTED_CANDIDATE_INVALID');
  if (dispatch.privateProjectDataInBarSource !== false || dispatch.protectedEffectsAllowed !== false) throw new Error('REMOTE_BOUNDARY_WIDENED');
  return true;
}
function resultCore(result) {
  const { resultHash, ...core } = result;
  return core;
}
export function createRemoteResult({ dispatch, providerId, providerRunId, status = 'PASS', candidateSha, treeHash, evidence = [], protectedEffectsAttempted = false, now = new Date() }) {
  validateRemoteDispatch(dispatch, now);
  if (!nonEmpty(providerId) || !nonEmpty(providerRunId)) throw new Error('REMOTE_PROVIDER_IDENTITY_REQUIRED');
  if (!['PASS','FAIL','CANCELLED'].includes(status)) throw new Error('REMOTE_RESULT_STATUS_INVALID');
  if (status === 'PASS' && (!sha40(candidateSha) || !sha40(treeHash))) throw new Error('REMOTE_RESULT_CANDIDATE_REQUIRED');
  if (!Array.isArray(evidence) || evidence.length === 0) throw new Error('REMOTE_RESULT_EVIDENCE_REQUIRED');
  if (protectedEffectsAttempted !== false) throw new Error('REMOTE_PROTECTED_EFFECT_ATTEMPTED');
  const core = {
    schemaVersion: REMOTE_RESULT_SCHEMA,
    dispatchHash: hashRemoteValue(dispatch),
    providerId,
    providerRunId,
    status,
    taskId: dispatch.taskId,
    sourceHead: dispatch.sourceHead,
    authorityHash: dispatch.authorityHash,
    worker: { ...dispatch.worker },
    lease: { ...dispatch.lease },
    candidateSha: candidateSha?.toLowerCase() ?? null,
    treeHash: treeHash?.toLowerCase() ?? null,
    evidence,
    evidenceHash: hashRemoteValue(evidence),
    protectedEffectsAttempted: false,
    collectedAt: now.toISOString()
  };
  return Object.freeze({ ...core, resultHash: hashRemoteValue(core) });
}
export function verifyRemoteResult({ dispatch, result, currentLease, consumedResultHashes = null, now = new Date() }) {
  validateRemoteDispatch(dispatch, now);
  if (!result || result.schemaVersion !== REMOTE_RESULT_SCHEMA || !sha64(result.resultHash)) throw new Error('REMOTE_RESULT_SCHEMA_INVALID');
  if (result.resultHash !== hashRemoteValue(resultCore(result))) throw new Error('REMOTE_RESULT_HASH_MISMATCH');
  if (result.dispatchHash !== hashRemoteValue(dispatch) || result.taskId !== dispatch.taskId || result.sourceHead !== dispatch.sourceHead) throw new Error('REMOTE_RESULT_DISPATCH_MISMATCH');
  if (result.authorityHash !== dispatch.authorityHash) throw new Error('REMOTE_RESULT_AUTHORITY_MISMATCH');
  if (JSON.stringify(result.worker) !== JSON.stringify(dispatch.worker)) throw new Error('REMOTE_RESULT_WORKER_MISMATCH');
  if (!currentLease || currentLease.generation !== dispatch.lease.generation || currentLease.fencingTokenHash !== dispatch.lease.fencingTokenHash) throw new Error('REMOTE_STALE_LEASE_OR_FENCE');
  if (result.lease.generation !== currentLease.generation || result.lease.fencingTokenHash !== currentLease.fencingTokenHash) throw new Error('REMOTE_RESULT_LEASE_MISMATCH');
  if (result.protectedEffectsAttempted !== false) throw new Error('REMOTE_PROTECTED_EFFECT_ATTEMPTED');
  if (!Array.isArray(result.evidence) || result.evidence.length === 0 || result.evidenceHash !== hashRemoteValue(result.evidence)) throw new Error('REMOTE_RESULT_EVIDENCE_MISMATCH');
  if (result.status !== 'PASS' || !sha40(result.candidateSha) || !sha40(result.treeHash)) throw new Error('REMOTE_RESULT_NOT_PASS');
  if (dispatch.expectedCandidate && (result.candidateSha !== dispatch.expectedCandidate.candidateSha || result.treeHash !== dispatch.expectedCandidate.treeHash)) throw new Error('REMOTE_CANDIDATE_DRIFT');
  if (consumedResultHashes) {
    if (consumedResultHashes.has(result.resultHash)) throw new Error('REMOTE_RESULT_REPLAY');
    consumedResultHashes.add(result.resultHash);
  }
  return true;
}
export function assertRemoteProvider(provider) {
  if (!provider || !nonEmpty(provider.id)) throw new Error('REMOTE_PROVIDER_ID_REQUIRED');
  for (const method of ['prepare','execute','collect','cancel']) if (typeof provider[method] !== 'function') throw new Error('REMOTE_PROVIDER_METHOD_REQUIRED:' + method);
  if (provider.protectedEffectsAllowed !== false) throw new Error('REMOTE_PROVIDER_AUTHORITY_INVALID');
  if (!nonEmpty(provider.isolation) || !nonEmpty(provider.networkPolicy) || !Number.isInteger(provider.maxLifetimeSeconds)) throw new Error('REMOTE_PROVIDER_CAPABILITIES_INVALID');
  return true;
}
