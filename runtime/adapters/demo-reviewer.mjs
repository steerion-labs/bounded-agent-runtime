export async function runReviewer(candidate) {
  if (!candidate?.candidate_sha || !candidate?.tree_hash) return { decision:'BLOCK', reason:'missing candidate binding' };
  return {decision:'APPROVE',reviewed_candidate_sha:candidate.candidate_sha,reviewed_tree_hash:candidate.tree_hash,residual_risks:['demo reviewer is logically separated; Windows identity isolation is verified separately']};
}
