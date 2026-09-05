function requiredString(value, code) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(code);
  return value.trim();
}

export function createFreshContextReview({ task_id, candidate_sha, tree_hash, builder_id, reviewer_id, evidence_refs = [] }) {
  const taskId = requiredString(task_id, 'BOUNDARY_REVIEW_TASK_REQUIRED');
  const candidate = requiredString(candidate_sha, 'BOUNDARY_REVIEW_CANDIDATE_REQUIRED');
  const tree = requiredString(tree_hash, 'BOUNDARY_REVIEW_TREE_REQUIRED');
  const builder = requiredString(builder_id, 'BOUNDARY_REVIEW_BUILDER_REQUIRED');
  const reviewer = requiredString(reviewer_id, 'BOUNDARY_REVIEW_REVIEWER_REQUIRED');
  if (builder === reviewer) throw new Error('BOUNDARY_REVIEW_INDEPENDENCE_REQUIRED');
  if (!Array.isArray(evidence_refs)) throw new Error('BOUNDARY_REVIEW_EVIDENCE_REFS_INVALID');
  return Object.freeze({
    task_id: taskId,
    candidate_sha: candidate,
    tree_hash: tree,
    builder_id: builder,
    reviewer_id: reviewer,
    evidence_refs: Object.freeze([...evidence_refs]),
    context_policy: 'FRESH_CONTEXT',
    workspace_mode: 'READ_ONLY',
    credential_mode: 'NONE',
    authority: 'NONE',
    may_mutate_candidate: false,
    may_approve_protected_action: false,
    verdicts: Object.freeze(['PASS','FAIL','NEEDS_EVIDENCE'])
  });
}

export function assertReviewVerdict(review, { verdict, candidate_sha, tree_hash }) {
  if (!review || review.context_policy !== 'FRESH_CONTEXT') throw new Error('BOUNDARY_REVIEW_CONTRACT_REQUIRED');
  if (!review.verdicts.includes(verdict)) throw new Error('BOUNDARY_REVIEW_VERDICT_INVALID');
  if (review.candidate_sha !== candidate_sha || review.tree_hash !== tree_hash) throw new Error('BOUNDARY_REVIEW_CANDIDATE_DRIFT');
  return Object.freeze({ verdict, candidate_sha, tree_hash, authority: 'NONE', human_gate_unchanged: true });
}
