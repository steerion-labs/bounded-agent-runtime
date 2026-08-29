import fs from 'node:fs';
import {
  RUNTIME_DIR, ensureRuntimeDir, loadState, saveState, journal, transition,
  newLease, assertCurrentLease, evidence, validateTask, authorize, spendBudget,
  assertRuntimeBudget, assertBoundEvidence, assertHumanApproval, readJson,
  createGateChallenge, verifyGateSignature, recoverState
} from './core.mjs';
import { runBuilder } from './adapters/demo-builder.mjs';
import { runReviewer } from './adapters/demo-reviewer.mjs';
const command = process.argv[2], arg = process.argv[3];
const fail = m => { console.error(m); process.exitCode = 1; };
function initialState(task) {
  return { schema_version:1, task_id:task.task_id, state:'NEW', state_version:0,
    started_at:new Date().toISOString(), task, lease:newLease(task.task_id),
    budget:{ limits:task.budget, used:{ model_calls:0, retries:0 } }, evidence:[],
    candidate_sha:null, tree_hash:null, gate_challenge:null, human_approval:null };
}
function init(file) {
  if (!file) throw new Error('TASK_FILE_REQUIRED');
  const task=validateTask(readJson(file)); fs.rmSync(RUNTIME_DIR,{recursive:true,force:true});
  ensureRuntimeDir(); const state=initialState(task); saveState(state);
  journal('RUNTIME_INITIALIZED',{task_id:state.task_id}); console.log(`INITIALIZED ${state.task_id}`);
}async function run() {
  const state=loadState(); assertCurrentLease(state); assertRuntimeBudget(state); validateTask(state.task);
  if (state.state==='HUMAN_GATE') { console.log('HUMAN_GATE_REQUIRED'); return; }
  if (state.state!=='NEW') throw new Error(`SAFE_RESUME_REQUIRED:${state.state}`);
  transition(state,'CLASSIFIED'); transition(state,'CONTEXT_READY'); authorize(state.task,'build_local');
  transition(state,'AUTHORIZED'); spendBudget(state,{model_calls:1}); assertRuntimeBudget(state); transition(state,'BUILDING');
  const candidate=await runBuilder(state.task); assertCurrentLease(state); assertRuntimeBudget(state);
  state.candidate_sha=candidate.candidate_sha; state.tree_hash=candidate.tree_hash; state.workspace_path=candidate.repository; saveState(state);
  transition(state,'TESTING',evidence('builder_candidate',candidate,state,'builder','CONTROLLER_OBSERVED'));
  if(candidate.status!=='PASS') throw new Error('BUILDER_TEST_FAILED');
  transition(state,'HANDOFF_VALIDATION'); assertBoundEvidence(state,candidate); transition(state,'REVIEWING');
  spendBudget(state,{model_calls:1}); assertRuntimeBudget(state); const review=await runReviewer(candidate); assertCurrentLease(state);
  if(review.decision!=='APPROVE') throw new Error(`REVIEW_BLOCKED:${review.reason??'unknown'}`);
  if(review.reviewed_candidate_sha!==state.candidate_sha) throw new Error('REVIEW_CANDIDATE_MISMATCH');
  if(review.reviewed_tree_hash!==state.tree_hash) throw new Error('REVIEW_TREE_MISMATCH');
  const reviewPayload={...review,candidate_sha:state.candidate_sha,tree_hash:state.tree_hash};
  transition(state,'REVIEW_READY',evidence('independent_review',reviewPayload,state,'reviewer','CONTROLLER_OBSERVED'));
  transition(state,'HUMAN_GATE'); state.gate_challenge=createGateChallenge(state); saveState(state);
  journal('HUMAN_GATE_CHALLENGE',{task_id:state.task_id,state_version:state.state_version});
  console.log('HUMAN_GATE_REQUIRED'); console.log(JSON.stringify(state.gate_challenge,null,2));
}function approve(sig) {
  const state=loadState(); assertCurrentLease(state); assertRuntimeBudget(state);
  if(state.state!=='HUMAN_GATE') throw new Error(`APPROVAL_NOT_ALLOWED_IN:${state.state}`);
  if(!sig) throw new Error('APPROVAL_SIGNATURE_REQUIRED');
  const key=process.env.BOUNDED_AGENT_APPROVAL_PUBLIC_KEY; if(!key) throw new Error('APPROVAL_PUBLIC_KEY_REQUIRED');
  verifyGateSignature(state.gate_challenge,sig,fs.readFileSync(key,'utf8'));
  state.human_approval={...state.gate_challenge,approved_at:new Date().toISOString()};
  const approvalPayload={...state.human_approval,candidate_sha:state.candidate_sha,tree_hash:state.tree_hash};
  transition(state,'ACCEPTED',evidence('human_approval',approvalPayload,state,'human','CRYPTOGRAPHICALLY_VERIFIED'));
  assertHumanApproval(state,'remote_mutation'); console.log('ACCEPTED_NO_REMOTE_MUTATION_EXECUTED');
}
function recover(){const state=loadState(); console.log(recoverState(state));}
function reset(){fs.rmSync(RUNTIME_DIR,{recursive:true,force:true});console.log('RESET');}
try {
  if(command==='init') init(arg); else if(command==='run') await run();
  else if(command==='approve') approve(arg); else if(command==='recover') recover(); else if(command==='reset') reset();
  else throw new Error('USAGE:init <task.json> | run | approve <signature> | reset');
} catch(e) { fail(e instanceof Error ? e.message : String(e)); }

