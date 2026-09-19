#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const args=process.argv.slice(2);
function option(name,fallback=null){const i=args.indexOf(name);return i>=0?args[i+1]??fallback:fallback;}
const out=path.resolve(option('--out',path.join('.bar-proof','durability-proof.json')));
const root=path.resolve('.');
const log=[];

function run(label,command,argv,{expect=null}={}){
  const result=spawnSync(command,argv,{cwd:root,encoding:'utf8',windowsHide:true,env:{...process.env}});
  const stdout=String(result.stdout||'');
  const stderr=String(result.stderr||'');
  log.push('## '+label+'\n$ '+command+' '+argv.join(' ')+'\n'+stdout+stderr+'\n');
  if(result.status!==0) throw new Error(label+':exit='+result.status);
  if(expect&&!expect.test(stdout+stderr)) throw new Error(label+':expected-marker-missing:'+expect);
  return {status:'PASS',exitCode:result.status};
}

run('source-head','git',['rev-parse','HEAD']);
const sourceHead=String(spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).stdout||'').trim();
if(!/^[a-f0-9]{40}$/i.test(sourceHead)) throw new Error('SOURCE_HEAD_INVALID');

const securityPattern=[
  'expired lease is rejected',
  'fencing mismatch is rejected',
  'gate signature binds identity and exact candidate',
  'authorization receipt verification rejects signed expiry',
  'controller reaches Human Gate with controller-derived Git identity and no remote',
  'forged ACCEPTED state cannot bypass Human Gate',
  'approval nonce cannot be replayed after state rollback',
  'recovery can replay one durably journaled transition after a state-write crash',
  'persisted lease takeover fences a stale controller snapshot',
  'accepted authorization rejects fencing token tampering against authenticated journal',
  'protected authorization rejects candidate drift after approval'
].join('|');

const checks=[];
checks.push({name:'security-recovery-suite',...run(
  'security-recovery-suite',
  process.execPath,
  ['--test','--test-name-pattern',securityPattern,'test/runtime.test.mjs','test/integration.test.mjs']
)});
checks.push({name:'quickstart-human-gate',...run(
  'quickstart-human-gate',
  process.execPath,
  ['bin/bar.mjs','quickstart'],
  {expect:/4\/4 PASS: HUMAN_GATE_REQUIRED/}
)});

const status=spawnSync('git',['status','--porcelain=v1','--untracked-files=all'],{cwd:root,encoding:'utf8',windowsHide:true});
if(status.status!==0) throw new Error('GIT_STATUS_FAILED');
const dirty=String(status.stdout||'').trim().split(/\r?\n/).filter(Boolean).filter(line=>!line.includes('.bar-proof/'));
if(dirty.length) throw new Error('SOURCE_MUTATION_DETECTED:'+dirty.join(','));
checks.push({name:'source-remains-clean',status:'PASS'});

const report={
  schemaVersion:'bar.durability-proof.v1',
  status:'PASS',
  generatedAt:new Date().toISOString(),
  source:{
    head:sourceHead,
    repository:process.env.GITHUB_REPOSITORY||null,
    ref:process.env.GITHUB_REF||null,
    runId:process.env.GITHUB_RUN_ID||null,
    runAttempt:process.env.GITHUB_RUN_ATTEMPT||null
  },
  runner:{
    os:process.platform,
    platform:os.platform(),
    release:os.release(),
    arch:os.arch(),
    node:process.version,
    githubHosted:Boolean(process.env.GITHUB_ACTIONS)
  },
  checks,
  guarantees:{
    offHostWhenGithubHosted:Boolean(process.env.GITHUB_ACTIONS),
    humanGateReached:true,
    protectedRemoteMutationAttempted:false,
    sourceMutationObserved:false,
    secretsRequired:false
  }
};
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(path.join(path.dirname(out),'durability-proof.log'),log.join('\n'));
console.log('BAR_DURABILITY_PROOF=PASS head='+sourceHead+' platform='+process.platform);
