import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';

const digest = JSON.parse(execFileSync('docker', [
  'image', 'inspect', 'node:20-alpine', '--format', '{{json .RepoDigests}}'
], { encoding: 'utf8' }).trim())[0];
assert.match(digest, /^node@sha256:[0-9a-f]{64}$/);

test('reference container denies host access, capabilities and network routes', { timeout: 30000 }, () => {
  const code = [
    "const fs=require('node:fs');",
    "const status=fs.readFileSync('/proc/self/status','utf8');",
    "const cap=/^CapEff:\\s*([0-9a-f]+)/m.exec(status)?.[1]||null;",
    "const nnp=/^NoNewPrivs:\\s*(\\d+)/m.exec(status)?.[1]||null;",
    "const keys=['GITHUB_TOKEN','GH_TOKEN','OPENAI_API_KEY','ANTHROPIC_API_KEY','DOCKER_HOST'];",
    "let denied=false;try{fs.writeFileSync('/bar-canary-must-not-write','x');}catch{denied=true;}",
    "const routes=fs.readFileSync('/proc/net/route','utf8').trim().split('\\n').length-1;",
    "console.log(JSON.stringify({uid:process.getuid(),gid:process.getgid(),capEff:cap,noNewPrivs:nnp,deniedWrite:denied,hasDockerSocket:fs.existsSync('/var/run/docker.sock'),hasHostGitHubProfile:fs.existsSync('/root/.config/gh/hosts.yml'),hasHostSecrets:keys.some(k=>Boolean(process.env[k])),routes}));"
  ].join('\n');
  const args = [
    'run', '--rm', '--pull', 'never', '--network', 'none',
    '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true',
    '--read-only', '--user', '65534:65534', '--pids-limit', '64',
    '--memory', '256m', '--cpus', '0.5',
    '--tmpfs', '/tmp:rw,noexec,nosuid,size=16m',
    digest, 'node', '-e', code
  ];
  const run = spawnSync('docker', args, {
    encoding: 'utf8', timeout: 20000, windowsHide: true,
    env: {
      PATH: process.env.PATH || '',
      ...(process.env.DOCKER_HOST ? { DOCKER_HOST: process.env.DOCKER_HOST } : {})
    }
  });
  assert.equal(run.status, 0, String(run.stderr || run.error?.message || run.stdout));
  const got = JSON.parse(String(run.stdout).trim());
  assert.equal(got.uid, 65534);
  assert.equal(got.gid, 65534);
  assert.equal(got.capEff, '0000000000000000');
  assert.equal(got.noNewPrivs, '1');
  assert.equal(got.deniedWrite, true);
  assert.equal(got.hasDockerSocket, false);
  assert.equal(got.hasHostGitHubProfile, false);
  assert.equal(got.hasHostSecrets, false);
  assert.equal(got.routes, 0);
});
