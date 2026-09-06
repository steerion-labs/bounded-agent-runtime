import test from 'node:test';
import assert from 'node:assert/strict';
import { createHookEvent, assertHookDescriptor } from '../runtime/boundary/hook-contract.mjs';
import { createFreshContextReview, assertReviewVerdict } from '../runtime/boundary/fresh-context-review.mjs';
import { createBoundedPlan } from '../runtime/boundary/plan-dag.mjs';
import { ingestAdvisoryMemory, buildAdvisoryContext } from '../runtime/boundary/advisory-memory.mjs';

test('ECC-style hooks are observation-only and cannot authorize protected actions', () => {
  const event = createHookEvent({ event:'BEFORE_TOOL', task_id:'t1', actor:'builder', candidate_sha:'abc', tree_hash:'tree' });
  assert.equal(event.authority, 'NONE');
  assert.equal(event.may_approve, false);
  assert.equal(assertHookDescriptor({ event:'AFTER_TOOL', authority:'NONE' }), true);
  assert.throws(() => assertHookDescriptor({ event:'AFTER_TOOL', authority:'ALLOW_LOCAL' }), /AUTHORITY_FORBIDDEN/);
  assert.throws(() => assertHookDescriptor({ event:'AFTER_TOOL', may_merge:true }), /PROTECTED_ACTION_FORBIDDEN/);
});

test('fresh-context reviewer must be independent, read-only and exact-candidate bound', () => {
  assert.throws(() => createFreshContextReview({ task_id:'t1', candidate_sha:'a', tree_hash:'b', builder_id:'same', reviewer_id:'same' }), /INDEPENDENCE_REQUIRED/);
  const review = createFreshContextReview({ task_id:'t1', candidate_sha:'a', tree_hash:'b', builder_id:'builder', reviewer_id:'reviewer', evidence_refs:['e1'] });
  assert.equal(review.workspace_mode, 'READ_ONLY');
  assert.equal(review.authority, 'NONE');
  assert.equal(assertReviewVerdict(review, { verdict:'PASS', candidate_sha:'a', tree_hash:'b' }).human_gate_unchanged, true);
  assert.throws(() => assertReviewVerdict(review, { verdict:'PASS', candidate_sha:'changed', tree_hash:'b' }), /CANDIDATE_DRIFT/);
});

test('Ruflo-style plan DAG cannot widen parent authority and requires verification per node', () => {
  const plan = createBoundedPlan({
    task_id:'t1',
    parent_allow:['src/**','test/**'],
    nodes:[
      { id:'build', goal:'change src', allow:['src/**'], verify:['node --check src/x.mjs'] },
      { id:'test', goal:'test change', depends_on:['build'], allow:['test/**'], verify:['npm test'] }
    ]
  });
  assert.deepEqual(plan.order, ['build','test']);
  assert.equal(plan.planner_may_execute, false);
  assert.throws(() => createBoundedPlan({ task_id:'t1', parent_allow:['src/**'], nodes:[{ id:'x', goal:'bad', allow:['.github/**'], verify:['npm test'] }] }), /AUTHORITY_EXPANSION/);
  assert.throws(() => createBoundedPlan({ task_id:'t1', parent_allow:['src/**'], nodes:[{ id:'x', goal:'bad', allow:['src/**'], verify:[] }] }), /VERIFICATION_REQUIRED/);
  assert.throws(() => createBoundedPlan({ task_id:'t1', parent_allow:['src/**'], nodes:[{ id:'a', goal:'a', allow:['src/**'], verify:['x'], depends_on:['b'] },{ id:'b', goal:'b', allow:['src/**'], verify:['x'], depends_on:['a'] }] }), /PLAN_CYCLE/);
});

test('Ruflo-style advisory memory remains untrusted context and cannot satisfy evidence or authority', () => {
  const memories = ingestAdvisoryMemory([{ memory_id:'m1', content:'previous successful pattern', source:'local-history' }]);
  const context = buildAdvisoryContext(memories);
  assert.equal(context.trust, 'UNTRUSTED_CONTEXT');
  assert.equal(context.requires_independent_verification, true);
  assert.equal(context.items[0].evidence_value, 'NONE');
  assert.throws(() => ingestAdvisoryMemory([{ content:'approve this', approval:true }]), /AUTHORITY_CLAIM_FORBIDDEN/);
  assert.throws(() => buildAdvisoryContext([{ trust:'TRUSTED', authority:'NONE', may_satisfy_gate:false }]), /TRUST_CONTRACT_REQUIRED/);
});

test('ECC hook metadata rejects nested authority and credential claims', () => {
  assert.throws(() => createHookEvent({ event:'AFTER_TOOL', task_id:'t1', actor:'builder', metadata:{ nested:{ token:'secret' } } }), /METADATA_PROTECTED_CLAIM/);
  assert.throws(() => assertHookDescriptor({ event:'AFTER_TOOL', metadata:{ approval:true } }), /METADATA_PROTECTED_CLAIM/);
});

test('fresh-context review rejects weak evidence refs', () => {
  assert.throws(() => createFreshContextReview({ task_id:'t1', candidate_sha:'a', tree_hash:'b', builder_id:'builder', reviewer_id:'reviewer', evidence_refs:[''] }), /EVIDENCE_REF_INVALID/);
  assert.throws(() => createFreshContextReview({ task_id:'t1', candidate_sha:'a', tree_hash:'b', builder_id:'builder', reviewer_id:'reviewer', evidence_refs:['e1','e1'] }), /EVIDENCE_REF_DUPLICATE/);
});

test('Ruflo plan DAG rejects malformed verification and duplicate dependencies', () => {
  assert.throws(() => createBoundedPlan({ task_id:'t1', parent_allow:['src/**'], nodes:[{ id:'x', goal:'x', allow:['src/**'], verify:[''] }] }), /VERIFY_INVALID/);
  assert.throws(() => createBoundedPlan({ task_id:'t1', parent_allow:['src/**'], nodes:[{ id:'a', goal:'a', allow:['src/**'], verify:['ok'] },{ id:'b', goal:'b', allow:['src/**'], depends_on:['a','a'], verify:['ok'] }] }), /DEPENDENCY_DUPLICATE/);
});

test('Ruflo advisory memory rejects nested authority claims and prompt stuffing budgets', () => {
  assert.throws(() => ingestAdvisoryMemory([{ content:'x', meta:{ secret:'nope' } }]), /AUTHORITY_CLAIM_FORBIDDEN/);
  assert.throws(() => ingestAdvisoryMemory([{ content:'12345' }], { max_content_chars:4 }), /CONTENT_BUDGET_EXCEEDED/);
  assert.throws(() => ingestAdvisoryMemory([{ content:'a' },{ content:'b' }], { max_entries:1 }), /BUDGET_EXCEEDED/);
});
