import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow=fs.readFileSync('.github/workflows/remote-execution-reference.yml','utf8');
const doc=fs.readFileSync('docs/25-REMOTE-EXECUTION.md','utf8');
const script=fs.readFileSync('scripts/remote-execution-proof.mjs','utf8');

test('reference remote execution is read-only and credentialless',()=>{
  assert.match(workflow,/permissions:\s*\n\s*contents: read/);
  assert.match(workflow,/persist-credentials: false/);
  assert.doesNotMatch(workflow,/secrets\./);
  assert.match(script,/secretsRequired:false/);
  assert.match(script,/privateProjectDataRequired:false/);
  assert.match(script,/protectedRemoteMutationAttempted:false/);
});
test('remote provider cannot become authority',()=>{
  assert.match(doc,/provider is compute, never an authority source/i);
  assert.match(doc,/Remote workers cannot approve protected actions/i);
  assert.match(doc,/lease and fencing checks remain mandatory/i);
});
test('reference workflow runs the deterministic BAR proof',()=>{
  assert.match(workflow,/remote-execution-proof\.mjs/);
  assert.match(script,/durability-proof\.mjs/);
  assert.match(script,/bar\.remote-execution-proof\.v1/);
});
