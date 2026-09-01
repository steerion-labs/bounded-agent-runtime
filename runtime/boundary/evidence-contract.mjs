import { evidence as barEvidence, verifyEvidence, sha256 } from '../core.mjs';

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
function canonicalTask(task) {
  const normalized = { ...task };
  for (const key of ['allowed_capabilities','allowed_actions','protected_actions']) {
    if (Array.isArray(normalized[key])) normalized[key] = [...normalized[key]].sort();
  }
  return canonical(normalized);
}


function verificationPayload({ state, capability_id, action, role }) {
  if (!state?.task_id || !state?.task) throw new Error('BOUNDARY_EVIDENCE_STATE_REQUIRED');
  if (!state.candidate_sha || !state.tree_hash) throw new Error('BOUNDARY_EVIDENCE_CANDIDATE_REQUIRED');
  return {
    task_id: state.task_id,
    capability_id,
    action,
    role,
    data_class: state.task.data_class,
    candidate_sha: state.candidate_sha ?? null,
    tree_hash: state.tree_hash ?? null,
    passed: true
  };
}

export function createBoundaryVerificationEvidence({ state, capability_id, action, role }) {
  const payload = verificationPayload({ state, capability_id, action, role });
  return barEvidence('boundary_verification', payload, state, 'controller', 'CONTROLLER_VERIFIED');
}
export function isValidBoundaryVerificationEvidence({ item, state, capability_id, action, role }) {
  try {
    if (!item || item.claim !== 'boundary_verification') return false;
    if (item.producer_identity !== 'controller') return false;
    if (item.trust_class !== 'CONTROLLER_VERIFIED' || item.status !== 'VALID') return false;
    verifyEvidence(item, state);
    const expected = verificationPayload({ state, capability_id, action, role });
    return item.payload_hash === sha256(JSON.stringify(expected));
  } catch {
    return false;
  }
}

export function assertBoundaryEvidenceState(task, state) {
  if (!state?.task_id || state.task_id !== task?.task_id) throw new Error('BOUNDARY_EVIDENCE_TASK_MISMATCH');
  if (!state.candidate_sha || !state.tree_hash) throw new Error('BOUNDARY_EVIDENCE_CANDIDATE_REQUIRED');
  if (sha256(canonicalTask(state.task)) !== sha256(canonicalTask(task))) throw new Error('BOUNDARY_EVIDENCE_TASK_MISMATCH');
  return true;
}
