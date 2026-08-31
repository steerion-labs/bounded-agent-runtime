import fs from 'node:fs';
import path from 'node:path';

function existingFile(value) {
  try { return fs.statSync(value).isFile(); } catch { return false; }
}

function windowsCandidates(command) {
  if (path.isAbsolute(command)) return existingFile(command) ? [command] : [];
  const searchPath = process.env.PATH || process.env.Path || '';
  const names = path.extname(command) ? [command] : [command, `${command}.exe`, `${command}.com`, `${command}.cmd`, `${command}.bat`];
  const found = [];
  for (const dir of searchPath.split(';').map(x => x.trim()).filter(Boolean)) {
    for (const name of names) {
      const candidate = path.join(dir, name);
      if (existingFile(candidate)) found.push(candidate);
    }
  }
  return found;
}

function resolveNpmCmdShim(file) {
  const text = fs.readFileSync(file, 'utf8');
  const base = path.dirname(file);
  const target = text.match(/"%dp0%\\([^"\r\n]+\.(?:exe|js))"\s+%\*/i)?.[1];
  if (!target) return null;
  const resolved = path.join(base, ...target.split('\\'));
  if (!existingFile(resolved)) return null;  return resolved.toLowerCase().endsWith('.js')
    ? { command: process.execPath, prependArgs: [resolved] }
    : { command: resolved, prependArgs: [] };
}

export function resolveLaunchCommand(command, args = []) {
  if (process.platform !== 'win32') return { command, args };
  const candidates = windowsCandidates(command);
  const native = candidates.find(x => /\.(?:exe|com)$/i.test(x));
  if (native) return { command: native, args };
  for (const shim of candidates.filter(x => /\.cmd$/i.test(x))) {
    const resolved = resolveNpmCmdShim(shim);
    if (resolved) return { command: resolved.command, args: [...resolved.prependArgs, ...args] };
  }
  const direct = candidates.find(x => !/\.(?:cmd|bat)$/i.test(x));
  if (direct) return { command: direct, args };
  return { command, args };
}

export function launchFailureDetail(result) {
  if (result?.error?.code) return `${result.error.code}:${result.error.message || 'launch failed'}`;
  const stderr = String(result?.stderr || '').trim();
  const stdout = String(result?.stdout || '').trim();
  if (stderr) return stderr.slice(0, 1000);
  if (stdout) return stdout.slice(0, 1000);
  return String(result?.status ?? 'NO_EXIT_STATUS');
}

export function classifyLaunchFailure(adapter, role, result) {
  const prefix = `${String(adapter).toUpperCase()}_${String(role).toUpperCase()}`;
  const detail = launchFailureDetail(result);
  if (/failed to authenticate|oauth session expired|authentication required|not logged in/i.test(detail)) return `${prefix}_AUTH_REQUIRED:${detail}`;
  return `${prefix}_FAILED:${detail}`;
}
