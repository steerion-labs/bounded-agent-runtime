import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { RUNTIME_ROOT, STATE_FILE, SECRETS_DIR } from './core.mjs';
import { adapterDefinitions } from './adapters/registry.mjs';
import { resolveLaunchCommand } from './adapters/launcher.mjs';
import { inspectCodexUserExtensions } from './adapters/codex-policy.mjs';

function findExecutable(name) {
  const command = process.platform === 'win32' ? 'where.exe' : 'which';
  const result = spawnSync(command, [name], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) return null;
  return String(result.stdout).split(/\r?\n/).find(Boolean) ?? null;
}

function probeAgentAuth(name, executable) {
  if (!executable || !['codex','claude','opencode'].includes(name)) return null;
  const args = name === 'codex' ? ['login','status'] : (name === 'claude' ? ['auth','status'] : ['auth','list','--pure']);
  const launch = resolveLaunchCommand(name, args);
  const result = spawnSync(launch.command, launch.args, { encoding: 'utf8', windowsHide: true, timeout: 5000, env: process.env });
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  if (name === 'codex') return result.status === 0 && /logged in/i.test(output);
  if (name === 'claude') return result.status === 0 && /"loggedIn"\s*:\s*true/i.test(output);
  if (name === 'opencode') return result.status === 0 && !/\b0 credentials\b/i.test(output);
  return null;
}

export function diagnosticProbeEnv(source = process.env) {
  const env = {};
  for (const key of ['PATH','Path','PATHEXT','SystemRoot','SYSTEMROOT','WINDIR','COMSPEC','TEMP','TMP']) {
    if (source[key] !== undefined) env[key] = source[key];
  }
  env.NO_COLOR = '1';
  env.CI = '1';
  return env;
}

export function parseVersionOutput(stdout = '', stderr = '') {
  const line = `${stdout}\n${stderr}`.split(/\r?\n/).map(value => value.trim()).find(Boolean);
  if (!line || line.length > 160 || !/\d+\.\d+/.test(line)) return null;
  return line.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 160);
}

export function probeAgentVersion(name, executable, { spawn = spawnSync } = {}) {
  if (!executable) return Object.freeze({ version: null, version_probe: 'NOT_INSTALLED' });
  if (name === 'demo') return Object.freeze({ version: `node ${process.versions.node}`, version_probe: 'PASS' });
  if (name === 'generic') return Object.freeze({ version: null, version_probe: 'UNAVAILABLE' });
  try {
    const launch = resolveLaunchCommand(name, ['--version']);
    const result = spawn(launch.command, launch.args, {
      cwd: os.tmpdir(),
      encoding: 'utf8',
      windowsHide: true,
      timeout: 3000,
      env: diagnosticProbeEnv()
    });
    if (result?.error || result?.status !== 0) return Object.freeze({ version: null, version_probe: 'FAILED' });
    const version = parseVersionOutput(result.stdout, result.stderr);
    return Object.freeze({ version, version_probe: version ? 'PASS' : 'FAILED' });
  } catch {
    return Object.freeze({ version: null, version_probe: 'FAILED' });
  }
}

function row(id, ok, detail, severity = 'required') {
  return { id, ok: Boolean(ok), severity, detail };
}

export function doctorReport() {
  const protectedMode = process.env.BOUNDED_AGENT_PROTECTED_MODE === '1';
  const absoluteConfigured = Boolean(process.env.BOUNDED_AGENT_RUNTIME_ROOT && path.isAbsolute(process.env.BOUNDED_AGENT_RUNTIME_ROOT));
  const checks = [
    row('node', Number(process.versions.node.split('.')[0]) >= 20, `Node ${process.versions.node}`),
    row('git', findExecutable('git'), findExecutable('git') || 'not found'),
    row('runtime_root', !protectedMode || absoluteConfigured, protectedMode ? String(process.env.BOUNDED_AGENT_RUNTIME_ROOT || 'missing') : `${RUNTIME_ROOT} (demo mode)`),
    row('protected_mode', protectedMode, protectedMode ? 'enabled' : 'disabled; child processes are not an OS security boundary', 'advisory')
  ];
  const agents = {};
  const codexPolicy = inspectCodexUserExtensions();
  for (const [name, def] of Object.entries(adapterDefinitions())) {
    const executable = name === 'generic' ? process.env.BOUNDED_AGENT_GENERIC_EXECUTABLE || null : (name === 'demo' ? process.execPath : findExecutable(def.executable));
    const authenticated = probeAgentAuth(name, executable);
    const versionState = probeAgentVersion(name, executable);
    agents[name] = {
      installed: Boolean(executable),
      executable,
      roles: def.roles,
      boundary: def.boundary || 'controller-enforced',
      ...versionState,
      ...(authenticated === null ? {} : { authenticated })
    };
    if (name === 'codex') {
      agents[name].safe_for_builder = false;
      agents[name].builder_requires_user_config_opt_in = true;
      agents[name].user_config_risks = codexPolicy.reasons;
    }
  }
  checks.push(row('runtime_state', fs.existsSync(STATE_FILE), fs.existsSync(STATE_FILE) ? STATE_FILE : 'not initialized', 'advisory'));
  checks.push(row('secret_zone', fs.existsSync(SECRETS_DIR), fs.existsSync(SECRETS_DIR) ? SECRETS_DIR : 'created on first runtime use', 'advisory'));
  const policyPath = process.env.BOUNDED_AGENT_NETWORK_POLICY;
  checks.push(row('network_broker', Boolean(policyPath && fs.existsSync(policyPath)), policyPath || 'no network policy configured', 'advisory'));
  checks.push(row('worker_egress', process.env.BOUNDED_AGENT_WORKER_EGRESS_ENFORCED === '1', process.env.BOUNDED_AGENT_WORKER_EGRESS_ENFORCED === '1' ? 'operator asserts direct worker egress is externally restricted' : 'direct worker egress is not proven restricted; broker is not a firewall', 'advisory'));
  const requiredFailed = checks.filter(item => item.severity === 'required' && !item.ok).length;
  return {
    status: requiredFailed ? 'FAIL' : (checks.some(item => !item.ok) ? 'WARN' : 'PASS'),
    protected_mode: protectedMode,
    runtime_root: RUNTIME_ROOT,
    checks,
    agents
  };
}

export function formatDoctor(report) {
  const lines = [`Bounded Agent Runtime doctor: ${report.status}`, ''];
  for (const check of report.checks) lines.push(`${check.ok ? 'OK ' : '!! '} ${check.id.padEnd(16)} ${check.detail}`);
  lines.push('', 'Agent adapters:');
  for (const [name, agent] of Object.entries(report.agents)) {
    const version = agent.version || `version:${String(agent.version_probe || 'UNKNOWN').toLowerCase()}`;
    lines.push(`${agent.installed ? 'OK ' : '-- '} ${name.padEnd(12)} ${agent.roles.join('/')} ${agent.executable || 'not found'} | ${version} | ${agent.boundary}`);
  }
  if (!report.protected_mode) lines.push('', 'NOTE: Demo mode is convenient, not an OS isolation boundary. Use protected mode + worker identities before relying on host isolation.');
  return lines.join('\n');
}
