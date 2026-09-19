import { assertRemoteProvider, createRemoteResult, validateRemoteDispatch } from './contracts.mjs';

export function createGithubHostedReferenceProvider(env = process.env) {
  const provider = {
    id: 'github-hosted-runner',
    protectedEffectsAllowed: false,
    isolation: 'EPHEMERAL_GITHUB_HOSTED_RUNNER',
    networkPolicy: 'DECLARED_EGRESS',
    maxLifetimeSeconds: 600,
    prepare(dispatch) {
      validateRemoteDispatch(dispatch);
      if (dispatch.providerId !== this.id) throw new Error('REMOTE_PROVIDER_DISPATCH_MISMATCH');
      return Object.freeze({ dispatch, providerId: this.id });
    },
    execute(prepared) {
      validateRemoteDispatch(prepared.dispatch);
      return Object.freeze({
        providerId: this.id,
        providerRunId: String(env.GITHUB_RUN_ID || 'local-reference-proof'),
        dispatchHash: prepared.dispatch.dispatchHash,
        status: 'RUNNING'
      });
    },
    collect(run, { dispatch, candidateSha, treeHash, evidence }) {
      if (run.providerId !== this.id || !run.providerRunId || run.dispatchHash !== dispatch.dispatchHash || dispatch.providerId !== this.id) throw new Error('REMOTE_PROVIDER_RUN_INVALID');
      return createRemoteResult({
        dispatch,
        providerId: this.id,
        providerRunId: run.providerRunId,
        candidateSha,
        treeHash,
        evidence,
        protectedEffectsAttempted: false
      });
    },
    cancel(run) {
      if (run.providerId !== this.id || !run.providerRunId) throw new Error('REMOTE_PROVIDER_RUN_INVALID');
      return Object.freeze({ providerId: this.id, providerRunId: run.providerRunId, status: 'CANCELLED', protectedEffectsAttempted: false });
    }
  };
  assertRemoteProvider(provider);
  return Object.freeze(provider);
}
