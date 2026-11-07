import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(here, '..', 'scripts', 'demo-attack.mjs');

test('public attack demo blocks all four authority-escalation attempts', () => {
  const run = spawnSync(process.execPath, [script], {
    encoding: 'utf8',
    env: { ...process.env }
  });

  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, /BLOCKED  default-branch write/);
  assert.match(run.stdout, /BLOCKED  arbitrary branch escape/);
  assert.match(run.stdout, /BLOCKED  protected merge request/);
  assert.match(run.stdout, /BLOCKED  request tampering/);
  assert.match(run.stdout, /RESULT   4\/4 ATTACKS BLOCKED/);
});

test('JSON attack demo provides deterministic machine-readable denials', () => {
  const run = spawnSync(process.execPath, [script, '--json'], {
    encoding: 'utf8', env: { ...process.env }
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const parsed = JSON.parse(run.stdout);
  assert.equal(parsed.schema_version, 'bar.attack-demo.v1');
  assert.equal(parsed.status, 'PASS');
  assert.equal(parsed.total_checks, 4);
  assert.equal(parsed.blocked_checks, 4);
  assert.deepEqual(parsed.checks.map(item => item.label), [
    'default-branch write', 'arbitrary branch escape',
    'protected merge request', 'request tampering'
  ]);
  for (const item of parsed.checks) {
    assert.equal(item.status, 'BLOCKED');
    assert.match(item.denial_code, /^CANDIDATE_/);
  }
  assert.deepEqual(Object.keys(parsed).sort(),
    ['blocked_checks', 'checks', 'schema_version', 'status', 'total_checks']);
});
