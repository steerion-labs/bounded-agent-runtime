const HOOK_EVENTS = new Set([
  'BEFORE_TOOL','AFTER_TOOL','BEFORE_MUTATION','AFTER_MUTATION',
  'AGENT_START','AGENT_STOP','SESSION_START','SESSION_END'
]);

function plainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

export function createHookEvent({ event, task_id, actor, candidate_sha = null, tree_hash = null, metadata = {} }) {
  if (!HOOK_EVENTS.has(event)) throw new Error('BOUNDARY_HOOK_EVENT_INVALID');
  if (typeof task_id !== 'string' || !task_id.trim()) throw new Error('BOUNDARY_HOOK_TASK_REQUIRED');
  if (typeof actor !== 'string' || !actor.trim()) throw new Error('BOUNDARY_HOOK_ACTOR_REQUIRED');
  if (!plainObject(metadata)) throw new Error('BOUNDARY_HOOK_METADATA_INVALID');
  return Object.freeze({
    event,
    task_id: task_id.trim(),
    actor: actor.trim(),
    candidate_sha: candidate_sha || null,
    tree_hash: tree_hash || null,
    metadata: Object.freeze({ ...metadata }),
    authority: 'NONE',
    mutates_runtime_authority: false,
    may_approve: false,
    may_merge: false,
    may_deploy: false
  });
}

export function assertHookDescriptor(descriptor) {
  if (!plainObject(descriptor)) throw new Error('BOUNDARY_HOOK_DESCRIPTOR_INVALID');
  if (!HOOK_EVENTS.has(descriptor.event)) throw new Error('BOUNDARY_HOOK_EVENT_INVALID');
  if (descriptor.authority && descriptor.authority !== 'NONE') throw new Error('BOUNDARY_HOOK_AUTHORITY_FORBIDDEN');
  if (descriptor.may_approve || descriptor.may_merge || descriptor.may_deploy || descriptor.write_credentials) {
    throw new Error('BOUNDARY_HOOK_PROTECTED_ACTION_FORBIDDEN');
  }
  return true;
}

export function supportedHookEvents() {
  return Object.freeze([...HOOK_EVENTS]);
}
