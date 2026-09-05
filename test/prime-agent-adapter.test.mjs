import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAgentInvocation } from '../runtime/adapters/contracts.mjs';
import { assertPrimeAgentPocAllowed, primeAgentPocEnv } from '../runtime/adapters/prime-agent-policy.mjs';
import { adapterDefinitions } from '../runtime/adapters/registry.mjs';

function task(overrides = {}) {
  return {
    task_id: 'prime-poc',
    intent: 'edit fixture only',
    allowed_paths: ['fixture/**'],
    workers: {
      builder: {
        adapter: 'prime-agent', poc: true, session_persistence: false,
        skills: 'none', schedules: false, refinement: 'disabled',
        credentials: 'none', network: 'deny', workspace_mode: 'disposable-write',
        ...overrides
      }
    }
  };
}

test('Prime Agent is registered but never auto-selected', () => {
  const defs = adapterDefinitions();
  assert.equal(defs['prime-agent'].executable, 'prime-agent');
  assert.match(defs['prime-agent'].boundary, /POC only/);
});

test('Prime Agent invocation is ephemeral and skill-free', () => {
  const t = task();
  assert.equal(assertPrimeAgentPocAllowed(t, 'builder'), true);
  const call = buildAgentInvocation({ adapter: 'prime-agent', role: 'builder', task: t, workspace: '/tmp/work', prompt: 'do work' });
  assert.equal(call.command, 'prime-agent');
  assert.deepEqual(call.args.slice(0, 3), ['-p', '--no-session', '--no-skills']);
  assert.equal(call.args.at(-1), 'do work');
});

test('Prime Agent rejects authority-widening configuration', () => {
  for (const bad of [
    { poc: false }, { session_persistence: true }, { skills: 'auto' },
    { schedules: true }, { refinement: 'local' }, { credentials: 'inherit' },
    { network: 'allow' }, { workspace_mode: 'full-write' }
  ]) {
    assert.throws(() => assertPrimeAgentPocAllowed(task(bad), 'builder'));
  }
});

test('Prime Agent reviewer must be read-only', () => {
  const t = task();
  t.workers.reviewer = { ...t.workers.builder, workspace_mode: 'disposable-write' };
  assert.throws(() => assertPrimeAgentPocAllowed(t, 'reviewer'), /READ_ONLY_REQUIRED/);
  t.workers.reviewer.workspace_mode = 'read-only';
  assert.equal(assertPrimeAgentPocAllowed(t, 'reviewer'), true);
});

test('Prime Agent POC environment strips credential-bearing variables and isolates HOME', () => {
  const env = primeAgentPocEnv({
    PATH: '/bin', GH_TOKEN: 'secret', GITHUB_TOKEN: 'secret',
    OPENAI_API_KEY: 'secret', ANTHROPIC_API_KEY: 'secret', SAFE_VALUE: 'ok'
  }, '/worktree');
  assert.equal(env.PATH, '/bin');
  assert.equal(env.SAFE_VALUE, 'ok');
  assert.equal(env.GH_TOKEN, undefined);
  assert.equal(env.GITHUB_TOKEN, undefined);
  assert.equal(env.OPENAI_API_KEY, undefined);
  assert.equal(env.ANTHROPIC_API_KEY, undefined);
  assert.match(env.HOME, /\.bar-prime-home$/);
  assert.equal(env.USERPROFILE, env.HOME);
});
