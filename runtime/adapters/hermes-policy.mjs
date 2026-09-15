const PINNED = Object.freeze({
  version: '0.21.3',
  releaseTag: 'v2026.9.14'
});

const SAFE_ENV_KEYS = Object.freeze([
  'PATH', 'Path', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'TMPDIR', 'ComSpec'
]);

const FORBIDDEN_TOOLSETS = new Set([
  'all', '*', 'coding', 'debugging', 'web', 'search', 'browser', 'computer_use',
  'memory', 'skills', 'delegation', 'cronjob', 'messaging', 'discord',
  'discord_admin', 'homeassistant', 'spotify', 'session_search', 'code_execution',
  'x_search', 'video'
]);

export function hermesPinnedRelease() {
  return { ...PINNED };
}

export function assertHermesPilotConfig(config = {}) {
  if (config.version !== PINNED.version) {
    throw new Error(`HERMES_VERSION_NOT_PINNED:${config.version ?? 'missing'}:${PINNED.version}`);
  }
  if (!config.provider || !config.model) throw new Error('HERMES_PROVIDER_MODEL_REQUIRED');
  const toolsets = config.toolsets ?? ['file', 'terminal'];
  if (!Array.isArray(toolsets) || toolsets.length !== 2 || !toolsets.includes('file') || !toolsets.includes('terminal')) {
    throw new Error('HERMES_TOOLSET_POLICY_VIOLATION');
  }
  if (toolsets.some(value => FORBIDDEN_TOOLSETS.has(String(value)))) {
    throw new Error('HERMES_FORBIDDEN_TOOLSET');
  }
  return { ...config, toolsets: [...toolsets] };
}

export function buildHermesPilotEnvironment(baseEnv = process.env, { workspace, hermesHome } = {}) {
  if (!workspace || !hermesHome) throw new Error('HERMES_ISOLATION_PATHS_REQUIRED');
  const env = {};
  for (const key of SAFE_ENV_KEYS) if (baseEnv[key]) env[key] = baseEnv[key];

  env.HOME = hermesHome;
  env.USERPROFILE = hermesHome;
  env.HERMES_HOME = hermesHome;
  env.HERMES_WRITE_SAFE_ROOT = workspace;
  env.HERMES_REDACT_SECRETS = 'true';
  env.HERMES_ALLOW_PRIVATE_URLS = 'false';
  env.TERMINAL_ENV = 'docker';
  env.TERMINAL_DOCKER_NETWORK = 'false';
  env.TERMINAL_DOCKER_MOUNT_CWD_TO_WORKSPACE = 'true';
  env.TERMINAL_DOCKER_RUN_AS_HOST_USER = 'true';
  env.TERMINAL_DOCKER_FORWARD_ENV = '[]';
  env.TERMINAL_CONTAINER_PERSISTENT = 'false';
  env.TERMINAL_DOCKER_PERSIST_ACROSS_PROCESSES = 'false';
  env.TERMINAL_PERSISTENT_SHELL = 'false';
  env.TERMINAL_TIMEOUT = '120';

  return env;
}

export function buildHermesPilotInvocation({ role, config, prompt }) {
  if (role !== 'builder') throw new Error(`HERMES_ROLE_UNSUPPORTED:${role}`);
  const normalized = assertHermesPilotConfig(config);
  const args = [
    'chat', '--oneshot', '--quiet', '--safe-mode',
    '--toolsets', normalized.toolsets.join(','),
    '--max-turns', String(Math.min(50, Math.max(1, Number(normalized.max_turns) || 40))),
    '--provider', normalized.provider,
    '--model', normalized.model,
    '-q', prompt
  ];
  return { command: 'hermes', args };
}

export function hermesPilotSafetyProfile() {
  return {
    status: 'PILOT_ONLY',
    roles: ['builder'],
    auto_select: false,
    persistent_memory: false,
    skills: false,
    browser: false,
    mcp: false,
    delegation: false,
    cron: false,
    messaging: false,
    computer_use: false,
    tool_network: 'DENY',
    host_home: 'ISOLATED',
    credential_forwarding: 'DENY_BY_DEFAULT',
    evidence_authority: 'NONE',
    human_gate: 'REQUIRED'
  };
}
