import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { newLease, assertFreshLease, assertBudget, authorize, assertBoundEvidence, requiresHumanGate, assertHumanApproval, createGateChallenge, canonicalGatePayload, verifyGateSignature, validateTask, evidence, ensureGitRepo, gitIdentity, assertWorkspaceIdentity } from '../runtime/core.mjs';
import { assertTransition } from '../runtime/state-machine.mjs';
test('illegal state transitions fail closed',()=>assert.throws(()=>assertTransition('NEW','BUILDING'),/ILLEGAL_TRANSITION/));
test('unknown capability is denied',()=>assert.throws(()=>authorize({allowed_actions:['build_local']},'remote_mutation'),/CAPABILITY_DENIED/));
test('expired lease is rejected',()=>assert.throws(()=>assertFreshLease(newLease('t1',-1)),/STALE_LEASE/));
test('fencing generation mismatch is rejected',()=>assert.throws(()=>assertFreshLease(newLease('t1',10000,5),6),/FENCING_MISMATCH/));
test('model budget exhaustion rejected',()=>assert.throws(()=>assertBudget({started_at:new Date().toISOString(),budget:{limits:{model_calls:1,wall_clock_seconds:10},used:{model_calls:1}}},{model_calls:1}),/BUDGET_EXCEEDED:model_calls/));
test('wall clock budget exhaustion rejected',()=>assert.throws(()=>assertBudget({started_at:new Date(Date.now()-5000).toISOString(),budget:{limits:{wall_clock_seconds:1},used:{}}}),/BUDGET_EXCEEDED:wall_clock_seconds/));
test('retry budget exhaustion rejected',()=>assert.throws(()=>assertBudget({started_at:new Date().toISOString(),budget:{limits:{retries:1,wall_clock_seconds:10},used:{retries:1}}},{retries:1}),/BUDGET_EXCEEDED:retries/));
test('candidate binding rejects stale evidence',()=>assert.throws(()=>assertBoundEvidence({task_id:'t1',candidate_sha:'abc',tree_hash:'tree1'},{task_id:'t1',candidate_sha:'old',tree_hash:'tree1'}),/CANDIDATE_BINDING_MISMATCH/));
test('protected operations require human gate',()=>{assert.equal(requiresHumanGate('merge'),true);assert.throws(()=>assertHumanApproval({state:'HUMAN_GATE'},'merge'),/HUMAN_GATE_REQUIRED/)});
test('gate signature binds exact candidate and state',()=>{const {publicKey,privateKey}=crypto.generateKeyPairSync('ed25519');const c=createGateChallenge({task_id:'t1',candidate_sha:'abc',tree_hash:'tree1',state_version:9});const sig=crypto.sign(null,Buffer.from(canonicalGatePayload(c)),privateKey).toString('base64');const pub=publicKey.export({type:'spki',format:'pem'});assert.doesNotThrow(()=>verifyGateSignature(c,sig,pub));assert.throws(()=>verifyGateSignature({...c,candidate_sha:'tampered'},sig,pub),/INVALID_HUMAN_GATE_SIGNATURE/)});
test('task schema fails closed',()=>assert.throws(()=>validateTask({task_id:'x'}),/TASK_FIELD_MISSING/));
test('evidence carries exact candidate bindings',()=>{const e=evidence('x',{task_id:'t',candidate_sha:'c',tree_hash:'h'},{producer_identity:'verifier'});assert.equal(e.task_id,'t');assert.equal(e.candidate_sha,'c');assert.equal(e.tree_hash,'h');assert.equal(e.producer_identity,'verifier')});



test('post-test candidate drift is rejected',()=>{
  const d=fs.mkdtempSync(path.join(os.tmpdir(),'bar-drift-'));
  ensureGitRepo(d); fs.writeFileSync(path.join(d,'x.txt'),'one'); execFileSync('git',['add','.'],{cwd:d}); execFileSync('git',['commit','-q','-m','one'],{cwd:d});
  const ids=gitIdentity(d); const state={candidate_sha:ids.candidate_sha,tree_hash:ids.tree_hash};
  fs.writeFileSync(path.join(d,'x.txt'),'two'); execFileSync('git',['add','.'],{cwd:d}); execFileSync('git',['commit','-q','-m','two'],{cwd:d});
  assert.throws(()=>assertWorkspaceIdentity(state,d),/POST_TEST_CANDIDATE_DRIFT|POST_TEST_TREE_DRIFT/);
});