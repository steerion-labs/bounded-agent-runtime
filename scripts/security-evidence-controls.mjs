export const SECURITY_CONTROLS = Object.freeze([
  { id: 'BAR-SEC-001', tier: 'P0', tests: ['runtime', 'candidate-publication', 'demo-attack'], scopeStatus: 'PASS', limit: 'Repository denial tests, not a live attacker or protected host.' },
  { id: 'BAR-SEC-002', tier: 'P0', tests: ['runtime', 'integration', 'remote-execution', 'review-resume'], scopeStatus: 'PASS', limit: 'Local fencing and replay tests, not a production distributed transaction.' },
  { id: 'BAR-SEC-003', tier: 'P0', tests: ['runtime', 'integration'], scopeStatus: 'PASS', limit: 'Repository state-machine tests only.' },
  { id: 'BAR-SEC-004', tier: 'P0', tests: ['runtime', 'doctor', 'cli'], scopeStatus: 'PARTIAL', limit: 'Real worker process/credential effective-access proof is missing (#87).' },
  { id: 'BAR-SEC-005', tier: 'P0', tests: ['runtime', 'integration'], scopeStatus: 'PASS', limit: 'Signed approval and tampering tests, not a real external action adapter.' },
  { id: 'BAR-SEC-006', tier: 'P0', tests: ['runtime', 'integration', 'durability-workflow'], scopeStatus: 'PASS', limit: 'Local recovery and durability, not productive distributed recovery.' },
  { id: 'BAR-SEC-007', tier: 'P0', tests: ['runtime', 'integration', 'work-request'], scopeStatus: 'BLOCKED', limit: 'Real Linux and Windows OS principal/path traversal proof missing (#87).' },
  { id: 'BAR-SEC-008', tier: 'P1', tests: ['dashboard'], scopeStatus: 'PASS', limit: 'Read-only dashboard repository regressions only.' },
  { id: 'BAR-SEC-009', tier: 'P1', tests: ['doctor', 'cli'], scopeStatus: 'PASS', limit: 'Linux run skips Windows-specific launcher tests; cross-platform proof is separate.' },
  { id: 'BAR-SEC-010', tier: 'P1', tests: ['runtime'], scopeStatus: 'BLOCKED', limit: 'Named deployed Linux and Windows protected-host proof not available (#87).' },
  { id: 'BAR-SEC-011', tier: 'P1', tests: [], scopeStatus: 'PARTIAL', limit: 'Tracked-file heuristic scan and lock fingerprint only; no full Git-history or independent supply-chain audit.' },
  { id: 'BAR-SEC-012', tier: 'P1', tests: ['durability-workflow'], scopeStatus: 'PARTIAL', limit: 'Local clean exact-head proof does not establish off-host cloud parity or real host security.' },
  { id: 'BAR-SEC-013', tier: 'P1', tests: ['runtime'], scopeStatus: 'PASS', limit: 'Deterministic obfuscation regressions; live-agent intent attacks require #86.' }
]);

export function evaluateSecurityControls(tests, context = {}) {
  const byFile = new Map(tests.map(t => [t.file, t]));
  return SECURITY_CONTROLS.map(control => {
    const required = control.tests.map(name => 'test/' + name + '.test.mjs');
    const observations = required.map(file => {
      const observation = byFile.get(file);
      return { file, status: observation?.status || 'NOT_RUN', exitCode: observation?.exitCode ?? null };
    });
    const ready = observations.every(t => t.status === 'PASS' && t.exitCode === 0);
    const extra = control.id === 'BAR-SEC-011'
      ? context.secretScan?.status === 'PASS' && context.dependencyInventory?.status === 'PASS'
      : control.id === 'BAR-SEC-012'
        ? context.clean === true
        : control.id === 'BAR-SEC-001'
          ? context.denials?.status === 'PASS'
          : true;
    const status = ready && extra ? control.scopeStatus : 'REVIEW_REQUIRED';
    return {
      id: control.id, tier: control.tier, status,
      repoScopeStatus: control.scopeStatus,
      testObservations: observations,
      limitation: control.limit,
      evidenceKind: 'LOCAL_REPOSITORY_TESTS_ONLY'
    };
  });
}
