const ROLES = new Set(['builder','reviewer','researcher','operator']);
const ISOLATION = new Set(['none','process','container','role-account']);
const NETWORK = new Set(['none','bounded','external']);
const CREDENTIALS = new Set(['none','task','provider']);
const DATA_CLASSES = new Set(['public','internal','confidential','secret']);

function nonEmptyStrings(value, field) {
  if (!Array.isArray(value) || value.length === 0 || value.some(x => typeof x !== 'string' || !x.trim())) {
    throw new Error(`BOUNDARY_CAPABILITY_INVALID:${field}`);
  }
  return [...new Set(value)];
}

export function validateCapability(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('BOUNDARY_CAPABILITY_INVALID:object');
  const id = String(input.id || '');
  if (!/^[a-z0-9][a-z0-9._-]{2,79}$/.test(id)) throw new Error('BOUNDARY_CAPABILITY_INVALID:id');
  const roles = nonEmptyStrings(input.roles, 'roles');
  if (roles.some(role => !ROLES.has(role))) throw new Error('BOUNDARY_CAPABILITY_INVALID:roles');
  const actions = nonEmptyStrings(input.actions, 'actions');
  const adapters = nonEmptyStrings(input.adapters, 'adapters');
  const dataClasses = nonEmptyStrings(input.data_classes, 'data_classes');
  if (dataClasses.some(value => !DATA_CLASSES.has(value))) throw new Error('BOUNDARY_CAPABILITY_INVALID:data_classes');  if (!ISOLATION.has(input.isolation)) throw new Error('BOUNDARY_CAPABILITY_INVALID:isolation');
  if (!NETWORK.has(input.network)) throw new Error('BOUNDARY_CAPABILITY_INVALID:network');
  if (!CREDENTIALS.has(input.credentials)) throw new Error('BOUNDARY_CAPABILITY_INVALID:credentials');
  if (typeof input.verification_required !== 'boolean') throw new Error('BOUNDARY_CAPABILITY_INVALID:verification_required');
  if (typeof input.human_gate_required !== 'boolean') throw new Error('BOUNDARY_CAPABILITY_INVALID:human_gate_required');
  return Object.freeze({
    id, roles: Object.freeze(roles), actions: Object.freeze(actions), adapters: Object.freeze(adapters),
    isolation: input.isolation, network: input.network, credentials: input.credentials,
    verification_required: input.verification_required,
    human_gate_required: input.human_gate_required,
    data_classes: Object.freeze(dataClasses)
  });
}

export function createCapabilityRegistry(manifest) {
  if (!Array.isArray(manifest)) throw new Error('BOUNDARY_REGISTRY_INVALID');
  const entries = manifest.map(validateCapability);
  const ids = new Set();
  for (const entry of entries) {
    if (ids.has(entry.id)) throw new Error(`BOUNDARY_CAPABILITY_DUPLICATE:${entry.id}`);
    ids.add(entry.id);
  }
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  return Object.freeze({
    get(id) { return byId.get(id) || null; },
    require(id) { const value = byId.get(id); if (!value) throw new Error(`BOUNDARY_CAPABILITY_UNKNOWN:${id}`); return value; },
    list() { return entries.slice(); }
  });
}
