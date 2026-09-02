import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCapabilityRegistry } from '../runtime/boundary/capability-registry.mjs';
import { decideBoundaryAuthority } from '../runtime/boundary/authority-engine.mjs';
import { createBoundaryBinding, assertBoundaryBinding, assertNoAdapterFallback, assertNoProviderFallback } from '../runtime/boundary/binding.mjs';
import { routeAgent } from '../runtime/boundary/agent-router.mjs';
import { routeProvider } from '../runtime/boundary/provider-router.mjs';
import { createProviderRegistry, promoteProvider, enableVerifiedProvider } from '../runtime/boundary/provider-registry.mjs';
import { createExecutionPlan } from '../runtime/boundary/execution-planner.mjs';
import { observeImprovementSignals } from '../runtime/boundary/improvement-observer.mjs';
import { assessSkillCandidate } from '../runtime/boundary/skill-intake.mjs';
import { createBoundaryVerificationEvidence } from '../runtime/boundary/evidence-contract.mjs';

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


function controllerState(boundTask = task()) {
  return {
    task_id: boundTask.task_id,
    task: boundTask,
    candidate_sha: 'a'.repeat(40),
    tree_hash: 'b'.repeat(40)
  };
}
function verified(boundTask, capability_id, action, role) {
  const state=controllerState(boundTask);
  return { state, item:createBoundaryVerificationEvidence({state,capability_id,action,role}) };
}

test('capability registry validates and denies unknown capability lookup',()=>{
  assert.equal(registry.require('code.modify').id,'code.modify');
  assert.throws(()=>registry.require('unknown.capability'),/BOUNDARY_CAPABILITY_UNKNOWN/);
});
test('authority is deny-by-default and requires verification when declared',()=>{
  const capability=registry.require('code.modify');
  const denied=decideBoundaryAuthority({task:task(),registry,capability_id:'code.modify',action:'build_local',role:'builder',evidence:[]});
  assert.equal(denied.decision,'DENY'); assert.equal(denied.reason,'VERIFICATION_STATE_REQUIRED');
  const boundTask=task(); const proof=verified(boundTask,'code.modify','build_local','builder');
  const allowed=decideBoundaryAuthority({task:boundTask,registry,capability_id:'code.modify',action:'build_local',role:'builder',evidence:[proof.item],controller_state:proof.state});
  assert.equal(allowed.decision,'ALLOW_LOCAL');
});

test('protected capability action routes to Human Gate',()=>{
  const capability=registry.require('browser.submit');
  const boundTask=task(); const proof=verified(boundTask,'browser.submit','browser_submit','operator');
  const result=decideBoundaryAuthority({task:boundTask,registry,capability_id:'browser.submit',action:'browser_submit',role:'operator',evidence:[proof.item],controller_state:proof.state});
  assert.equal(result.decision,'HUMAN_GATE_REQUIRED');
});

test('binding detects mutation and blocks adapter or provider fallback',()=>{
  const input={task_id:'t1',capability_id:'research.search',action:'research_search',role:'researcher',adapter:'codex',provider:'p1',provider_policy_hash:'d'.repeat(64),data_class:'internal',candidate_sha:'a'.repeat(40),tree_hash:'b'.repeat(40)};
  const binding=createBoundaryBinding(input);
  assert.equal(assertBoundaryBinding(binding,input),true);
  assert.throws(()=>assertBoundaryBinding(binding,{...input,adapter:'claude'}),/BOUNDARY_BINDING_MISMATCH/);
  assert.throws(()=>assertNoAdapterFallback(binding,'claude'),/BOUNDARY_ADAPTER_REBIND_DENIED/);
  assert.throws(()=>assertNoProviderFallback(binding,'p2'),/BOUNDARY_PROVIDER_REBIND_DENIED/);
});
test('binding rejects missing candidate or tree identity',()=>{
  assert.throws(()=>createBoundaryBinding({task_id:'t1',capability_id:'research.search',action:'research_search',role:'researcher',adapter:'codex',data_class:'internal'}),/BOUNDARY_BINDING_INVALID/);
});

