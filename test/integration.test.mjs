import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';

const repo=path.resolve(import.meta.dirname,'..');
const controller=path.join(repo,'runtime','controller.mjs');
const gate=path.join(repo,'runtime','gate.mjs');
const task=path.join(repo,'examples','task.example.json');
const rootFor=cwd=>path.join(cwd,'runtime-root');
const stateFor=cwd=>path.join(rootFor(cwd),'runtime-state','state.json');
const journalFor=cwd=>path.join(rootFor(cwd),'journal','journal.jsonl');
function baseEnv(cwd,extra={}) {
  return {...process.env,BOUNDED_AGENT_RUNTIME_ROOT:rootFor(cwd),BOUNDED_AGENT_APPROVER_IDENTITY:'demo-approver',...extra};
}
const run=(args,cwd,env=baseEnv(cwd))=>spawnSync(process.execPath,[controller,...args],{cwd,encoding:'utf8',env});
function setupKeys(cwd) {
  const keyDir=path.join(cwd,'gate-keys');
  const kg=spawnSync(process.execPath,[gate,'keygen',keyDir],{cwd,encoding:'utf8',env:baseEnv(cwd)});
  assert.equal(kg.status,0,kg.stderr);
  const fingerprint=kg.stdout.match(/PUBLIC_KEY_FINGERPRINT ([a-f0-9]+)/)?.[1];
  assert.ok(fingerprint);
  return {keyDir,fingerprint,env:baseEnv(cwd,{BOUNDED_AGENT_APPROVAL_PUBLIC_KEY:path.join(keyDir,'public.pem'),BOUNDED_AGENT_APPROVAL_KEY_FINGERPRINT:fingerprint})};
}
test('controller reaches Human Gate with controller-derived Git identity and no remote',()=>{
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'bar-flow-'));
  assert.equal(run(['init',task],cwd).status,0);
  const result=run(['run'],cwd); assert.equal(result.status,0,result.stderr); assert.match(result.stdout,/HUMAN_GATE_REQUIRED/);
  const state=JSON.parse(fs.readFileSync(stateFor(cwd),'utf8'));
  assert.equal(state.state,'HUMAN_GATE');
  assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:state.workspace_path,encoding:'utf8'}).trim(),state.candidate_sha);
  assert.equal(execFileSync('git',['rev-parse','HEAD^{tree}'],{cwd:state.workspace_path,encoding:'utf8'}).trim(),state.tree_hash);
  assert.equal(spawnSync('git',['remote'],{cwd:state.workspace_path,encoding:'utf8'}).stdout.trim(),'');
});

test('forged ACCEPTED state cannot bypass Human Gate',()=>{
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'bar-forge-')); const keys=setupKeys(cwd);
  assert.equal(run(['init',task],cwd,keys.env).status,0); assert.equal(run(['run'],cwd,keys.env).status,0);
  const state=JSON.parse(fs.readFileSync(stateFor(cwd),'utf8')); state.state='ACCEPTED'; state.human_approval=null;
  fs.writeFileSync(stateFor(cwd),JSON.stringify(state,null,2));
  const auth=run(['authorize-protected','remote_mutation'],cwd,keys.env);
  assert.notEqual(auth.status,0); assert.match(auth.stderr,/HUMAN_GATE_REQUIRED|RECOVERY_STATE_JOURNAL_MISMATCH/);
});
test('approval nonce cannot be replayed after state rollback',()=>{
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'bar-replay-')); const keys=setupKeys(cwd);
  assert.equal(run(['init',task],cwd,keys.env).status,0); assert.equal(run(['run'],cwd,keys.env).status,0);
  const before=fs.readFileSync(stateFor(cwd),'utf8');
  const signed=spawnSync(process.execPath,[gate,'sign',path.join(keys.keyDir,'private.pem')],{cwd,encoding:'utf8',env:keys.env});
  assert.equal(signed.status,0,signed.stderr); const sig=signed.stdout.trim();
  assert.equal(run(['approve',sig],cwd,keys.env).status,0);
  fs.writeFileSync(stateFor(cwd),before);
  const replay=run(['approve',sig],cwd,keys.env);
  assert.notEqual(replay.status,0); assert.match(replay.stderr,/HUMAN_GATE_NONCE_REPLAY|APPROVAL_NOT_ALLOWED_IN:ACCEPTED/);
});

