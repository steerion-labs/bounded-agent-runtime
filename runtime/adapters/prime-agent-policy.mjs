import path from 'node:path';

const ALLOWED_ENV_KEYS = new Set(['PATH','Path','SystemRoot','SYSTEMROOT','WINDIR','ComSpec','COMSPEC','PATHEXT','TEMP','TMP','TMPDIR','LANG','LC_ALL']);

export function assertPrimeAgentPocAllowed(task, role) {
  const config = task?.workers?.[role];
  if (!config || config.adapter !== 'prime-agent') throw new Error('PRIME_AGENT_CONFIG_REQUIRED');
  if (config.poc !== true) throw new Error('PRIME_AGENT_POC_ONLY');
  if (config.session_persistence !== false) throw new Error('PRIME_AGENT_SESSION_PERSISTENCE_FORBIDDEN');
  if (config.skills !== 'none') throw new Error('PRIME_AGENT_SKILLS_FORBIDDEN');
  if (config.schedules !== false) throw new Error('PRIME_AGENT_SCHEDULES_FORBIDDEN');
  if (config.refinement !== 'disabled') throw new Error('PRIME_AGENT_REFINEMENT_FORBIDDEN');
  if (config.credentials !== 'none') throw new Error('PRIME_AGENT_CREDENTIALS_FORBIDDEN');
  if (config.network !== 'deny') throw new Error('PRIME_AGENT_NETWORK_MUST_DENY');
  if (role === 'reviewer' && config.workspace_mode !== 'read-only') throw new Error('PRIME_AGENT_REVIEWER_READ_ONLY_REQUIRED');
  if (role === 'builder' && config.workspace_mode !== 'disposable-write') throw new Error('PRIME_AGENT_BUILDER_DISPOSABLE_REQUIRED');
  return true;
}

export function primeAgentPocEnv(baseEnv, workspace) {
  const env = {};
  for (const [key, value] of Object.entries(baseEnv ?? {})) {
    if (!ALLOWED_ENV_KEYS.has(key)) continue;
    env[key] = value;
  }
  const isolatedHome = path.join(workspace, '.bar-prime-home');
  env.HOME = isolatedHome;
  env.USERPROFILE = isolatedHome;
  env.PRIME_AGENT_POC = '1';
  return env;
}
