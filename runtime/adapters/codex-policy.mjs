import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function codexConfigPath(env = process.env) {
  const home = env.CODEX_HOME || path.join(os.homedir(), '.codex');
  return path.join(home, 'config.toml');
}

export function inspectCodexUserExtensions(env = process.env) {
  const config = codexConfigPath(env);
  if (!fs.existsSync(config)) return { config, risky: false, reasons: [] };
  const text = fs.readFileSync(config, 'utf8');
  const reasons = [];
  for (const kind of ['mcp_servers', 'plugins', 'apps', 'marketplaces']) {
    if (new RegExp(`^\\s*\\[${kind.replace('.', '\\.')}(?:\\.|\\])`, 'm').test(text)) reasons.push(kind);
  }
  if (/^\s*hooks\s*=\s*true\s*$/mi.test(text)) reasons.push('hooks');
  return { config, risky: reasons.length > 0, reasons: [...new Set(reasons)] };
}

export function assertCodexBuilderConfigAllowed(task, env = process.env) {
  const worker = task?.workers?.builder;
  if (worker?.adapter !== 'codex' || worker?.allow_user_config === true) return;
  const state = inspectCodexUserExtensions(env);
  if (state.risky) throw new Error(`CODEX_USER_EXTENSIONS_ACTIVE:${state.reasons.join(',')}:recreate task with --builder-allow-user-config only after reviewing this risk`);
}
