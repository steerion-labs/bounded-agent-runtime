import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { assertTransition } from './state-machine.mjs';

export const RUNTIME_DIR = '.bounded-agent';
export const STATE_FILE = path.join(RUNTIME_DIR, 'state.json');
export const JOURNAL_FILE = path.join(RUNTIME_DIR, 'journal.jsonl');
export const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
export const ensureRuntimeDir = () => fs.mkdirSync(RUNTIME_DIR, { recursive: true });
export const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
export function loadState() { if (!fs.existsSync(STATE_FILE)) throw new Error('RUNTIME_NOT_INITIALIZED'); return readJson(STATE_FILE); }
export function saveState(state) { ensureRuntimeDir(); fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n'); }
export function journal(event, details = {}) { ensureRuntimeDir(); fs.appendFileSync(JOURNAL_FILE, JSON.stringify({ at: new Date().toISOString(), event, ...details }) + '\n'); }
export function transition(state, to, proof = null) { assertTransition(state.state, to); const from=state.state; state.state=to; state.state_version+=1; if(proof) state.evidence.push(proof); journal('STATE_TRANSITION',{task_id:state.task_id,from,to,state_version:state.state_version}); saveState(state); return state; }
export function newLease(taskId, ttlMs=300000, generation=Date.now()) { return {task_id:taskId,owner:`controller-${process.pid}`,generation,expires_at:new Date(Date.now()+ttlMs).toISOString(),fencing_token:sha256(`${taskId}:${generation}:${crypto.randomUUID()}`)}; }
export function assertFreshLease(lease, expectedGeneration=lease?.generation) { if(!lease||Date.parse(lease.expires_at)<=Date.now()) throw new Error('STALE_LEASE'); if(lease.generation!==expectedGeneration) throw new Error('FENCING_MISMATCH'); }
export function assertCurrentLease(localState) { assertFreshLease(localState.lease,localState.lease.generation); const p=loadState(); if(p.lease.generation!==localState.lease.generation) throw new Error('STALE_CONTROLLER_GENERATION'); if(p.lease.fencing_token!==localState.lease.fencing_token) throw new Error('STALE_CONTROLLER_FENCE'); }
export function assertBudget(state, delta={}) { if(state.started_at && state.budget?.limits?.wall_clock_seconds!==undefined && Date.now()-Date.parse(state.started_at)>state.budget.limits.wall_clock_seconds*1000) throw new Error(`BUDGET_EXCEEDED:wall_clock_seconds`); for(const [k,v] of Object.entries(delta)){const limit=state.budget?.limits?.[k]??0; const used=state.budget?.used?.[k]??0; if(used+v>limit) throw new Error(`BUDGET_EXCEEDED:${k}`);} }
export function spendBudget(state,delta={}) { assertBudget(state,delta); for(const [k,v] of Object.entries(delta)) state.budget.used[k]=(state.budget.used[k]??0)+v; saveState(state); }
export function assertRuntimeBudget(state, now=Date.now()) { const elapsed=Math.ceil((now-Date.parse(state.started_at))/1000); if(elapsed>(state.budget.limits.wall_clock_seconds??0)) throw new Error('BUDGET_EXCEEDED:wall_clock_seconds'); if((state.budget.used.retries??0)>(state.budget.limits.retries??0)) throw new Error('BUDGET_EXCEEDED:retries'); return elapsed; }
export function evidence(claim,payload,stateOrOptions={},producer='controller',trustClass='CONTROLLER_VERIFIED'){const isState=Boolean(stateOrOptions.task_id&&stateOrOptions.task);const state=isState?stateOrOptions:{};const options=isState?{}:stateOrOptions;return {evidence_id:crypto.randomUUID(),task_id:payload.task_id??state.task_id,claim,producer_identity:options.producer_identity??producer,trust_class:trustClass,candidate_sha:payload.candidate_sha??state.candidate_sha,tree_hash:payload.tree_hash??state.tree_hash,input_hash:sha256(JSON.stringify(state.task??payload.task_id??'')),payload_hash:sha256(JSON.stringify(payload)),created_at:new Date().toISOString(),status:'VALID'};}
export function validateTask(task){for(const k of ['schema_version','task_id','intent','allowed_actions','allowed_paths','budget','protected_actions']) if(task[k]===undefined) throw new Error(`TASK_FIELD_MISSING:${k}`); if(!Array.isArray(task.allowed_actions)||!Array.isArray(task.allowed_paths)) throw new Error('TASK_ARRAY_INVALID'); for(const k of ['model_calls','wall_clock_seconds','retries']) if(!Number.isFinite(task.budget[k])||task.budget[k]<0) throw new Error(`TASK_BUDGET_INVALID:${k}`); return task;}
export function authorize(task,action){if(!task.allowed_actions.includes(action)) throw new Error(`CAPABILITY_DENIED:${action}`); return true;}
export function assertBoundEvidence(state,candidate){if(candidate.task_id!==state.task_id) throw new Error('TASK_BINDING_MISMATCH'); if(candidate.candidate_sha!==state.candidate_sha) throw new Error('CANDIDATE_BINDING_MISMATCH'); if(candidate.tree_hash!==state.tree_hash) throw new Error('TREE_BINDING_MISMATCH');}
export function gitIdentity(repo){const candidate_sha=execFileSync('git',['-C',repo,'rev-parse','HEAD'],{encoding:'utf8'}).trim(); const tree_hash=execFileSync('git',['-C',repo,'rev-parse','HEAD^{tree}'],{encoding:'utf8'}).trim(); return {candidate_sha,tree_hash};}
export function requiresHumanGate(action){return ['merge','deploy','release','remote_mutation','policy_change','permission_change','secret_change'].includes(action);}
export function assertHumanApproval(state,action){if(requiresHumanGate(action)&&state.state!=='ACCEPTED') throw new Error(`HUMAN_GATE_REQUIRED:${action}`);}
export function createGateChallenge(state){return {task_id:state.task_id,candidate_sha:state.candidate_sha,tree_hash:state.tree_hash,state_version:state.state_version,nonce:crypto.randomUUID()};}
export function canonicalGatePayload(c){const {task_id,candidate_sha,tree_hash,state_version,nonce}=c; return JSON.stringify({task_id,candidate_sha,tree_hash,state_version,nonce});}
export function verifyGateSignature(c,s,p){if(!c||!s||!p) throw new Error('GATE_SIGNATURE_INPUT_MISSING'); if(!crypto.verify(null,Buffer.from(canonicalGatePayload(c)),p,Buffer.from(s,'base64'))) throw new Error('INVALID_HUMAN_GATE_SIGNATURE'); return true;}

export function ensureGitRepo(repo) {
  fs.mkdirSync(repo,{recursive:true});
  try { execFileSync('git',['-C',repo,'rev-parse','--git-dir'],{stdio:'ignore'}); }
  catch { execFileSync('git',['init','-q',repo]); execFileSync('git',['-C',repo,'config','core.autocrlf','false']); execFileSync('git',['-C',repo,'config','user.name','Bounded Agent Demo']); execFileSync('git',['-C',repo,'config','user.email','demo@invalid.example']); }
  return repo;
}
export function assertWorkspaceIdentity(state,repo) {
  const current=gitIdentity(repo);
  if(current.candidate_sha!==state.candidate_sha) throw new Error('POST_TEST_CANDIDATE_DRIFT');
  if(current.tree_hash!==state.tree_hash) throw new Error('POST_TEST_TREE_DRIFT');
  return true;
}
export function recoverState(state) {
  if(!fs.existsSync(JOURNAL_FILE)) throw new Error('RECOVERY_JOURNAL_MISSING');
  const lines=fs.readFileSync(JOURNAL_FILE,'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
  const transitions=lines.filter(x=>x.event==='STATE_TRANSITION');
  const last=transitions.at(-1);
  if(last && (last.to!==state.state || last.state_version!==state.state_version)) throw new Error('RECOVERY_STATE_JOURNAL_MISMATCH');
  if(!last && state.state!=='NEW') throw new Error('RECOVERY_STATE_JOURNAL_MISMATCH');
  return 'SAFE_RESUME';
}
