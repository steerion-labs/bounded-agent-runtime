import crypto from 'node:crypto';

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function boundaryBindingPayload(input) {
  const payload = {
    task_id: String(input.task_id || ''),
    capability_id: String(input.capability_id || ''),
    action: String(input.action || ''),
    role: String(input.role || ''),
    adapter: String(input.adapter || ''),
    provider: input.provider ? String(input.provider) : null,
    candidate_sha: input.candidate_sha ? String(input.candidate_sha) : null,
    policy_version: String(input.policy_version || 'boundary-v0.1')
  };
  if (!payload.task_id || !payload.capability_id || !payload.action || !payload.role || !payload.adapter) {
    throw new Error('BOUNDARY_BINDING_INVALID');
  }
  return Object.freeze(payload);
}
export function createBoundaryBinding(input) {
  const payload = boundaryBindingPayload(input);
  const hash = crypto.createHash('sha256').update(canonical(payload)).digest('hex');
  return Object.freeze({ ...payload, binding_sha256: hash });
}

export function assertBoundaryBinding(binding, input) {
  const expected = createBoundaryBinding(input);
  if (!binding || binding.binding_sha256 !== expected.binding_sha256) throw new Error('BOUNDARY_BINDING_MISMATCH');
  return true;
}

export function assertNoAdapterFallback(binding, adapter) {
  if (!binding || binding.adapter !== adapter) throw new Error(`BOUNDARY_ADAPTER_REBIND_DENIED:${binding?.adapter || 'none'}:${adapter}`);
  return true;
}

export function assertNoProviderFallback(binding, provider) {
  const expected = binding?.provider || null;
  const actual = provider || null;
  if (expected !== actual) throw new Error(`BOUNDARY_PROVIDER_REBIND_DENIED:${expected || 'none'}:${actual || 'none'}`);
  return true;
}