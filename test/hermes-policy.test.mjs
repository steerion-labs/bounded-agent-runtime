import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hermesPinnedRelease,
  assertHermesPilotConfig,
  buildHermesPilotEnvironment,
  buildHermesPilotInvocation,
  hermesPilotSafetyProfile
} from '../runtime/adapters/hermes-policy.mjs';

test('Hermes release is pinned to the reviewed tag', () => {
  assert.deepEqual(hermesPinnedRelease(), { version: '0.21.3', releaseTag: 'v2026.9.14' });
});

test('Hermes pilot requires explicit provider, model and exact version', () => {
  assert.throws(() => assertHermesPilotConfig({ provider: 'openrouter', model: 'x' }), /HERMES_VERSION_NOT_PINNED/);
  assert.throws(() => assertHermesPilotConfig({ version: '0.21.3' }), /HERMES_PROVIDER_MODEL_REQUIRED/);
  assert.throws(() => assertHermesPilotConfig({ version: '0.21.2', provider: 'p', model: 'm' }), /HERMES_VERSION_NOT_PINNED/);
});

test('Hermes pilot admits only file and terminal toolsets', () => {
  const good = assertHermesPilotConfig({ version: '0.21.3', provider: 'p', model: 'm' });
  assert.deepEqual(good.toolsets.sort(), ['file', 'terminal']);
  for (const toolsets of [
    ['coding'], ['file', 'terminal', 'web'], ['file', 'memory'], ['file', 'browser'], ['all']
  ]) {
    assert.throws(
      () => assertHermesPilotConfig({ version: '0.21.3', provider: 'p', model: 'm', toolsets }),
      /HERMES_(TOOLSET_POLICY_VIOLATION|FORBIDDEN_TOOLSET)/
    );
  }
});

test('Hermes environment strips inherited credentials and isolates HOME', () => {
  const base = {
    PATH: '/usr/bin',
    HOME: '/home/operator',
    USERPROFILE: 'C:\\Users\\operator',
    GITHUB_TOKEN: 'secret-gh',
    GH_TOKEN: 'secret-gh2',
    OPENAI_API_KEY: 'secret-openai',
    ANTHROPIC_API_KEY: 'secret-anthropic',
    NVIDIA_API_KEY: 'secret-nvidia',
    COPILOT_GITHUB_TOKEN: 'secret-copilot',
    AWS_SECRET_ACCESS_KEY: 'secret-aws',
    RANDOM_SAFE_VALUE: 'should-not-pass'
  };
  const env = buildHermesPilotEnvironment(base, { workspace: '/workspace/task', hermesHome: '/tmp/hermes/task' });
  assert.equal(env.PATH, '/usr/bin');
  assert.equal(env.HOME, '/tmp/hermes/task');
  assert.equal(env.USERPROFILE, '/tmp/hermes/task');
  assert.equal(env.HERMES_HOME, '/tmp/hermes/task');
  assert.equal(env.HERMES_WRITE_SAFE_ROOT, '/workspace/task');
  assert.equal(env.TERMINAL_ENV, 'docker');
  assert.equal(env.TERMINAL_DOCKER_NETWORK, 'false');
  assert.equal(env.TERMINAL_DOCKER_FORWARD_ENV, '[]');
  assert.equal(env.TERMINAL_CONTAINER_PERSISTENT, 'false');
  for (const key of ['GITHUB_TOKEN','GH_TOKEN','OPENAI_API_KEY','ANTHROPIC_API_KEY','NVIDIA_API_KEY','COPILOT_GITHUB_TOKEN','AWS_SECRET_ACCESS_KEY','RANDOM_SAFE_VALUE']) {
    assert.equal(key in env, false, `${key} must not pass into Hermes`);
  }
});

test('Hermes invocation is finite, isolated and builder-only', () => {
  const invocation = buildHermesPilotInvocation({
    role: 'builder',
    config: { version: '0.21.3', provider: 'openrouter', model: 'example/model', max_turns: 999 },
    prompt: 'bounded task'
  });
  assert.equal(invocation.command, 'hermes');
  assert.deepEqual(invocation.args.slice(0, 5), ['chat','--oneshot','--quiet','--safe-mode','--toolsets']);
  assert.ok(invocation.args.includes('file,terminal'));
  const turnsIndex = invocation.args.indexOf('--max-turns');
  assert.equal(invocation.args[turnsIndex + 1], '50');
  assert.ok(invocation.args.includes('--provider'));
  assert.ok(invocation.args.includes('--model'));
  assert.throws(
    () => buildHermesPilotInvocation({ role: 'reviewer', config: { version: '0.21.3', provider: 'p', model: 'm' }, prompt: 'review' }),
    /HERMES_ROLE_UNSUPPORTED:reviewer/
  );
});

test('Hermes pilot has zero release authority', () => {
  assert.deepEqual(hermesPilotSafetyProfile(), {
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
  });
});
