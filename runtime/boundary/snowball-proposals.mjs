import crypto from 'node:crypto';

const TYPES = new Set(['user_correction','repeated_failure','successful_pattern','capability_gap']);
const FORBIDDEN_EFFECTS = Object.freeze(['self_modify','policy_write','skill_install','agent_install','schedule_create','credential_access','network_expand','auto_promote']);

function stableId(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
}

function normalize(signal) {
  if (!signal || !TYPES.has(signal.type) || typeof signal.summary !== 'string' || !signal.summary.trim()) throw new Error('SNOWBALL_SIGNAL_INVALID');
  return {
    type: signal.type,
    task_id: signal.task_id || null,
    capability_id: signal.capability_id || null,
    summary: signal.summary.trim(),
    evidence_refs: Array.isArray(signal.evidence_refs) ? [...new Set(signal.evidence_refs.map(String))].slice(0, 50) : []
  };
}

export function createSnowballProposals(signals, { minimum_occurrences = 2 } = {}) {
  if (!Array.isArray(signals)) throw new Error('SNOWBALL_SIGNALS_INVALID');
  if (!Number.isSafeInteger(minimum_occurrences) || minimum_occurrences < 1 || minimum_occurrences > 20) throw new Error('SNOWBALL_THRESHOLD_INVALID');
  const groups = new Map();
  for (const raw of signals) {
    const signal = normalize(raw);
    const key = JSON.stringify([signal.type, signal.capability_id, signal.summary.toLowerCase()]);
    const row = groups.get(key) || { signal, count: 0, task_ids: new Set(), evidence_refs: new Set() };
    row.count += 1;
    if (signal.task_id) row.task_ids.add(signal.task_id);
    for (const ref of signal.evidence_refs) row.evidence_refs.add(ref);
    groups.set(key, row);
  }
  return [...groups.values()]
    .filter(row => row.count >= minimum_occurrences || row.signal.type === 'capability_gap' || row.signal.type === 'user_correction')
    .map(row => Object.freeze({
      proposal_id: stableId({ type: row.signal.type, capability_id: row.signal.capability_id, summary: row.signal.summary }),
      source: 'prime-agent-snowball-observation',
      type: row.signal.type,
      capability_id: row.signal.capability_id,
      summary: row.signal.summary,
      occurrences: row.count,
      task_ids: Object.freeze([...row.task_ids].sort()),
      evidence_refs: Object.freeze([...row.evidence_refs].sort()),
      status: 'PROPOSED',
      authority: 'NONE',
      auto_mutation_allowed: false,
      forbidden_effects: FORBIDDEN_EFFECTS,
      required_flow: Object.freeze(['INTAKE','SECURITY_REVIEW','SANDBOX_TEST','INDEPENDENT_REVIEW','HUMAN_PROMOTION_GATE'])
    }))
    .sort((a, b) => b.occurrences - a.occurrences || a.proposal_id.localeCompare(b.proposal_id));
}

export function assertSnowballProposalSafe(proposal) {
  if (!proposal || proposal.status !== 'PROPOSED' || proposal.authority !== 'NONE' || proposal.auto_mutation_allowed !== false) throw new Error('SNOWBALL_PROPOSAL_UNSAFE');
  if (!Array.isArray(proposal.forbidden_effects) || !FORBIDDEN_EFFECTS.every(value => proposal.forbidden_effects.includes(value))) throw new Error('SNOWBALL_FORBIDDEN_EFFECTS_MISSING');
  if (!Array.isArray(proposal.required_flow) || proposal.required_flow.at(-1) !== 'HUMAN_PROMOTION_GATE') throw new Error('SNOWBALL_HUMAN_GATE_REQUIRED');
  return true;
}
