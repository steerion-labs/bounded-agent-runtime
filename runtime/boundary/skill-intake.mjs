const RISK_SURFACES = new Set(['shell','filesystem-write','network','secrets','mcp','hooks','plugins','browser-submit']);

export function assessSkillCandidate(candidate) {
  if (!candidate || typeof candidate !== 'object') throw new Error('BOUNDARY_SKILL_CANDIDATE_INVALID');
  if (typeof candidate.name !== 'string' || !candidate.name.trim()) throw new Error('BOUNDARY_SKILL_CANDIDATE_INVALID:name');
  if (typeof candidate.source !== 'string' || !/^https:\/\//i.test(candidate.source)) throw new Error('BOUNDARY_SKILL_CANDIDATE_INVALID:source');
  const surfaces = Array.isArray(candidate.surfaces) ? [...new Set(candidate.surfaces)] : [];
  const unknown = surfaces.filter(surface => !RISK_SURFACES.has(surface));
  if (unknown.length) throw new Error(`BOUNDARY_SKILL_SURFACE_UNKNOWN:${unknown.join(',')}`);
  const blockers = [];
  if (!candidate.license) blockers.push('LICENSE_UNVERIFIED');
  if (candidate.auto_install === true) blockers.push('AUTO_INSTALL_FORBIDDEN');
  if (candidate.auto_mutate === true) blockers.push('AUTO_MUTATION_FORBIDDEN');
  const highRisk = surfaces.filter(surface => ['shell','filesystem-write','network','secrets','mcp','hooks','plugins','browser-submit'].includes(surface));
  return Object.freeze({
    name: candidate.name.trim(),
    source: candidate.source,
    decision: blockers.length ? 'REJECT' : 'LABS_REVIEW_REQUIRED',
    blockers: Object.freeze(blockers),
    risk_surfaces: Object.freeze(highRisk),
    direct_promotion_allowed: false,
    required_flow: Object.freeze(['INTAKE','DEPENDENCY_AUDIT','SECURITY_REVIEW','SANDBOX_TEST','DECISION'])
  });
}