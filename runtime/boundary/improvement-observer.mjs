import crypto from 'node:crypto';

const SIGNAL_TYPES = new Set(['user_correction','repeated_failure','successful_pattern','capability_gap']);

function proposalId(signal) {
  const stable = JSON.stringify({ type: signal.type, task_id: signal.task_id || null, capability_id: signal.capability_id || null, summary: signal.summary || '' });
  return crypto.createHash('sha256').update(stable).digest('hex').slice(0, 16);
}

export function observeImprovementSignals(signals) {
  if (!Array.isArray(signals)) throw new Error('BOUNDARY_OBSERVER_SIGNALS_INVALID');
  return signals.map(signal => {
    if (!signal || !SIGNAL_TYPES.has(signal.type) || typeof signal.summary !== 'string' || !signal.summary.trim()) {
      throw new Error('BOUNDARY_OBSERVER_SIGNAL_INVALID');
    }
    return Object.freeze({
      proposal_id: proposalId(signal),
      type: signal.type,
      task_id: signal.task_id || null,
      capability_id: signal.capability_id || null,
      summary: signal.summary.trim(),
      status: 'PROPOSED',
      auto_mutation_allowed: false,
      required_flow: Object.freeze(['INTAKE','SECURITY_REVIEW','TEST','INDEPENDENT_REVIEW','PROMOTION_GATE'])
    });
  });
}