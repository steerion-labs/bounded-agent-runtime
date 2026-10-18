# Contributing

Contributions are welcome through issues and pull requests. Start with the public roadmap, a `good first issue`, or a concrete authority-boundary problem you can reproduce.

## Fast local workflow

```bash
npm install
npm run demo:attack
npm test
npm run test:container   # optional when Docker is available
```

Keep changes small, explain the user problem, and include tests for behavior changes.

## Good first contributions

Useful first contributions include:

- clearer docs or error messages
- portability fixes
- adapter version reporting
- read-only evidence/dashboard improvements
- additional negative tests
- reproducible synthetic examples

Avoid broad refactors as a first contribution to security-sensitive code.

## Adapter contributions

Read `docs/19-ADAPTER-CONFORMANCE.md` first. A new adapter must document its non-interactive CLI contract, least-privilege execution mode, credential assumptions, timeout behavior and Reviewer output format. It must not gain protected-action authority.

## Security-sensitive changes

Security and authority rules are design contracts. Changes touching isolation, evidence, candidate identity, budgets, network access, credentials, recovery, Reviewer independence, publication or Human Gate behavior must include threat analysis and negative fail-closed tests.

Do not introduce automatic merge, deploy, publish or release behavior as a convenience shortcut. A future side-effect adapter must re-check protected authorization immediately before the side effect and define idempotency and reconciliation.

## Public-safe examples

Keep examples generic and synthetic. Never contribute private project material, personal machine paths, access tokens, private keys, organization-internal data or credentials.

## Pull request evidence

Include:

- the exact commit tested
- exact commands run
- pass/fail counts
- relevant OS/runtime/adapter versions
- security impact
- known limitations

Green tests are evidence, not proof that a security-sensitive change is safe. Reviewers should still challenge the authority model.

## Community

Usage questions and design discussions belong in GitHub Discussions. Bugs and concrete feature work belong in Issues. Vulnerabilities follow [SECURITY.md](SECURITY.md), not public issue threads.

Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).
