import fs from 'node:fs';
import path from 'node:path';

const definitions = Object.freeze({
  demo: { roles: ['builder', 'reviewer'], executable: process.execPath },
  codex: { roles: ['builder', 'reviewer'], executable: 'codex' },
  claude: { roles: ['builder', 'reviewer'], executable: 'claude' },
  opencode: { roles: ['builder', 'reviewer'], executable: 'opencode' },
  ollama: { roles: ['reviewer'], executable: 'ollama' },
  container: { roles: ['builder', 'reviewer'], executable: 'docker' },
  generic: { roles: ['builder', 'reviewer'], executable: null }
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

export function resolveAdapter(name, role) {
  assertAdapterName(name, role);
  if (name === 'demo') return role === 'builder' ? 'demo-builder.mjs' : 'demo-reviewer.mjs';
  if (name === 'container') return 'container-agent.mjs';
  return 'cli-agent.mjs';
}
