import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const { workspace, command, args = [], timeout_ms: timeoutMs = 120000 } = input;
if (!workspace || typeof command !== 'string' || !command || !Array.isArray(args) || args.some(x => typeof x !== 'string')) throw new Error('VERIFIER_INPUT_INVALID');

const env = {};
for (const key of ['PATH','Path','SystemRoot','WINDIR','TEMP','TMP','ComSpec']) if (process.env[key]) env[key] = process.env[key];
const started = Date.now();
const result = spawnSync(command, args, {
  cwd: workspace,
  encoding: 'utf8',
  timeout: Math.max(1000, Number(timeoutMs) || 120000),
  env,
  windowsHide: true,
  shell: false,
  maxBuffer: 4 * 1024 * 1024
});
if (result.error?.code === 'ETIMEDOUT') throw new Error(`VERIFICATION_TIMEOUT:${command}`);
if (result.error) throw new Error(`VERIFICATION_EXEC_FAILED:${command}:${result.error.code || result.error.message}`);
process.stdout.write(JSON.stringify({ command, args, status: result.status, duration_ms: Date.now() - started, stdout: String(result.stdout || '').slice(-4000), stderr: String(result.stderr || '').slice(-4000) }));
