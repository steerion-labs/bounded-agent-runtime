import { decideBoundaryAuthority, AUTHORITY_DECISIONS } from './authority-engine.mjs';
import { createBoundaryBinding } from './binding.mjs';
import { routeAgent } from './agent-router.mjs';
import { routeProvider } from './provider-router.mjs';

export function createExecutionPlan({ task, registry, capability_id, action, role, agents, providers = [], provider_registry = null, controller_state = null, evidence = [], policy_version = 'boundary-v0.1' }) {
  if (!controller_state?.candidate_sha || !controller_state?.tree_hash) return Object.freeze({ executable: false, authority: Object.freeze({ decision: AUTHORITY_DECISIONS.DENY, reason: 'CONTROLLER_CANDIDATE_REQUIRED' }), binding: null });
  const authority = decideBoundaryAuthority({ task, registry, capability_id, action, role, evidence, controller_state });
  if (authority.decision === AUTHORITY_DECISIONS.DENY) return Object.freeze({ executable: false, authority, binding: null });
  const capability = registry.require(capability_id);
  const agentRoute = routeAgent({ role, capability, agents });
  let providerRoute = null;
  if (capability.network === 'external' || capability.credentials === 'provider') {
    if (!provider_registry) throw new Error(`BOUNDARY_PROVIDER_REGISTRY_REQUIRED:${capability_id}`);
    providerRoute = routeProvider({ capability_id, data_class: task.data_class, providers, registry: provider_registry });
  }
  const binding = createBoundaryBinding({
    task_id: task.task_id,
    capability_id,
    action,
    role,
    adapter: agentRoute.adapter,
    provider: providerRoute?.provider || null,
    data_class: task.data_class,
    candidate_sha: controller_state?.candidate_sha ?? null,
    tree_hash: controller_state?.tree_hash ?? null,
    policy_version
  });  return Object.freeze({
    executable: authority.decision === AUTHORITY_DECISIONS.ALLOW_LOCAL,
    human_gate_required: authority.decision === AUTHORITY_DECISIONS.HUMAN_GATE_REQUIRED,
    authority,
    binding,
    route: Object.freeze({ agent: agentRoute, provider: providerRoute }),
    capability: capability.id,
    isolation: capability.isolation,
    network: capability.network,
    credentials: capability.credentials,
    data_class: task.data_class
  });
}
