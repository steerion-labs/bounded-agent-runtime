const DEFAULT_PRIORITY = Object.freeze(['codex','claude','opencode','container','generic']);

function ready(agent, role, capability) {
  if (agent?.installed !== true) return false;
  if (agent.authenticated !== true) return false;
  if (agent[`safe_for_${role}`] !== true) return false;
  if (agent[`ready_for_${role}`] !== true) return false;
  if (!capability.roles.includes(role)) return false;
  if (!capability.adapters.includes(agent.name)) return false;
  if (Array.isArray(agent.capabilities) && !agent.capabilities.includes(capability.id)) return false;
  return true;
}

export function routeAgent({ role, capability, agents, priority = DEFAULT_PRIORITY }) {
  if (!capability) throw new Error('BOUNDARY_ROUTE_CAPABILITY_REQUIRED');
  if (!Array.isArray(agents)) throw new Error('BOUNDARY_ROUTE_AGENTS_REQUIRED');
  const byName = new Map(agents.map(agent => [agent.name, agent]));
  for (const name of priority) {
    const agent = byName.get(name);
    if (ready(agent, role, capability)) {
      return Object.freeze({ adapter: name, role, capability_id: capability.id, routing: 'deterministic-pre-execution' });
    }
  }
  throw new Error(`BOUNDARY_AGENT_UNAVAILABLE:${role}:${capability.id}`);
}

export function defaultAgentPriority() {
  return DEFAULT_PRIORITY.slice();
}