import fs from 'node:fs';
import path from 'node:path';

const definitions = Object.freeze({
  demo: { roles: ['builder', 'reviewer'], executable: process.execPath, boundary: 'synthetic demo only' },
  codex: { roles: ['builder', 'reviewer'], executable: 'codex', boundary: 'workspace-write builder / read-only reviewer' },
  claude: { roles: ['builder', 'reviewer'], executable: 'claude', boundary: 'edit-only builder / plan+read reviewer' },
  opencode: { roles: ['builder', 'reviewer'], executable: 'opencode', boundary: 'pure mode; BAR verifies workspace/candidate' },
  ollama: { roles: ['reviewer'], executable: 'ollama', boundary: 'reviewer only' },
  container: { roles: ['builder', 'reviewer'], executable: 'docker', boundary: 'disposable network-none container' },
  generic: { roles: ['builder', 'reviewer'], executable: null, boundary: 'operator-supplied; controller checks remain mandatory' }
});

export function adapterDefinitions() {
  return structuredClone(definitions);
}

export function assertAdapterName(name, role) {
  const def = definitions[name];
  if (!def) throw new Error(`ADAPTER_UNKNOWN:${name}`);
  if (!def.roles.includes(role)) throw new Error(`ADAPTER_ROLE_UNSUPPORTED:${name}:${role}`);
  return name;
}


export function selectAvailableAdapter(role, agents) {
  const order = role === 'builder' ? ['codex','claude','opencode','container','generic'] : ['codex','claude','opencode','ollama','container','generic'];
  const selected = order.find(name => {
    const agent = agents?.[name];
    if (!agent?.installed || !definitions[name]?.roles.includes(role)) return false;
    if (['codex','claude','opencode'].includes(name) && agent.authenticated !== true) return false;
    if (role === 'builder' && agent.safe_for_builder === false) return false;
    if (name === 'container' && agent[`configured_for_${role}`] !== true) return false;
    return true;
  });
  if (!selected) throw new Error(`AUTO_ADAPTER_UNAVAILABLE:${role}`);
  return selected;
}

export function resolveAdapter(name, role) {
  assertAdapterName(name, role);
  if (name === 'demo') return role === 'builder' ? 'demo-builder.mjs' : 'demo-reviewer.mjs';
  if (name === 'container') return 'container-agent.mjs';
  return 'cli-agent.mjs';
}