test('agent routing skips unauthenticated and role-unsafe adapters deterministically',()=>{
  const capability=registry.require('code.modify');
  const agents=[
    {name:'codex',installed:true,authenticated:true,safe_for_builder:false,ready_for_builder:true},
    {name:'claude',installed:true,authenticated:false,safe_for_builder:true,ready_for_builder:true},
    {name:'opencode',installed:true,authenticated:true,safe_for_builder:true,ready_for_builder:true}
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
  const boundTask=task(); const proof=verified(boundTask,'browser.submit','browser_submit','operator');
  const plan=createExecutionPlan({task:boundTask,registry,capability_id:'browser.submit',action:'browser_submit',role:'operator',agents:[{name:'container',installed:true,authenticated:true,safe_for_operator:true,ready_for_operator:true}],evidence:[proof.item],controller_state:proof.state});
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
  const agents=[{name:'codex',installed:true,authenticated:true,safe_for_researcher:true,ready_for_researcher:true}];
  const providers=[{name:'internal-provider',available:true,authenticated:true,priority:1}];
  const verifiedProvider=enableVerifiedProvider(promoteProvider({id:'internal-provider',trust:'DISCOVERY_ONLY'},{official_docs:'https://example.invalid/official',allowed_data_classes:['internal'],capabilities:['research.search']}));
  const providerRegistry=createProviderRegistry([verifiedProvider]);
  const boundTask=task(); const state={...controllerState(boundTask),provider_policy_hash:providerRegistry.policy_sha256};
  const plan=createExecutionPlan({task:boundTask,registry,capability_id:'research.search',action:'research_search',role:'researcher',agents,providers,provider_registry:providerRegistry,controller_state:state});
  assert.equal(plan.executable,true);
  assert.equal(plan.route.agent.adapter,'codex'); assert.equal(plan.route.provider.provider,'internal-provider');
  assert.equal(plan.binding.adapter,'codex'); assert.equal(plan.binding.provider,'internal-provider');
});


test('spoofed or wrong-candidate verification evidence cannot authorize',()=>{
  const boundTask=task(); const state=controllerState(boundTask);
  const spoof={claim:'boundary_verification',producer_identity:'controller',trust_class:'CONTROLLER_VERIFIED',status:'VALID',task_id:boundTask.task_id,candidate_sha:state.candidate_sha,tree_hash:state.tree_hash,payload_hash:'fake',integrity_hmac:'fake'};
  const spoofed=decideBoundaryAuthority({task:boundTask,registry,capability_id:'code.modify',action:'build_local',role:'builder',evidence:[spoof],controller_state:state});
  assert.equal(spoofed.reason,'VERIFICATION_REQUIRED');
  const proof=verified(boundTask,'code.modify','build_local','builder');
  const drifted={...proof.state,candidate_sha:'c'.repeat(40)};
  const wrongCandidate=decideBoundaryAuthority({task:boundTask,registry,capability_id:'code.modify',action:'build_local',role:'builder',evidence:[proof.item],controller_state:drifted});
  assert.equal(wrongCandidate.reason,'VERIFICATION_REQUIRED');
});

test('agent router requires explicit auth safety and readiness true',()=>{
  const capability=registry.require('code.modify');
  assert.throws(()=>routeAgent({role:'builder',capability,agents:[{name:'codex',installed:true,authenticated:true,safe_for_builder:true}]}),/BOUNDARY_AGENT_UNAVAILABLE/);
  assert.throws(()=>routeAgent({role:'builder',capability,agents:[{name:'codex',installed:true,ready_for_builder:true,safe_for_builder:true}]}),/BOUNDARY_AGENT_UNAVAILABLE/);
});

test('provider router rejects nameless or unknown-auth providers',()=>{
  const base={available:true,authenticated:true,capabilities:['research.search'],allowed_data_classes:['internal']};
  assert.throws(()=>routeProvider({capability_id:'research.search',data_class:'internal',providers:[base]}),/BOUNDARY_PROVIDER_UNAVAILABLE/);
  assert.throws(()=>routeProvider({capability_id:'research.search',data_class:'internal',providers:[{...base,name:'p',authenticated:undefined}]}),/BOUNDARY_PROVIDER_UNAVAILABLE/);
});

test('binding covers data class and exact candidate tree identity',()=>{
  const input={task_id:'t1',capability_id:'research.search',action:'research_search',role:'researcher',adapter:'codex',provider:'p1',provider_policy_hash:'d'.repeat(64),data_class:'internal',candidate_sha:'a'.repeat(40),tree_hash:'b'.repeat(40)};
  const binding=createBoundaryBinding(input);
  assert.throws(()=>assertBoundaryBinding(binding,{...input,data_class:'public'}),/BOUNDARY_BINDING_MISMATCH/);
  assert.throws(()=>assertBoundaryBinding(binding,{...input,tree_hash:'c'.repeat(40)}),/BOUNDARY_BINDING_MISMATCH/);
});


test('execution planner denies any run without exact controller candidate and tree',()=>{
  const agents=[{name:'codex',installed:true,authenticated:true,safe_for_researcher:true,ready_for_researcher:true}];
  const providers=[{name:'p',available:true,authenticated:true,priority:1,capabilities:['research.search'],allowed_data_classes:['internal']}];
  const plan=createExecutionPlan({task:task(),registry,capability_id:'research.search',action:'research_search',role:'researcher',agents,providers});
  assert.equal(plan.executable,false); assert.equal(plan.authority.reason,'CONTROLLER_CANDIDATE_REQUIRED');
});

test('controller task binding is canonical and independent of object key order',()=>{
  const original=task(); const proof=verified(original,'code.modify','build_local','builder');
  const reordered={data_class:original.data_class,protected_actions:original.protected_actions,allowed_actions:original.allowed_actions,allowed_capabilities:original.allowed_capabilities,task_id:original.task_id};
  const result=decideBoundaryAuthority({task:reordered,registry,capability_id:'code.modify',action:'build_local',role:'builder',evidence:[proof.item],controller_state:proof.state});
  assert.equal(result.decision,'ALLOW_LOCAL');
});


test('verification evidence cannot exist without exact candidate and tree',()=>{
  const boundTask=task();
  const incomplete={task_id:boundTask.task_id,task:boundTask,candidate_sha:null,tree_hash:null};
  assert.throws(()=>createBoundaryVerificationEvidence({state:incomplete,capability_id:'code.modify',action:'build_local',role:'builder'}),/BOUNDARY_EVIDENCE_CANDIDATE_REQUIRED/);
  const result=decideBoundaryAuthority({task:boundTask,registry,capability_id:'code.modify',action:'build_local',role:'builder',evidence:[],controller_state:incomplete});
  assert.equal(result.decision,'DENY'); assert.equal(result.reason,'VERIFICATION_STATE_REQUIRED');
});

test('policy set ordering does not change controller task identity',()=>{
  const original=task(); const proof=verified(original,'code.modify','build_local','builder');
  const reordered={...original,allowed_capabilities:[...original.allowed_capabilities].reverse(),allowed_actions:[...original.allowed_actions].reverse(),protected_actions:[...original.protected_actions].reverse()};
  const result=decideBoundaryAuthority({task:reordered,registry,capability_id:'code.modify',action:'build_local',role:'builder',evidence:[proof.item],controller_state:proof.state});
  assert.equal(result.decision,'ALLOW_LOCAL');
});

test('community provider catalog entries are discovery-only and never routable',()=>{
  const catalog=JSON.parse(fs.readFileSync(new URL('../examples/provider-discovery.example.json',import.meta.url),'utf8'));
  const providerRegistry=createProviderRegistry(catalog.providers);
  assert.equal(providerRegistry.list().length,14);
  assert.equal(providerRegistry.routable('groq'),false);
  assert.throws(()=>routeProvider({capability_id:'research.search',data_class:'public',providers:[{name:'groq',available:true,authenticated:true}],registry:providerRegistry}),/BOUNDARY_PROVIDER_UNAVAILABLE/);
});

test('provider promotion requires official verification and explicit enablement',()=>{
  const discovered={id:'groq',display_name:'Groq',source:'community-catalog',trust:'DISCOVERY_ONLY',enabled:false};
  assert.throws(()=>promoteProvider(discovered,{}),/OFFICIAL_VERIFICATION_REQUIRED/);
  const verified=promoteProvider(discovered,{official_docs:'https://example.invalid/official',allowed_data_classes:['public'],capabilities:['research.search']});
  assert.equal(verified.trust,'VERIFIED'); assert.equal(verified.enabled,false);
  const enabled=enableVerifiedProvider(verified); assert.equal(enabled.enabled,true);
  const providerRegistry=createProviderRegistry([enabled]);
  const route=routeProvider({capability_id:'research.search',data_class:'public',providers:[{name:'groq',available:true,authenticated:true,priority:1}],registry:providerRegistry});
  assert.equal(route.provider,'groq'); assert.equal(route.registry_enforced,true);
});

test('provider registry prevents data-class escalation and silent free-provider substitution',()=>{
  const verified=enableVerifiedProvider(promoteProvider({id:'public-free',trust:'DISCOVERY_ONLY'},{official_docs:'https://example.invalid/official',allowed_data_classes:['public'],capabilities:['research.search']}));
  const providerRegistry=createProviderRegistry([verified]);
  assert.throws(()=>routeProvider({capability_id:'research.search',data_class:'internal',providers:[{name:'public-free',available:true,authenticated:true}],registry:providerRegistry}),/BOUNDARY_PROVIDER_UNAVAILABLE/);
});

test('external provider execution requires controller-bound provider registry',()=>{
  const agents=[{name:'codex',installed:true,authenticated:true,safe_for_researcher:true,ready_for_researcher:true}];
  const providers=[{name:'pp',available:true,authenticated:true,priority:1}];
  const boundTask=task(); const state=controllerState(boundTask);
  const missing=createExecutionPlan({task:boundTask,registry,capability_id:'research.search',action:'research_search',role:'researcher',agents,providers,controller_state:state});
  assert.equal(missing.executable,false); assert.equal(missing.authority.reason,'PROVIDER_REGISTRY_REQUIRED');
});

test('provider policy hash drift fails closed before routing',()=>{
  const agents=[{name:'codex',installed:true,authenticated:true,safe_for_researcher:true,ready_for_researcher:true}];
  const providers=[{name:'pp',available:true,authenticated:true,priority:1}];
  const enabled=enableVerifiedProvider(promoteProvider({id:'pp',trust:'DISCOVERY_ONLY'},{official_docs:'https://example.invalid/official',allowed_data_classes:['internal'],capabilities:['research.search']}));
  const providerRegistry=createProviderRegistry([enabled]);
  const boundTask=task(); const state={...controllerState(boundTask),provider_policy_hash:'f'.repeat(64)};
  const plan=createExecutionPlan({task:boundTask,registry,capability_id:'research.search',action:'research_search',role:'researcher',agents,providers,provider_registry:providerRegistry,controller_state:state});
  assert.equal(plan.executable,false); assert.equal(plan.authority.reason,'PROVIDER_POLICY_MISMATCH');
});
test('raw provider input cannot self-assert VERIFIED authority',()=>{
  const forged={
    id:'forged-free', trust:'VERIFIED', enabled:true,
    official_docs:'https://attacker.invalid/claim',
    capabilities:['research.search'], allowed_data_classes:['public']
  };
  assert.throws(()=>createProviderRegistry([forged]),/BOUNDARY_PROVIDER_VERIFIED_INPUT_FORBIDDEN/);
});
