export const transitions = Object.freeze({
  NEW: ['CLASSIFIED'],
  CLASSIFIED: ['CONTEXT_READY'],
  CONTEXT_READY: ['AUTHORIZED'],
  AUTHORIZED: ['BUILDING'],
  BUILDING: ['TESTING'],
  TESTING: ['HANDOFF_VALIDATION'],
  HANDOFF_VALIDATION: ['REVIEWING'],
  REVIEWING: ['REVIEW_READY'],
  REVIEW_READY: ['HUMAN_GATE'],
  HUMAN_GATE: ['ACCEPTED'],
  ACCEPTED: ['CONTROLLER_MUTATION'],
  CONTROLLER_MUTATION: ['VERIFIED'],
  VERIFIED: ['DONE']
});

export function assertTransition(from, to) {
  const allowed = transitions[from] ?? [];
  if (!allowed.includes(to)) {
    throw new Error(`ILLEGAL_TRANSITION:${from}->${to}`);
  }
}