test('approval succeeds for task whose only protected action is merge',()=>{
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'bar-approve-merge-only-')); const keys=setupKeys(cwd);
  const mergeOnly=JSON.parse(fs.readFileSync(task,'utf8'));
  mergeOnly.allowed_actions=mergeOnly.allowed_actions.filter(x=>x!=='remote_mutation');
  mergeOnly.protected_actions=['merge'];
  const localTask=path.join(cwd,'task.json'); fs.writeFileSync(localTask,JSON.stringify(mergeOnly,null,2));
  assert.equal(run(['init',localTask],cwd,keys.env).status,0); assert.equal(run(['run'],cwd,keys.env).status,0);
  const signed=spawnSync(process.execPath,[gate,'sign',path.join(keys.keyDir,'private.pem')],{cwd,encoding:'utf8',env:keys.env});
  assert.equal(signed.status,0,signed.stderr);
  const approved=run(['approve',signed.stdout.trim()],cwd,keys.env);
  assert.equal(approved.status,0,approved.stderr); assert.match(approved.stdout,/ACCEPTED_NO_REMOTE_MUTATION_EXECUTED/);
  const auth=run(['authorize-protected','merge'],cwd,keys.env); assert.equal(auth.status,0,auth.stderr); assert.match(auth.stdout,/PROTECTED_ACTION_AUTHORIZED merge/);
});

test('approval key substitution fails fingerprint pinning',()=>{
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'bar-keysub-')); const keys=setupKeys(cwd);
  assert.equal(run(['init',task],cwd,keys.env).status,0); assert.equal(run(['run'],cwd,keys.env).status,0);
  const other=path.join(cwd,'other-keys');
  const kg=spawnSync(process.execPath,[gate,'keygen',other],{cwd,encoding:'utf8',env:baseEnv(cwd)}); assert.equal(kg.status,0);
  const badEnv={...keys.env,BOUNDED_AGENT_APPROVAL_PUBLIC_KEY:path.join(other,'public.pem')};
  const result=run(['approve','AAAA'],cwd,badEnv);
  assert.notEqual(result.status,0); assert.match(result.stderr,/APPROVER_KEY_FINGERPRINT_MISMATCH/);
});
test('journal truncation is detected by authenticated anchor',()=>{
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'bar-journal-'));
  assert.equal(run(['init',task],cwd).status,0); assert.equal(run(['run'],cwd).status,0);
  const lines=fs.readFileSync(journalFor(cwd),'utf8').trim().split(/\r?\n/);
  fs.writeFileSync(journalFor(cwd),lines.slice(0,1).join('\n')+'\n');
  const recovery=run(['recover'],cwd);
  assert.notEqual(recovery.status,0); assert.match(recovery.stderr,/JOURNAL_ANCHOR_MISMATCH|JOURNAL_CHAIN_INVALID/);
});

test('journal middle tamper is detected',()=>{
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'bar-journal-mid-'));
  assert.equal(run(['init',task],cwd).status,0); assert.equal(run(['run'],cwd).status,0);
  const lines=fs.readFileSync(journalFor(cwd),'utf8').trim().split(/\r?\n/);
  const entry=JSON.parse(lines[2]); entry.event='TAMPERED'; lines[2]=JSON.stringify(entry);
  fs.writeFileSync(journalFor(cwd),lines.join('\n')+'\n');
  const recovery=run(['recover'],cwd);
  assert.notEqual(recovery.status,0); assert.match(recovery.stderr,/JOURNAL_HMAC_INVALID|JOURNAL_HASH_INVALID/);
});

