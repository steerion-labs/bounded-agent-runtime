import test from 'node:test';
import assert from 'node:assert/strict';
import { SECURITY_CONTROLS, evaluateSecurityControls } from '../scripts/security-evidence-controls.mjs';

const allFiles = [...new Set(SECURITY_CONTROLS.flatMap(c => c.tests))].map(name => ({
  file: 'test/' + name + '.test.mjs', status: 'PASS', exitCode: 0
}));
const positive = {
  clean: true, denials: { status: 'PASS' },
  secretScan: { status: 'PASS' }, dependencyInventory: { status: 'PASS' }
};

test('all 13 controls have bounded, traceable evidence states', () => {
  assert.equal(SECURITY_CONTROLS.length, 13);
  assert.equal(new Set(SECURITY_CONTROLS.map(c => c.id)).size, 13);
  const rows = evaluateSecurityControls(allFiles, positive);
  assert.equal(rows.length, 13);
  assert.equal(rows.filter(r => r.status === 'PASS').length, 8);
  assert.equal(rows.filter(r => r.status === 'PARTIAL').length, 3);
  assert.equal(rows.filter(r => r.status === 'BLOCKED').length, 2);
  assert.ok(rows.every(r => r.evidenceKind === 'LOCAL_REPOSITORY_TESTS_ONLY'));
});

test('missing, failed or nonzero required evidence prevents PASS', () => {
  const missing = evaluateSecurityControls([], positive);
  assert.equal(missing.find(r => r.id === 'BAR-SEC-001').status, 'REVIEW_REQUIRED');
  const failed = allFiles.map(x => x.file === 'test/runtime.test.mjs'
    ? { ...x, status: 'FAIL', exitCode: 1 } : x);
  const rows = evaluateSecurityControls(failed, positive);
  assert.equal(rows.find(r => r.id === 'BAR-SEC-001').status, 'REVIEW_REQUIRED');
  assert.equal(rows.find(r => r.id === 'BAR-SEC-013').status, 'REVIEW_REQUIRED');
  assert.equal(evaluateSecurityControls(allFiles, { ...positive, denials: null })
    .find(r => r.id === 'BAR-SEC-001').status, 'REVIEW_REQUIRED');
  assert.equal(evaluateSecurityControls(allFiles, { ...positive, clean: false })
    .find(r => r.id === 'BAR-SEC-012').status, 'REVIEW_REQUIRED');
  assert.equal(evaluateSecurityControls(allFiles, { ...positive, secretScan: { status: 'FAIL' } })
    .find(r => r.id === 'BAR-SEC-011').status, 'REVIEW_REQUIRED');
});

test('effective OS host isolation is never inferred from local tests', () => {
  const rows = evaluateSecurityControls(allFiles, positive);
  for (const id of ['BAR-SEC-007', 'BAR-SEC-010']) {
    assert.equal(rows.find(x => x.id === id).status, 'BLOCKED');
  }
});
