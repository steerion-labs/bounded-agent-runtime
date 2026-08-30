import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';

const repo=path.resolve(import.meta.dirname,'..');
const controller=path.join(repo,'runtime','controller.mjs');
const rootFor=cwd=>path.join(cwd,'runtime-root');
const stateFor=cwd=>path.join(rootFor(cwd),'runtime-state','state.json');
const nodeImage=JSON.parse(execFileSync('docker',['image','inspect','node:20-alpine','--format','{{json .RepoDigests}}'],{encoding:'utf8'}).trim())[0];
function env(cwd){return {...process.env,BOUNDED_AGENT_RUNTIME_ROOT:rootFor(cwd),BOUNDED_AGENT_APPROVER_IDENTITY:'demo-approver'};}
function run(args,cwd){return spawnSync(process.execPath,[controller,...args],{cwd,encoding:'utf8',env:env(cwd),timeout:180000});}
function sourceRepo(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bar-container-src-'));execFileSync('git',['init','-q'],{cwd:dir});execFileSync('git',['config','user.name','test'],{cwd:dir});execFileSync('git',['config','user.email','test@invalid'],{cwd:dir});fs.mkdirSync(path.join(dir,'src'));fs.writeFileSync(path.join(dir,'src','value.txt'),'before\n');execFileSync('git',['add','.'],{cwd:dir});execFileSync('git',['commit','-q','-m','base'],{cwd:dir});return dir;}
function taskFor(source, reviewer='demo'){
  return {schema_version:1,task_id:`container-${Date.now()}`,intent:'Change src/value.txt',source:{kind:'local_git',path:source,ref:execFileSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).trim()},workers:{builder:{adapter:'container',image:nodeImage,command:'node',args:['-e',"require('fs').writeFileSync('/workspace/src/value.txt','after\\n');console.log('changed')"]},reviewer:reviewer==='demo'?{adapter:'demo'}:{adapter:'container',image:nodeImage,command:'node',args:['-e',"require('fs').writeFileSync('/workspace/src/reviewer-write.txt','container-only');console.log(JSON.stringify({decision:'APPROVE',reason:'disposable-copy-check',residual_risks:[]}))"]}},allowed_actions:['build_local','merge'],protected_actions:['merge'],allowed_paths:['src'],budget:{model_calls:4,wall_clock_seconds:90,retries:0}};
}
test('container Builder runs with network none and reaches separate review',()=>{
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'bar-container-flow-')); const source=sourceRepo(); const spec=taskFor(source);
  const file=path.join(cwd,'task.json');fs.writeFileSync(file,JSON.stringify(spec,null,2));
  assert.equal(run(['init',file],cwd).status,0);const result=run(['run'],cwd);assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/HUMAN_GATE_REQUIRED/);
  const state=JSON.parse(fs.readFileSync(stateFor(cwd),'utf8'));assert.equal(state.task.workers.builder.adapter,'container');assert.equal(state.state,'HUMAN_GATE');
  assert.equal(fs.readFileSync(path.join(state.workspace_path,'src','value.txt'),'utf8').trim(),'after');
});

test('container Reviewer mutations cannot propagate back to host candidate',()=>{
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'bar-container-review-')); const source=sourceRepo(); const spec=taskFor(source,'container');
  const file=path.join(cwd,'task.json');fs.writeFileSync(file,JSON.stringify(spec,null,2));
  assert.equal(run(['init',file],cwd).status,0);const result=run(['run'],cwd);assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/HUMAN_GATE_REQUIRED/);
  const state=JSON.parse(fs.readFileSync(stateFor(cwd),'utf8'));assert.equal(state.task.workers.reviewer.adapter,'container');assert.equal(fs.existsSync(path.join(state.reviewer_workspace_path,'src','reviewer-write.txt')),false);
});
