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
