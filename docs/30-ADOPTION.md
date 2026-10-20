# Adopt BAR in an existing repository

BAR is a security runtime for bounded coding-agent work, **not** a shortcut to merge/deploy authority.

## 1. Try the synthetic proof

Requirements: Node.js 20+ and Git.

```bash
git clone https://github.com/steerion-labs/bounded-agent-runtime.git
cd bounded-agent-runtime
npm install
npm run demo
```

The attack demo expects `4/4 ATTACKS BLOCKED` and quickstart expects `HUMAN_GATE_REQUIRED`. These are synthetic, no-credential proofs; they do **not** certify an arbitrary host. [Details](28-DEMO.md).

## 2. Check local compatibility

```bash
node bin/bar.mjs agents --json
node bin/bar.mjs doctor --json
```

Record detected worker versions and host boundary; **supported** does not mean independently isolated. See [compatibility](29-COMPATIBILITY.md).

## 3. Preview on your own project

Install the tagged release as described in [README](../README.md#stable-tagged-release). Then, using an existing **clean** repository:

```bash
bar work \
  --repo /absolute/path/to/your-repo \
  --goal "Fix the failing parser test" \
  --allow src \
  --allow test \
  --builder auto \
  --reviewer auto \
  --verify npm \
  --verify-arg test \
  --dry-run
```

Change allowed paths and verification command for your project. Inspect dry-run scope before removing `--dry-run`. Do not run repository-controlled verification under privileged controller credentials.

## 4. Understand what BAR does not guarantee

BAR binds candidates to evidence and stops at required Human Gates; it does not ship a default real merge/deploy/release adapter. A Reviewer in a separate process is not automatically an organizationally independent reviewer. Local CLI workers are not OS-isolated; their network access follows the host. Optional Docker `network none` strengthens worker boundaries but does not neutralize Docker daemon compromise. Read [SECURITY.md](../SECURITY.md) and [protected-action handoff](23-PROTECTED-ACTION-HANDOFF.md).

## 5. Contribute useful feedback

For bugs include BAR version, host OS, Node version, worker adapter/version, exact sanitized command, observed vs expected result, and synthetic reproduction. Use [CONTRIBUTING](../CONTRIBUTING.md). For an authority bypass or exposed credential, **do not post exploits in public issues**; follow the private vulnerability process in [SECURITY.md](../SECURITY.md).
