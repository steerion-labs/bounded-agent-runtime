import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnosticProbeEnv, parseVersionOutput, probeAgentVersion } from '../runtime/doctor.mjs';

const resolve = () => ({ command: 'fake-agent', args: ['--version'] });

test('diagnostic version probe environment excludes credentials and user config', () => {
  const env = diagnosticProbeEnv({ PATH: 'x', PATHEXT: '.EXE', TEMP: 't', HOME: 'home', USERPROFILE: 'profile', API_KEY: 'secret', GITHUB_TOKEN: 'secret' });
  assert.equal(env.PATH, 'x');
  assert.equal(env.PATHEXT, '.EXE');
  assert.equal(env.HOME, undefined);
  assert.equal(env.USERPROFILE, undefined);
  assert.equal(env.API_KEY, undefined);
  assert.equal(env.GITHUB_TOKEN, undefined);
  assert.equal(env.CI, '1');
});

test('version parser finds bounded version-like output without trusting noise', () => {
  assert.equal(parseVersionOutput('codex-cli 0.150.1\n', ''), 'codex-cli 0.150.1');
  assert.equal(parseVersionOutput('Warning: daemon offline\nclient version 0.33.1\n', ''), 'client version 0.33.1');
  assert.equal(parseVersionOutput('not a version\n', ''), null);
  assert.equal(parseVersionOutput('x'.repeat(161) + ' 1.2\n', ''), null);
});

test('missing executable is reported without executing anything', () => {
  let called = false;
  const result = probeAgentVersion('codex', null, { spawn: () => { called = true; }, resolve });
  assert.deepEqual(result, { version: null, version_probe: 'NOT_INSTALLED' });
  assert.equal(called, false);
});

test('version probe uses bounded minimal execution context', () => {
  let observed;
  const result = probeAgentVersion('codex', 'codex', {
    resolve,
    spawn: (command, args, options) => {
      observed = { command, args, options };
      return { status: 0, stdout: 'codex-cli 0.150.1\n', stderr: '' };
    }
  });
  assert.equal(result.version_probe, 'PASS');
  assert.equal(observed.command, 'fake-agent');
  assert.deepEqual(observed.args, ['--version']);
  assert.equal(observed.options.timeout, 5000);
  assert.equal(observed.options.env.GITHUB_TOKEN, undefined);
  assert.equal(observed.options.env.CI, '1');
});

test('version probe fails closed on timeout or nonzero exit', () => {
  const timeout = probeAgentVersion('codex', 'codex', { spawn: () => ({ status: null, error: { code: 'ETIMEDOUT' } }), resolve });
  assert.deepEqual(timeout, { version: null, version_probe: 'FAILED' });
  const failed = probeAgentVersion('codex', 'codex', { spawn: () => ({ status: 1, stdout: '', stderr: 'error' }), resolve });
  assert.deepEqual(failed, { version: null, version_probe: 'FAILED' });
});

test('version probe rejects unexpected output and accepts version output', () => {
  const noisy = probeAgentVersion('codex', 'codex', { spawn: () => ({ status: 0, stdout: 'hello', stderr: '' }), resolve });
  assert.deepEqual(noisy, { version: null, version_probe: 'FAILED' });
  const good = probeAgentVersion('codex', 'codex', { spawn: () => ({ status: 0, stdout: 'codex-cli 0.150.1\n', stderr: '' }), resolve });
  assert.deepEqual(good, { version: 'codex-cli 0.150.1', version_probe: 'PASS' });
});