test('recovery returns safe resume on consistent durable state',()=>{
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'bar-recover-'));
  assert.equal(run(['init',task],cwd).status,0);
  const recovery=run(['recover'],cwd); assert.equal(recovery.status,0,recovery.stderr); assert.match(recovery.stdout,/SAFE_RESUME/);
});
test('protected authorization rejects candidate drift after approval',()=>{
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'bar-drift-flow-')); const keys=setupKeys(cwd);
  assert.equal(run(['init',task],cwd,keys.env).status,0); assert.equal(run(['run'],cwd,keys.env).status,0);
  const signed=spawnSync(process.execPath,[gate,'sign',path.join(keys.keyDir,'private.pem')],{cwd,encoding:'utf8',env:keys.env});
  assert.equal(signed.status,0,signed.stderr); const sig=signed.stdout.trim();
  assert.equal(run(['approve',sig],cwd,keys.env).status,0);
  const state=JSON.parse(fs.readFileSync(stateFor(cwd),'utf8'));
  fs.writeFileSync(path.join(state.workspace_path,'demo-output','artifact.txt'),'tampered after approval\n');
  execFileSync('git',['add','.'],{cwd:state.workspace_path}); execFileSync('git',['commit','-q','-m','tamper'],{cwd:state.workspace_path});
  const auth=run(['authorize-protected','remote_mutation'],cwd,keys.env);
  assert.notEqual(auth.status,0); assert.match(auth.stderr,/POST_TEST_CANDIDATE_DRIFT|POST_TEST_TREE_DRIFT/);
});
test('tampered evidence is rejected before protected authorization',()=>{
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'bar-evidence-')); const keys=setupKeys(cwd);
  assert.equal(run(['init',task],cwd,keys.env).status,0); assert.equal(run(['run'],cwd,keys.env).status,0);
  const state=JSON.parse(fs.readFileSync(stateFor(cwd),'utf8'));
  state.evidence[0].claim='tampered'; fs.writeFileSync(stateFor(cwd),JSON.stringify(state,null,2));
  const auth=run(['authorize-protected','remote_mutation'],cwd,keys.env);
  assert.notEqual(auth.status,0); assert.match(auth.stderr,/EVIDENCE_INTEGRITY_INVALID/);
});
test('hostile global Git hooks are not executed by controller Git commands',()=>{
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'bar-githook-'));
  const fakeHome=path.join(cwd,'home'); const hooks=path.join(cwd,'hooks'); fs.mkdirSync(fakeHome); fs.mkdirSync(hooks);
  const marker=path.join(cwd,'hook-ran.txt');
  const hook=path.join(hooks,'pre-commit'); fs.writeFileSync(hook,`#!/bin/sh\necho pwned > "${marker.replace(/\\/g,'/')}"\n`); try { fs.chmodSync(hook,0o755); } catch {}
  fs.writeFileSync(path.join(fakeHome,'.gitconfig'),`[core]\n\thooksPath = ${hooks.replace(/\\/g,'/')}\n`);
  const env=baseEnv(cwd,{HOME:fakeHome,USERPROFILE:fakeHome,GIT_CONFIG_GLOBAL:path.join(fakeHome,'.gitconfig')});
  assert.equal(run(['init',task],cwd,env).status,0); const result=run(['run'],cwd,env);
  assert.equal(result.status,0,result.stderr); assert.equal(fs.existsSync(marker),false,'hostile global hook executed');
});
test('recovery can replay one durably journaled transition after a state-write crash',()=>{
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'bar-recover-forward-'));
  const env=baseEnv(cwd); assert.equal(run(['init',task],cwd,env).status,0);
  const coreUrl=new URL('../runtime/core.mjs',import.meta.url).href;
  const code=`import {journal} from ${JSON.stringify(coreUrl)}; journal('STATE_TRANSITION',{task_id:'demo-bounded-task-001',from:'NEW',to:'CLASSIFIED',state_version:1,proof:null});`;
  const append=spawnSync(process.execPath,['--input-type=module','-e',code],{cwd,encoding:'utf8',env}); assert.equal(append.status,0,append.stderr);
  const recovery=run(['recover'],cwd,env); assert.equal(recovery.status,0,recovery.stderr); assert.match(recovery.stdout,/RECOVERED_FORWARD/);
  const state=JSON.parse(fs.readFileSync(stateFor(cwd),'utf8')); assert.equal(state.state,'CLASSIFIED'); assert.equal(state.state_version,1);
});

