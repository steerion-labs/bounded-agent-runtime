import crypto from 'node:crypto';

const TRUST_STATES = Object.freeze(['DISCOVERY_ONLY','VERIFIED']);

function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key)+':'+canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}

function normalize(entry) {
  if (!entry || typeof entry !== 'object') throw new Error('BOUNDARY_PROVIDER_ENTRY_INVALID');
  const id = String(entry.id || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{1,63}$/.test(id)) throw new Error(`BOUNDARY_PROVIDER_ID_INVALID:${id || 'missing'}`);
  const trust = String(entry.trust || 'DISCOVERY_ONLY').toUpperCase();
  if (!TRUST_STATES.includes(trust)) throw new Error(`BOUNDARY_PROVIDER_TRUST_INVALID:${id}`);
  const allowed = Array.isArray(entry.allowed_data_classes) ? [...new Set(entry.allowed_data_classes.map(String))] : [];
  return Object.freeze({
    id,
    display_name: String(entry.display_name || id),
    source: String(entry.source || ''),
    official_docs: entry.official_docs ? String(entry.official_docs) : null,
    trust,
    enabled: entry.enabled === true,
    auth: String(entry.auth || 'api_key'),
    capabilities: Object.freeze([...(entry.capabilities || [])].map(String)),
    allowed_data_classes: Object.freeze(allowed),
    cost_class: String(entry.cost_class || 'unknown'),
    notes: entry.notes ? String(entry.notes) : null
  });
}

export function createProviderRegistry(entries = []) {
  if (!Array.isArray(entries)) throw new Error('BOUNDARY_PROVIDER_REGISTRY_INVALID');
  const map = new Map();
  for (const raw of entries) {
    const entry = normalize(raw);
    if (map.has(entry.id)) throw new Error(`BOUNDARY_PROVIDER_DUPLICATE:${entry.id}`);
    map.set(entry.id, entry);
  }
  const snapshot=[...map.values()].sort((a,b)=>a.id.localeCompare(b.id));
  const policy_sha256=crypto.createHash('sha256').update(canonical(snapshot)).digest('hex');
  return Object.freeze({
    policy_sha256,
    list: () => Object.freeze([...snapshot]),
    require: id => {
      const entry = map.get(String(id || '').toLowerCase());
      if (!entry) throw new Error(`BOUNDARY_PROVIDER_UNKNOWN:${id}`);
      return entry;
    },
    routable: id => {
      const entry = map.get(String(id || '').toLowerCase());
      return Boolean(entry && entry.trust === 'VERIFIED' && entry.enabled === true);
    }
  });
}

export function promoteProvider(entry, { official_docs, allowed_data_classes = [], capabilities = [] } = {}) {
  const base = normalize(entry);
  if (!official_docs) throw new Error(`BOUNDARY_PROVIDER_OFFICIAL_VERIFICATION_REQUIRED:${base.id}`);
  return normalize({ ...base, official_docs, trust:'VERIFIED', enabled:false, allowed_data_classes, capabilities });
}

export function enableVerifiedProvider(entry) {
  const base = normalize(entry);
  if (base.trust !== 'VERIFIED') throw new Error(`BOUNDARY_PROVIDER_NOT_VERIFIED:${base.id}`);
  if (!base.official_docs) throw new Error(`BOUNDARY_PROVIDER_OFFICIAL_VERIFICATION_REQUIRED:${base.id}`);
  if (!base.capabilities.length || !base.allowed_data_classes.length) throw new Error(`BOUNDARY_PROVIDER_POLICY_REQUIRED:${base.id}`);
  return normalize({ ...base, enabled:true });
}
