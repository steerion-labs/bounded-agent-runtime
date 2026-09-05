function requiredString(value, code) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(code);
  return value.trim();
}

const FORBIDDEN_KEYS = new Set(['authority','approval','approved','evidence','evidence_id','credential','credentials','token','secret']);

export function ingestAdvisoryMemory(entries) {
  if (!Array.isArray(entries)) throw new Error('BOUNDARY_MEMORY_ENTRIES_INVALID');
  return Object.freeze(entries.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('BOUNDARY_MEMORY_ENTRY_INVALID');
    for (const key of Object.keys(entry)) if (FORBIDDEN_KEYS.has(key.toLowerCase())) throw new Error('BOUNDARY_MEMORY_AUTHORITY_CLAIM_FORBIDDEN');
    return Object.freeze({
      memory_id: entry.memory_id ? requiredString(entry.memory_id, 'BOUNDARY_MEMORY_ID_INVALID') : `memory-${index + 1}`,
      content: requiredString(entry.content, 'BOUNDARY_MEMORY_CONTENT_REQUIRED'),
      source: entry.source ? requiredString(entry.source, 'BOUNDARY_MEMORY_SOURCE_INVALID') : 'unspecified',
      trust: 'UNTRUSTED_CONTEXT',
      authority: 'NONE',
      evidence_value: 'NONE',
      may_satisfy_gate: false,
      may_grant_permission: false
    });
  }));
}

export function buildAdvisoryContext(memories, { max_items = 8 } = {}) {
  if (!Array.isArray(memories)) throw new Error('BOUNDARY_MEMORY_CONTEXT_INVALID');
  if (!Number.isInteger(max_items) || max_items < 0) throw new Error('BOUNDARY_MEMORY_BUDGET_INVALID');
  const selected = memories.slice(0, max_items);
  for (const item of selected) {
    if (item?.trust !== 'UNTRUSTED_CONTEXT' || item?.authority !== 'NONE' || item?.may_satisfy_gate !== false) {
      throw new Error('BOUNDARY_MEMORY_TRUST_CONTRACT_REQUIRED');
    }
  }
  return Object.freeze({
    items: Object.freeze([...selected]),
    trust: 'UNTRUSTED_CONTEXT',
    authority: 'NONE',
    requires_independent_verification: true
  });
}
