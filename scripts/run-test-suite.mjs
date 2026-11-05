import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = fs.readdirSync(path.join(root, 'test'))
  .filter(file => file.endsWith('.test.mjs') && file !== 'container.e2e.mjs')
  .sort();
const fileTimeoutMs = 90000;
const totals = { files: files.length, tests: 0, pass: 0, fail: 0, skipped: 0, cancelled: 0 };
let hadFailure = false;
for (const file of files) {
  const started = Date.now();
  const result = spawnSync(process.execPath, ['--test', path.join(root, 'test', file)], {
    cwd: root, encoding: 'utf8', env: { ...process.env },
    timeout: fileTimeoutMs, windowsHide: true, maxBuffer: 8 * 1024 * 1024
  });
  const output = String(result.stdout || '') + '\n' + String(result.stderr || '');
  const metric = key => {
    const match = output.match(new RegExp('(?:^|\\n)(?:# |ℹ )' + key + ' (\\d+)(?=\\r?\\n|$)', 'm'));
    return match ? Number(match[1]) : null;
  };
  const metrics = {
    tests: metric('tests'), pass: metric('pass'),
    fail: metric('fail'), skipped: metric('skipped'),
    cancelled: metric('cancelled')
  };
  const passed = result.status === 0 && !result.error && metrics.tests !== null &&
    metrics.fail === 0 && metrics.pass !== null &&
    metrics.pass + (metrics.skipped ?? 0) + (metrics.cancelled ?? 0) === metrics.tests;
  console.log((passed ? 'PASS' : 'FAIL').padEnd(5) + ' ' + file +
    ' (' + (Date.now() - started) + 'ms, pass=' + String(metrics.pass) +
    ', skip=' + String(metrics.skipped) + ')');
  if (passed) {
    for (const [key, value] of Object.entries(metrics)) totals[key] += value ?? 0;
  } else {
    hadFailure = true;
    totals.fail += 1;
    const reason = result.error?.code || result.signal || result.status;
    console.error('TEST_FILE_FAILED=' + file + ' reason=' + String(reason));
    console.error(output.slice(-6000));
  }
}
console.log('BAR_TEST_SUITE ' + JSON.stringify({ ...totals, status: hadFailure ? 'FAIL' : 'PASS', fileTimeoutMs }));
if (hadFailure) process.exitCode = 1;