test('BOM-prefixed task JSON is accepted',()=>{
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'bar-bom-'));
  const taskCopy=path.join(cwd,'task.json'); fs.writeFileSync(taskCopy,'\uFEFF'+fs.readFileSync(task,'utf8'));
  const result=run(['init',taskCopy],cwd); assert.equal(result.status,0,result.stderr); assert.match(result.stdout,/INITIALIZED/);
});
test('controller enforces wall-clock timeout on a hanging Builder process',()=>{
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'bar-timeout-'));
  const copied=path.join(cwd,'repo'); fs.mkdirSync(copied); fs.cpSync(path.join(repo,'runtime'),path.join(copied,'runtime'),{recursive:true});
  const localTask=path.join(cwd,'task.json');
  const t=JSON.parse(fs.readFileSync(task,'utf8')); t.budget={model_calls:1,wall_clock_seconds:1,retries:0}; fs.writeFileSync(localTask,JSON.stringify(t));
  fs.writeFileSync(path.join(copied,'runtime','adapters','demo-builder.mjs'),'while (true) {}\n');
  const localController=path.join(copied,'runtime','controller.mjs'); const env=baseEnv(cwd);
  const init=spawnSync(process.execPath,[localController,'init',localTask],{cwd,encoding:'utf8',env}); assert.equal(init.status,0,init.stderr);
  const started=Date.now(); const result=spawnSync(process.execPath,[localController,'run'],{cwd,encoding:'utf8',env}); const elapsed=Date.now()-started;
  assert.notEqual(result.status,0); assert.ok(elapsed < 5000,`hanging builder exceeded bound: ${elapsed}ms`);
  assert.match(result.stderr,/BUILDER_TIMEOUT|BUDGET_EXCEEDED:wall_clock_seconds/);
});

test('persisted lease takeover fences a stale controller snapshot',()=>{
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'bar-fence-')); const env=baseEnv(cwd);
  assert.equal(run(['init',task],cwd,env).status,0);
  const coreUrl=new URL('../runtime/core.mjs',import.meta.url).href;
  const code=`import fs from 'node:fs'; import {loadState,saveState,assertCurrentLease} from ${JSON.stringify(coreUrl)}; const local=loadState(); const newer=structuredClone(local); newer.lease.generation+=1; newer.lease.fencing_token='takeover'; saveState(newer); try { assertCurrentLease(local); process.exit(9); } catch(e) { console.error(e.message); process.exit(0); }`;
  const probe=spawnSync(process.execPath,['--input-type=module','-e',code],{cwd,encoding:'utf8',env}); assert.equal(probe.status,0,probe.stderr); assert.match(probe.stderr,/STALE_CONTROLLER_GENERATION|STALE_CONTROLLER_FENCE/);
});
test('state rollback is rejected against the authenticated journal before rerun',()=>{
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'bar-state-rollback-'));
  assert.equal(run(['init',task],cwd).status,0); assert.equal(run(['run'],cwd).status,0);
  const state=JSON.parse(fs.readFileSync(stateFor(cwd),'utf8'));
  state.state='NEW'; state.state_version=0; state.evidence=[]; state.candidate_sha=null; state.tree_hash=null; state.workspace_path=null; state.gate_challenge=null;
  fs.writeFileSync(stateFor(cwd),JSON.stringify(state,null,2));
  const rerun=run(['run'],cwd);
  assert.notEqual(rerun.status,0); assert.match(rerun.stderr,/RECOVERY_STATE_JOURNAL_MISMATCH/);
});

test('removing protected action from persisted task is rejected',()=>{
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'bar-task-bind-')); const keys=setupKeys(cwd);
  assert.equal(run(['init',task],cwd,keys.env).status,0); assert.equal(run(['run'],cwd,keys.env).status,0);
  const state=JSON.parse(fs.readFileSync(stateFor(cwd),'utf8'));
  state.task.protected_actions=[];
  fs.writeFileSync(stateFor(cwd),JSON.stringify(state,null,2));
  const auth=run(['authorize-protected','merge'],cwd,keys.env);
  assert.notEqual(auth.status,0); assert.match(auth.stderr,/TASK_BINDING_INVALID|CAPABILITY_DENIED|PROTECTED_ACTION_NOT_DECLARED/);
});

test('hostile Git environment variables are neutralized',()=>{
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'bar-gitenv-'));
  const hostile=path.join(cwd,'hostile.git'); fs.mkdirSync(hostile);
  const env=baseEnv(cwd,{GIT_DIR:hostile,GIT_WORK_TREE:cwd,GIT_TEMPLATE_DIR:hostile,GIT_ALTERNATE_OBJECT_DIRECTORIES:hostile});
  assert.equal(run(['init',task],cwd,env).status,0);
  const result=run(['run'],cwd,env); assert.equal(result.status,0,result.stderr); assert.match(result.stdout,/HUMAN_GATE_REQUIRED/);
});
