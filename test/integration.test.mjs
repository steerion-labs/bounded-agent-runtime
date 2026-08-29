import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { spawnSync, execFileSync } from 'node:child_process';
const repo=path.resolve(import.meta.dirname,'..'), controller=path.join(repo,'runtime','controller.mjs'), task=path.join(repo,'examples','task.example.json');
const run=(args,cwd,env=process.env)=>spawnSync(process.execPath,[controller,...args],{cwd,encoding:'utf8',env});
test('demo reaches Human Gate with a real local git candidate and no remote',()=>{const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'bounded-agent-'));assert.equal(run(['init',task],cwd).status,0);const r=run(['run'],cwd);assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/HUMAN_GATE_REQUIRED/);const s=JSON.parse(fs.readFileSync(path.join(cwd,'.bounded-agent','state.json'),'utf8'));assert.equal(s.state,'HUMAN_GATE');const w=s.workspace_path;assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:w,encoding:'utf8'}).trim(),s.candidate_sha);assert.equal(execFileSync('git',['rev-parse','HEAD^{tree}'],{cwd:w,encoding:'utf8'}).trim(),s.tree_hash);assert.equal(spawnSync('git',['remote'],{cwd:w,encoding:'utf8'}).stdout.trim(),'')});
test('recovery reconciles durable state and journal',()=>{const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'bounded-agent-rec-'));assert.equal(run(['init',task],cwd).status,0);assert.equal(run(['recover'],cwd).status,0)});
test('tampered journal blocks recovery',()=>{const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'bounded-agent-rec-'));run(['init',task],cwd);fs.appendFileSync(path.join(cwd,'.bounded-agent','journal.jsonl'),JSON.stringify({event:'STATE_TRANSITION',to:'BAD',state_version:99})+'\n');const r=run(['recover'],cwd);assert.notEqual(r.status,0);assert.match(r.stderr,/RECOVERY_STATE_JOURNAL_MISMATCH/)});

test('human gate rejects tampering and replay',()=>{
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'bounded-agent-gate-'));
  assert.equal(run(['init',task],cwd).status,0); assert.equal(run(['run'],cwd).status,0);
  const keyDir=path.join(cwd,'.human-gate');
  const gate=path.join(repo,'runtime','gate.mjs');
  assert.equal(spawnSync(process.execPath,[gate,'keygen',keyDir],{cwd,encoding:'utf8'}).status,0);
  const env={...process.env,BOUNDED_AGENT_APPROVAL_PUBLIC_KEY:path.join(keyDir,'public.pem')};
  const bad=run(['approve','AAAA'],cwd,env); assert.notEqual(bad.status,0); assert.match(bad.stderr,/INVALID_HUMAN_GATE_SIGNATURE/);
  const signed=spawnSync(process.execPath,[gate,'sign',path.join(keyDir,'private.pem')],{cwd,encoding:'utf8'});
  assert.equal(signed.status,0,signed.stderr); const sig=signed.stdout.trim();
  const ok=run(['approve',sig],cwd,env); assert.equal(ok.status,0,ok.stderr); assert.match(ok.stdout,/ACCEPTED_NO_REMOTE_MUTATION_EXECUTED/);
  const replay=run(['approve',sig],cwd,env); assert.notEqual(replay.status,0); assert.match(replay.stderr,/APPROVAL_NOT_ALLOWED_IN:ACCEPTED/);
});

