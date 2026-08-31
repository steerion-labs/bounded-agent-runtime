# Contributing

Contributions are welcome through issues and pull requests. Start with the public roadmap or an issue labelled `good first issue`.

## Local workflow

```powershell
npm install
npm test
npm run test:container   # optional when Docker is available
```

Keep changes small, explain the user problem, and include tests for behavior changes.

## Adapter contributions

Read `docs/19-ADAPTER-CONFORMANCE.md` first. A new adapter must document its non-interactive CLI contract, least-privilege execution mode, credential assumptions, timeout behavior and Reviewer output format. It must not gain protected-action authority.

## Security-sensitive changes

Security and authority rules are design contracts. Changes touching isolation, evidence, candidate identity, budgets, network access, credentials, recovery, Reviewer independence or Human Gate behavior must include threat analysis and negative fail-closed tests.

Do not introduce automatic merge, deploy, publish or release behavior as a convenience shortcut. A future side-effect adapter must re-check protected authorization immediately before the side effect and define idempotency and reconciliation.

## Public-safe examples

Keep examples generic and synthetic. Never contribute private project material, personal machine paths, access tokens, private keys, organization-internal data or credentials.

## Pull request evidence

Include the exact commands you ran, pass/fail counts, relevant platform details, and any known limitation. Green tests are evidence, not proof that a security-sensitive change is safe; reviewers should still challenge the authority model.
