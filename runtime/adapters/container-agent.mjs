import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const { role, task, workspace, candidate, review_diff: reviewDiff = '', timeout_ms: timeoutMs = 120000 } = input;
const config = task?.workers?.[role];
if (!['builder','reviewer'].includes(role) || !workspace || config?.adapter !== 'container') throw new Error('CONTAINER_INPUT_INVALID');
if (typeof config.image !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._/:@-]{0,255}$/.test(config.image)) throw new Error('CONTAINER_IMAGE_INVALID');
if (typeof config.command !== 'string' || !config.command || config.command.startsWith('-')) throw new Error('CONTAINER_COMMAND_INVALID');
if (config.args !== undefined && (!Array.isArray(config.args) || config.args.some(x => typeof x !== 'string'))) throw new Error('CONTAINER_ARGS_INVALID');

function docker(args, options = {}) {
  const env = {};
  for (const key of ['PATH','Path','SystemRoot','WINDIR','DOCKER_HOST']) if (process.env[key]) env[key] = process.env[key];
  const result = spawnSync('docker', args, { encoding:'utf8', windowsHide:true, maxBuffer:4*1024*1024, env, ...options });
  if (result.error) throw new Error(`DOCKER_EXEC_FAILED:${result.error.code || result.error.message}`);
  return result;
}

function makeSeedWritable(target) {
  if (process.platform === 'win32') return;
  const visit = current => {
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) return;
    fs.chmodSync(current, stat.mode | (stat.isDirectory() ? 0o333 : 0o222));
    if (stat.isDirectory()) for (const name of fs.readdirSync(current)) visit(path.join(current,name));
  };
  visit(target);
}
function copySeed(source, target) {
  fs.rmSync(target,{recursive:true,force:true});
  fs.mkdirSync(target,{recursive:true});
  fs.cpSync(source,target,{recursive:true,filter:src=>path.basename(src)!=='.git'});
  makeSeedWritable(target);
}
function prompt() {
  if (role === 'builder') return [
    'You are the Builder inside Bounded Agent Runtime.',
    `Task: ${task.intent}`,
    `Allowed paths: ${task.allowed_paths.join(', ')}`,
    'The repository working tree is at /workspace. Modify only allowed paths.',
    'There is no host .git directory and no network access.',
    'Do not attempt to escape the container. Finish with a short summary.'
  ].join('\n');
  return [
    'You are the Reviewer inside Bounded Agent Runtime.',
    `Task: ${task.intent}`,
    `Candidate commit: ${candidate?.candidate_sha || 'unknown'}`,
    `Candidate tree: ${candidate?.tree_hash || 'unknown'}`,
    reviewDiff ? `Candidate diff:\n${reviewDiff}` : 'Inspect /workspace.',
    'You receive a disposable container copy with no network access. Changes are never copied back to the host candidate.',
    'Return ONLY JSON: {"decision":"APPROVE"|"BLOCK","reason":"...","residual_risks":["..."]}'
  ].join('\n');
}

function parseReview(text) {
  const trimmed=String(text||'').trim(); const candidates=[trimmed];
  for(let index=trimmed.lastIndexOf('{');index>=0;){candidates.push(trimmed.slice(index));if(index===0)break;index=trimmed.lastIndexOf('{',index-1);}
  for(const value of candidates){try{const parsed=JSON.parse(value);if(['APPROVE','BLOCK'].includes(parsed.decision))return {decision:parsed.decision,reason:String(parsed.reason||''),residual_risks:Array.isArray(parsed.residual_risks)?parsed.residual_risks.map(String).slice(0,20):[]};}catch{}}
  throw new Error('CONTAINER_REVIEWER_INVALID_JSON');
}
const id=`bar-${crypto.randomUUID()}`;
const seed=fs.mkdtempSync(path.join(os.tmpdir(),'bar-container-seed-'));
const output=fs.mkdtempSync(path.join(os.tmpdir(),'bar-container-out-'));
copySeed(workspace,seed);
const createArgs=['create','--name',id,'--network','none','--cap-drop','ALL','--security-opt','no-new-privileges:true','--tmpfs','/tmp:rw,noexec,nosuid,size=64m','--pids-limit','256','--memory',String(config.memory||'1g'),'--cpus',String(config.cpus||'1'),'--workdir','/workspace'];
createArgs.push(config.image,config.command,...(config.args||[]),prompt());
let created=false;
try {
  const create=docker(createArgs); if(create.status!==0)throw new Error(`CONTAINER_CREATE_FAILED:${String(create.stderr||'').trim().slice(0,1000)||create.status}`); created=true;
  const copied=docker(['cp',`${seed}${path.sep}.`,`${id}:/workspace`]); if(copied.status!==0)throw new Error(`CONTAINER_SEED_FAILED:${String(copied.stderr||'').trim().slice(0,1000)||copied.status}`);
  const started=docker(['start','-a',id],{timeout:Math.max(1000,Number(timeoutMs)||120000)});
  if(started.error?.code==='ETIMEDOUT')throw new Error('CONTAINER_TIMEOUT');
  const inspected=docker(['inspect','--format','{{.State.ExitCode}}',id]); const exitCode=Number(String(inspected.stdout||'').trim());
  if(!Number.isInteger(exitCode)||exitCode!==0)throw new Error(`CONTAINER_FAILED:${exitCode}:${String(started.stderr||'').trim().slice(0,1000)}`);
  const text=String(started.stdout||'').trim();
  if(role==='builder') {
    const copiedOut=docker(['cp',`${id}:/workspace/.`,output]); if(copiedOut.status!==0)throw new Error('CONTAINER_OUTPUT_COPY_FAILED');
    for(const allowed of task.allowed_paths){const rel=allowed.replaceAll('\\','/').replace(/^\.\//,'').replace(/\/$/,'');const src=path.join(output,...rel.split('/'));const dst=path.join(workspace,...rel.split('/'));fs.rmSync(dst,{recursive:true,force:true});if(fs.existsSync(src)){fs.mkdirSync(path.dirname(dst),{recursive:true});fs.cpSync(src,dst,{recursive:true});}}
    process.stdout.write(JSON.stringify({status:'PASS',artifact:`container:${config.image}`,summary:text.slice(-4000)}));
  } else {
    const parsed=parseReview(text); process.stdout.write(JSON.stringify({...parsed,reviewed_candidate_sha:candidate.candidate_sha,reviewed_tree_hash:candidate.tree_hash}));
  }
} finally {
  if(created)docker(['rm','-f',id]);
  fs.rmSync(seed,{recursive:true,force:true}); fs.rmSync(output,{recursive:true,force:true});
}
