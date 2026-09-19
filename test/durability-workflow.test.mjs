import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow=fs.readFileSync('.github/workflows/durability-proof.yml','utf8');
const proof=fs.readFileSync('scripts/durability-proof.mjs','utf8');

test('durability workflow is read-only and secretless',()=>{
  assert.match(workflow,/permissions:\s*\n\s*contents: read/);
  assert.doesNotMatch(workflow,/contents:\s*write|pull-requests:\s*write|issues:\s*write|actions:\s*write/i);
  assert.doesNotMatch(workflow,/secrets\.|pull_request_target|self-hosted/i);
  assert.match(workflow,/persist-credentials: false/);
});

test('durability proof covers Linux, Windows and daily container isolation',()=>{
  assert.match(workflow,/os: \[ubuntu-latest, windows-latest\]/);
  assert.match(workflow,/cron: '17 \* \* \* \*'/);
  assert.match(workflow,/cron: '43 3 \* \* \*'/);
  assert.match(workflow,/npm run test:container/);
  assert.match(workflow,/retention-days: 7/);
});

test('durability proof binds recovery, fencing, replay and Human Gate evidence',()=>{
  for(const marker of [
    'expired lease is rejected',
    'fencing mismatch is rejected',
    'forged ACCEPTED state cannot bypass Human Gate',
    'approval nonce cannot be replayed after state rollback',
    'recovery can replay one durably journaled transition after a state-write crash',
    'persisted lease takeover fences a stale controller snapshot',
    'protected authorization rejects candidate drift after approval',
    '4/4 PASS: HUMAN_GATE_REQUIRED',
    'SOURCE_MUTATION_DETECTED'
  ]) assert.ok(proof.includes(marker),marker);
});

test('durability workflow has no productive side-effect commands',()=>{
  assert.doesNotMatch(workflow,/\bgh\s+(pr\s+merge|release|api)|git\s+push|npm\s+publish|docker\s+push/i);
  assert.match(proof,/protectedRemoteMutationAttempted:false/);
  assert.match(proof,/secretsRequired:false/);
});
