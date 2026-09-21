import {
  assertCandidatePublisher,
  createCandidatePublicationReceipt,
  validateCandidatePublicationRequest
} from './candidate-publication.mjs';

export function createReferenceCandidatePublisher(env = process.env) {
  const provider = {
    id: 'synthetic-candidate-publisher',
    protectedEffectsAllowed: false,
    mergeAllowed: false,
    forcePushAllowed: false,
    prepare(request) {
      validateCandidatePublicationRequest(request);
      if (request.providerId !== this.id) throw new Error('CANDIDATE_PUBLISH_PROVIDER_DISPATCH_MISMATCH');
      return Object.freeze({ request, providerId: this.id });
    },
    publish(prepared) {
      validateCandidatePublicationRequest(prepared.request);
      return Object.freeze({
        providerId: this.id,
        providerRunId: String(env.GITHUB_RUN_ID || 'local-synthetic-candidate-publish'),
        status: 'SYNTHETIC_ONLY'
      });
    },
    collect(run, { request, pullRequestNumber = 1 } = {}) {
      if (run.providerId !== this.id || !run.providerRunId || request.providerId !== this.id) {
        throw new Error('CANDIDATE_PUBLISH_PROVIDER_RUN_INVALID');
      }
      return createCandidatePublicationReceipt({
        request,
        providerId: this.id,
        providerRunId: run.providerRunId,
        observedBaseHead: request.baseHead,
        remoteBranchRef: `refs/heads/${request.candidateBranch}`,
        remoteCandidateSha: request.candidateSha,
        remoteTreeHash: request.treeHash,
        pullRequestNumber,
        protectedEffectsAttempted: false
      });
    },
    cancel(run) {
      if (run.providerId !== this.id || !run.providerRunId) throw new Error('CANDIDATE_PUBLISH_PROVIDER_RUN_INVALID');
      return Object.freeze({
        providerId: this.id,
        providerRunId: run.providerRunId,
        status: 'CANCELLED',
        protectedEffectsAllowed: false
      });
    }
  };
  assertCandidatePublisher(provider);
  return Object.freeze(provider);
}
