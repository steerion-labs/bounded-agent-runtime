function policyAllows(entry, capabilityId, dataClass) {
  if (!entry || entry.trust !== 'VERIFIED' || entry.enabled !== true) return false;
  if (!Array.isArray(entry.capabilities) || !entry.capabilities.includes(capabilityId)) return false;
  if (!Array.isArray(entry.allowed_data_classes) || !entry.allowed_data_classes.includes(dataClass)) return false;
  return true;
}

function providerReady(provider, capabilityId, dataClass, registry = null) {
  if (!provider || typeof provider.name !== 'string' || !provider.name.trim()) return false;
  if (provider.available !== true || provider.authenticated !== true) return false;
  if (registry) {
    let policy;
    try { policy = registry.require(provider.name); } catch { return false; }
    if (!registry.routable(provider.name) || !policyAllows(policy, capabilityId, dataClass)) return false;
  } else {
    if (!Array.isArray(provider.capabilities) || !provider.capabilities.includes(capabilityId)) return false;
    if (!Array.isArray(provider.allowed_data_classes) || !provider.allowed_data_classes.includes(dataClass)) return false;
  }
  return true;
}
export function routeProvider({ capability_id, data_class, providers, registry = null }) {
  if (!capability_id || !data_class || !Array.isArray(providers)) throw new Error('BOUNDARY_PROVIDER_ROUTE_INVALID');
  const eligible = providers.filter(provider => providerReady(provider, capability_id, data_class, registry));
  eligible.sort((a, b) => {
    const pa = Number.isFinite(a.priority) ? a.priority : Number.MAX_SAFE_INTEGER;
    const pb = Number.isFinite(b.priority) ? b.priority : Number.MAX_SAFE_INTEGER;
    return pa - pb || String(a.name).localeCompare(String(b.name));
  });
  const selected = eligible[0];
  if (!selected) throw new Error(`BOUNDARY_PROVIDER_UNAVAILABLE:${capability_id}:${data_class}`);
  return Object.freeze({ provider:selected.name, capability_id, data_class, routing:'deterministic-pre-execution', registry_enforced:Boolean(registry) });
}

export function assertProviderDataBoundary(provider, dataClass, registry = null) {
  if (registry) {
    const entry = registry.require(provider?.name);
    if (!registry.routable(entry.id) || !entry.allowed_data_classes.includes(dataClass)) throw new Error(`BOUNDARY_PROVIDER_DATA_DENIED:${entry.id}:${dataClass}`);
    return true;
  }
  if (!provider?.allowed_data_classes?.includes(dataClass)) throw new Error(`BOUNDARY_PROVIDER_DATA_DENIED:${provider?.name || 'unknown'}:${dataClass}`);
  return true;
}
