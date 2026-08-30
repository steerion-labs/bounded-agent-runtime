import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  newLease, assertFreshLease, assertBudget, authorize, assertAllowedPath,
  createGateChallenge, canonicalGatePayload, verifyGateSignature, validateTask,
  ensureGitRepo, commitWorkspace, gitIdentity, assertWorkspaceIdentity
} from '../runtime/core.mjs';
import { assertTransition } from '../runtime/state-machine.mjs';

test('illegal transitions fail closed', () => assert.throws(() => assertTransition('NEW','BUILDING'), /ILLEGAL_TRANSITION/));
test('unknown capability is denied', () => assert.throws(() => authorize({allowed_actions:['build_local'],protected_actions:[]}, 'remote_mutation'), /CAPABILITY_DENIED/));
test('task-declared protected action routes to Human Gate', () => assert.equal(authorize({allowed_actions:['merge'],protected_actions:['merge']}, 'merge'), 'HUMAN_GATE'));
test('protected but disallowed action is denied before Human Gate', () => assert.throws(() => authorize({allowed_actions:[],protected_actions:['merge']}, 'merge'), /CAPABILITY_DENIED:merge/));
test('expired lease is rejected', () => assert.throws(() => assertFreshLease(newLease('t1', -1)), /STALE_LEASE/));
test('fencing mismatch is rejected', () => assert.throws(() => assertFreshLease(newLease('t1',10000,5), 6), /FENCING_MISMATCH/));
test('model budget exhaustion rejected', () => assert.throws(() => assertBudget({started_at:new Date().toISOString(),budget:{limits:{model_calls:1,wall_clock_seconds:10},used:{model_calls:1}}},{model_calls:1}), /BUDGET_EXCEEDED:model_calls/));
test('wall-clock exhaustion rejected', () => assert.throws(() => assertBudget({started_at:new Date(Date.now()-5000).toISOString(),budget:{limits:{wall_clock_seconds:1},used:{}}}), /BUDGET_EXCEEDED:wall_clock_seconds/));
test('retry exhaustion rejected', () => assert.throws(() => assertBudget({started_at:new Date().toISOString(),budget:{limits:{retries:1,wall_clock_seconds:10},used:{retries:1}}},{retries:1}), /BUDGET_EXCEEDED:retries/));
test('path policy rejects traversal and non-allowlisted files', () => {
  const task={allowed_paths:['demo-output/']};
  assert.throws(() => assertAllowedPath(task,'../secret.txt'), /PATH_DENIED/);
  assert.throws(() => assertAllowedPath(task,'other/file.txt'), /PATH_DENIED/);
  assert.doesNotThrow(() => assertAllowedPath(task,'demo-output/file.txt'));
});
test('task schema fails closed', () => assert.throws(() => validateTask({task_id:'x'}), /TASK_FIELD_MISSING/));
test('gate signature binds identity and exact candidate', () => {
  const {publicKey,privateKey}=crypto.generateKeyPairSync('ed25519');
  const challenge=createGateChallenge({task_id:'t1',candidate_sha:'abc',tree_hash:'tree1',state_version:9});
  const identity='reviewer@example.invalid';
  const sig=crypto.sign(null,Buffer.from(canonicalGatePayload(challenge,identity)),privateKey).toString('base64');
  const pub=publicKey.export({type:'spki',format:'pem'});
  assert.doesNotThrow(() => verifyGateSignature(challenge,sig,pub,identity));
  assert.throws(() => verifyGateSignature({...challenge,candidate_sha:'tampered'},sig,pub,identity), /INVALID_HUMAN_GATE_SIGNATURE/);
  assert.throws(() => verifyGateSignature(challenge,sig,pub,'other'), /INVALID_HUMAN_GATE_SIGNATURE/);
});
test('controller-derived Git identity detects drift', () => {
  const repo=fs.mkdtempSync(path.join(os.tmpdir(),'bar-drift-'));
  const task={allowed_paths:['demo-output/']}; ensureGitRepo(repo);
  fs.mkdirSync(path.join(repo,'demo-output')); fs.writeFileSync(path.join(repo,'demo-output','x.txt'),'one');
  const id=commitWorkspace(repo,task,'one'); const state={...id};
  fs.writeFileSync(path.join(repo,'demo-output','x.txt'),'two'); commitWorkspace(repo,task,'two');
  assert.throws(() => assertWorkspaceIdentity(state,repo), /POST_TEST_CANDIDATE_DRIFT|POST_TEST_TREE_DRIFT/);
});
test('workspace hardlink escape is rejected before commit', () => {
  const repo=fs.mkdtempSync(path.join(os.tmpdir(),'bar-hardlink-'));
  const external=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'bar-external-')),'secret.txt');
  fs.writeFileSync(external,'outside'); ensureGitRepo(repo);
  fs.mkdirSync(path.join(repo,'demo-output')); fs.linkSync(external,path.join(repo,'demo-output','linked.txt'));
  assert.throws(() => commitWorkspace(repo,{allowed_paths:['demo-output/']},'blocked'), /WORKSPACE_HARDLINK_DENIED/);
});
