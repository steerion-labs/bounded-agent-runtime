import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCapabilityRegistry } from '../runtime/boundary/capability-registry.mjs';
import { decideBoundaryAuthority } from '../runtime/boundary/authority-engine.mjs';
import { createBoundaryBinding, assertBoundaryBinding, assertNoAdapterFallback, assertNoProviderFallback } from '../runtime/boundary/binding.mjs';
import { routeAgent } from '../runtime/boundary/agent-router.mjs';
import { routeProvider } from '../runtime/boundary/provider-router.mjs';
import { createExecutionPlan } from '../runtime/boundary/execution-planner.mjs';
import { observeImprovementSignals } from '../runtime/boundary/improvement-observer.mjs';
import { assessSkillCandidate } from '../runtime/boundary/skill-intake.mjs';

const manifest = JSON.parse(fs.readFileSync(new URL('../examples/boundary-capabilities.example.json', import.meta.url), 'utf8'));
const registry = createCapabilityRegistry(manifest);

function task(overrides={}) {
  return {
    task_id: 'boundary-task-1',
    allowed_capabilities: ['code.modify','browser.submit','research.search'],
    allowed_actions: ['build_local','browser_submit','research_search'],
    protected_actions: ['browser_submit'],
    data_class: 'internal',
    ...overrides
  };
}

test('capability registry validates and denies unknown capability lookup',()=>{
  assert.equal(registry.require('code.modify').id,'code.modify');
  assert.throws(()=>registry.require('unknown.capability'),/BOUNDARY_CAPABILITY_UNKNOWN/);
});
test('authority is deny-by-default and requires verification when declared',()=>{
  const capability=registry.require('code.modify');
  const denied=decideBoundaryAuthority({task:task(),registry,capability_id:'code.modify',action:'build_local',role:'builder',evidence:[]});
  assert.equal(denied.decision,'DENY'); assert.equal(denied.reason,'VERIFICATION_REQUIRED');
  const allowed=decideBoundaryAuthority({task:task(),registry,capability_id:'code.modify',action:'build_local',role:'builder',evidence:[{kind:'verification',passed:true,capability_id:'code.modify'}]});
  assert.equal(allowed.decision,'ALLOW_LOCAL');
});

test('protected capability action routes to Human Gate',()=>{
  const capability=registry.require('browser.submit');
  const result=decideBoundaryAuthority({task:task(),registry,capability_id:'browser.submit',action:'browser_submit',role:'operator',evidence:[{kind:'verification',passed:true,capability_id:'browser.submit'}]});
  assert.equal(result.decision,'HUMAN_GATE_REQUIRED');
});

test('binding detects mutation and blocks adapter or provider fallback',()=>{
  const input={task_id:'t1',capability_id:'research.search',action:'research_search',role:'researcher',adapter:'codex',provider:'p1'};
  const binding=createBoundaryBinding(input);
  assert.equal(assertBoundaryBinding(binding,input),true);
  assert.throws(()=>assertBoundaryBinding(binding,{...input,adapter:'claude'}),/BOUNDARY_BINDING_MISMATCH/);
  assert.throws(()=>assertNoAdapterFallback(binding,'claude'),/BOUNDARY_ADAPTER_REBIND_DENIED/);
  assert.throws(()=>assertNoProviderFallback(binding,'p2'),/BOUNDARY_PROVIDER_REBIND_DENIED/);
});
test('agent routing skips unauthenticated and role-unsafe adapters deterministically',()=>{
  const capability=registry.require('code.modify');
  const agents=[
    {name:'codex',installed:true,authenticated:true,safe_for_builder:false},
    {name:'claude',installed:true,authenticated:false},
    {name:'opencode',installed:true,authenticated:true,safe_for_builder:true}
  ];
  assert.equal(routeAgent({role:'builder',capability,agents}).adapter,'opencode');
});

test('provider routing respects data classification and deterministic priority',()=>{
  const providers=[
    {name:'free-public',available:true,authenticated:true,priority:1,capabilities:['research.search'],allowed_data_classes:['public']},
    {name:'internal-safe',available:true,authenticated:true,priority:2,capabilities:['research.search'],allowed_data_classes:['public','internal']}
  ];
  assert.equal(routeProvider({capability_id:'research.search',data_class:'internal',providers}).provider,'internal-safe');
  assert.throws(()=>routeProvider({capability_id:'research.search',data_class:'secret',providers}),/BOUNDARY_PROVIDER_UNAVAILABLE/);
});

test('execution plan cannot execute while Human Gate is required',()=>{
  const capability=registry.require('browser.submit');
  const plan=createExecutionPlan({task:task(),registry,capability_id:'browser.submit',action:'browser_submit',role:'operator',agents:[{name:'container',installed:true}],evidence:[{kind:'verification',passed:true,capability_id:'browser.submit'}]});
  assert.equal(plan.executable,false); assert.equal(plan.human_gate_required,true); assert.ok(plan.binding.binding_sha256);
});
test('improvement observer proposes but never self-modifies',()=>{
  const [proposal]=observeImprovementSignals([{type:'repeated_failure',task_id:'t1',capability_id:'code.modify',summary:'Launcher failed twice'}]);
  assert.equal(proposal.status,'PROPOSED'); assert.equal(proposal.auto_mutation_allowed,false);
  assert.deepEqual(proposal.required_flow,['INTAKE','SECURITY_REVIEW','TEST','INDEPENDENT_REVIEW','PROMOTION_GATE']);
});

test('skill intake never directly promotes discovered skills',()=>{
  const candidate=assessSkillCandidate({name:'find-skills-result',source:'https://github.com/example/skill',license:'MIT',surfaces:['network','filesystem-write']});
  assert.equal(candidate.decision,'LABS_REVIEW_REQUIRED'); assert.equal(candidate.direct_promotion_allowed,false);
  const rejected=assessSkillCandidate({name:'unsafe',source:'https://github.com/example/unsafe',license:'MIT',auto_install:true,surfaces:['shell']});
  assert.equal(rejected.decision,'REJECT'); assert.ok(rejected.blockers.includes('AUTO_INSTALL_FORBIDDEN'));
});

test('unknown or ungranted capability remains denied',()=>{
  const capability=registry.require('knowledge.read');
  const result=decideBoundaryAuthority({task:task(),registry,capability_id:'knowledge.read',action:'knowledge_read',role:'reviewer'});
  assert.equal(result.decision,'DENY'); assert.equal(result.reason,'CAPABILITY_NOT_ALLOWED');
});

test('authority enforces task data classification against capability policy',()=>{
  const result=decideBoundaryAuthority({
    task:task({data_class:'secret'}),registry,capability_id:'research.search',action:'research_search',role:'researcher'
  });
  assert.equal(result.decision,'DENY'); assert.equal(result.reason,'DATA_CLASS_NOT_ALLOWED');
});

test('execution planner deterministically routes and binds agent plus provider',()=>{
  const agents=[{name:'codex',installed:true,authenticated:true,safe_for_researcher:true}];
  const providers=[{name:'internal-provider',available:true,authenticated:true,priority:1,capabilities:['research.search'],allowed_data_classes:['internal']}];
  const plan=createExecutionPlan({task:task(),registry,capability_id:'research.search',action:'research_search',role:'researcher',agents,providers});
  assert.equal(plan.executable,true);
  assert.equal(plan.route.agent.adapter,'codex'); assert.equal(plan.route.provider.provider,'internal-provider');
  assert.equal(plan.binding.adapter,'codex'); assert.equal(plan.binding.provider,'internal-provider');
});
