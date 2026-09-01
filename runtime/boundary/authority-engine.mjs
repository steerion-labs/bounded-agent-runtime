import { isValidBoundaryVerificationEvidence, assertBoundaryEvidenceState } from './evidence-contract.mjs';
export const AUTHORITY_DECISIONS = Object.freeze({ ALLOW_LOCAL: 'ALLOW_LOCAL', HUMAN_GATE_REQUIRED: 'HUMAN_GATE_REQUIRED', DENY: 'DENY' });

function deny(reason) { return Object.freeze({ decision: AUTHORITY_DECISIONS.DENY, reason }); }

export function decideBoundaryAuthority({ task, registry, capability_id, action, role, evidence = [], controller_state = null }) {
  if (!task || !registry || !capability_id) return deny('MISSING_CONTEXT');
  const capability = registry.get(capability_id);
  if (!capability) return deny('CAPABILITY_UNKNOWN');
  if (!Array.isArray(task.allowed_capabilities) || !task.allowed_capabilities.includes(capability.id)) return deny('CAPABILITY_NOT_ALLOWED');
  if (!capability.roles.includes(role)) return deny('ROLE_NOT_ALLOWED');
  if (!capability.actions.includes(action)) return deny('ACTION_NOT_IN_CAPABILITY');
  if (!Array.isArray(task.allowed_actions) || !task.allowed_actions.includes(action)) return deny('ACTION_NOT_ALLOWED');
  if (!task.data_class || !capability.data_classes.includes(task.data_class)) return deny('DATA_CLASS_NOT_ALLOWED');
  let verification = false;
  if (capability.verification_required) {
    try { assertBoundaryEvidenceState(task, controller_state); } catch { return deny('VERIFICATION_STATE_REQUIRED'); }
    verification = evidence.some(item => isValidBoundaryVerificationEvidence({ item, state: controller_state, capability_id: capability.id, action, role }));
    if (!verification) return deny('VERIFICATION_REQUIRED');
  }
  const protectedAction = Array.isArray(task.protected_actions) && task.protected_actions.includes(action);
  if (capability.human_gate_required || protectedAction) return Object.freeze({ decision: AUTHORITY_DECISIONS.HUMAN_GATE_REQUIRED, reason: capability.human_gate_required ? 'CAPABILITY_REQUIRES_HUMAN_GATE' : 'PROTECTED_ACTION' });
  return Object.freeze({ decision: AUTHORITY_DECISIONS.ALLOW_LOCAL, reason: 'POLICY_ALLOWED' });
}
