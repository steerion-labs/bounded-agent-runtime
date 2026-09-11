import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCapabilityRegistry } from '../runtime/boundary/capability-registry.mjs';
import { decideBoundaryAuthority } from '../runtime/boundary/authority-engine.mjs';
import { createBoundaryVerificationEvidence } from '../runtime/boundary/evidence-contract.mjs';

const manifest = JSON.parse(fs.readFileSync(new URL('../examples/boundary-capabilities.example.json', import.meta.url), 'utf8'));
const registry = createCapabilityRegistry(manifest);
const corpus = JSON.parse(fs.readFileSync(new URL('./fixtures/adversarial-boundary-cases.json', import.meta.url), 'utf8'));

function task(overrides = {}) {
  return {
    task_id: 'adversarial-boundary-1',
    intent: 'bounded test task',
    allowed_capabilities: ['code.modify', 'browser.submit'],
    allowed_actions: ['build_local', 'browser_submit'],
    protected_actions: ['browser_submit'],
    data_class: 'internal',
    ...overrides
  };
}

function verified(boundTask, capability_id, action, role) {
  const state = {
    task_id: boundTask.task_id,
    task: boundTask,
    candidate_sha: 'a'.repeat(40),
    tree_hash: 'b'.repeat(40)
  };
  return { state, item: createBoundaryVerificationEvidence({ state, capability_id, action, role }) };
}

test('obfuscated natural-language intent never removes a protected Human Gate', () => {
  for (const intent of corpus.intent_variants) {
    const boundTask = task({ intent });
    const proof = verified(boundTask, 'browser.submit', 'browser_submit', 'operator');
    const result = decideBoundaryAuthority({
      task: boundTask,
      registry,
      capability_id: 'browser.submit',
      action: 'browser_submit',
      role: 'operator',
      evidence: [proof.item],
      controller_state: proof.state
    });
    assert.equal(result.decision, 'HUMAN_GATE_REQUIRED', intent);
  }
});

test('obfuscated capability and action identifiers fail closed under exact matching', () => {
  const boundTask = task();
  const proof = verified(boundTask, 'code.modify', 'build_local', 'builder');
  for (const mutation of corpus.identifier_mutations) {
    const input = {
      task: boundTask,
      registry,
      capability_id: 'code.modify',
      action: 'build_local',
      role: 'builder',
      evidence: [proof.item],
      controller_state: proof.state
    };
    input[mutation.field] = mutation.value;
    const result = decideBoundaryAuthority(input);
    assert.equal(result.decision, 'DENY', `${mutation.field}:${mutation.value}`);
    assert.equal(result.reason, mutation.reason, `${mutation.field}:${mutation.value}`);
  }
});

test('obfuscated task policy identifiers cannot authorize a real structured action', () => {
  for (const mutation of corpus.task_policy_mutations) {
    const boundTask = task(mutation.allowed_actions ? { allowed_actions: mutation.allowed_actions } : { allowed_capabilities: mutation.allowed_capabilities });
    const result = decideBoundaryAuthority({
      task: boundTask,
      registry,
      capability_id: 'code.modify',
      action: 'build_local',
      role: 'builder'
    });
    assert.equal(result.decision, 'DENY');
    assert.equal(result.reason, mutation.reason);
  }
});


test('malformed or obfuscated protected action policy fails closed before authorization', () => {
  for (const protected_actions of [['browser_subm\u200bit'], ['BROWSER_SUBMIT'], ['unknown_action']]) {
    const boundTask = task({ allowed_capabilities: ['code.modify'], allowed_actions: ['build_local'], protected_actions });
    const proof = verified(boundTask, 'code.modify', 'build_local', 'builder');
    const result = decideBoundaryAuthority({
      task: boundTask, registry, capability_id: 'code.modify', action: 'build_local', role: 'builder',
      evidence: [proof.item], controller_state: proof.state
    });
    assert.equal(result.decision, 'DENY');
    assert.equal(result.reason, 'PROTECTED_ACTION_POLICY_INVALID');
  }
});
