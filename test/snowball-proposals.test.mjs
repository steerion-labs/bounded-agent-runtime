import test from 'node:test';
import assert from 'node:assert/strict';
import { createSnowballProposals, assertSnowballProposalSafe } from '../runtime/boundary/snowball-proposals.mjs';

test('snowball groups repeated failures into one bounded proposal', () => {
  const proposals = createSnowballProposals([
    {type:'repeated_failure',task_id:'t1',capability_id:'code.modify',summary:'Launcher timeout',evidence_refs:['e1']},
    {type:'repeated_failure',task_id:'t2',capability_id:'code.modify',summary:'Launcher timeout',evidence_refs:['e2']}
  ]);
  assert.equal(proposals.length,1);
  assert.equal(proposals[0].occurrences,2);
  assert.deepEqual(proposals[0].task_ids,['t1','t2']);
  assert.deepEqual(proposals[0].evidence_refs,['e1','e2']);
  assert.equal(assertSnowballProposalSafe(proposals[0]),true);
});

test('single noisy success does not snowball by default', () => {
  const proposals=createSnowballProposals([{type:'successful_pattern',task_id:'t1',summary:'One lucky pass'}]);
  assert.equal(proposals.length,0);
});

test('user corrections and capability gaps surface immediately but remain authority-free', () => {
  for (const type of ['user_correction','capability_gap']) {
    const [proposal]=createSnowballProposals([{type,task_id:'t1',summary:'Needs bounded browser proof'}]);
    assert.equal(proposal.authority,'NONE');
    assert.equal(proposal.auto_mutation_allowed,false);
    assert.ok(proposal.forbidden_effects.includes('self_modify'));
    assert.ok(proposal.forbidden_effects.includes('auto_promote'));
    assert.equal(proposal.required_flow.at(-1),'HUMAN_PROMOTION_GATE');
  }
});

test('unsafe proposal mutation is rejected', () => {
  const [proposal]=createSnowballProposals([{type:'user_correction',summary:'x'}]);
  assert.throws(()=>assertSnowballProposalSafe({...proposal,auto_mutation_allowed:true}),/SNOWBALL_PROPOSAL_UNSAFE/);
  assert.throws(()=>assertSnowballProposalSafe({...proposal,forbidden_effects:[]}),/SNOWBALL_FORBIDDEN_EFFECTS_MISSING/);
});

test('invalid signal and threshold fail closed', () => {
  assert.throws(()=>createSnowballProposals([{type:'unknown',summary:'x'}]),/SNOWBALL_SIGNAL_INVALID/);
  assert.throws(()=>createSnowballProposals([], {minimum_occurrences:0}),/SNOWBALL_THRESHOLD_INVALID/);
});
