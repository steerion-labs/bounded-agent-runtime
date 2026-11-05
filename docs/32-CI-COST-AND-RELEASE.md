# BAR CI scheduling and resource control — v0.6 candidate

## Observed baseline (read-only GitHub API, 2026-11-05)

- The off-host durability workflow returned **281** historical workflow runs.
- Its 100 newest returned runs covered approximately 2026-10-15 to 2026-10-31
  and were all scheduled events. The last observed run was on 2026-10-31.
- The API did not provide the repository's billable Actions minutes
  (`actions/billing/usage` returned HTTP 404). **No billed-minute total is claimed.**
- Configured baseline: hourly core checks on Ubuntu + Windows, plus one
  daily container isolation proof.

## Proposed reduction (NOT implemented; requires authorised workflow scope)

- Proposed core schedule: from `17 * * * *` (24 scheduled invocations per day)
  to `17 */6 * * *` (4 scheduled invocations per day).
- Daily container proof at `43 3 * * *` remains unchanged.
- Core runs still test **Ubuntu and Windows**.
- Immediate `push: main` and security-sensitive `pull_request: main`
  triggers remain unchanged; no CodeQL or required security job is removed.
- Theoretical scheduled job reduction: **49 to 9 jobs per day**, assuming
  every configured schedule runs. **Not a measured billing saving.**
- Trade-off: off-host *scheduled* core failure detection may take up to
  six hours plus GitHub scheduling delays instead of up to one hour.
  A change to main or an in-scope PR still requests the original immediate jobs.

## Repository write limitation

The integration branch attempted to include the schedule change, but
GitHub rejected the push because the connected OAuth app lacks the
`workflow` scope. We removed the workflow and its altered regression
test from this candidate rather than bypassing the permission.
**The active workflow remains unchanged.** A separately authorised,
reviewed workflow PR is required.

## Validation and limits

- Check the exact workflow diff and PR head before applying this change.
- Verify full Ubuntu/Windows/container proof on an accepted candidate.
- Do not manually re-run Actions solely for cosmetics or to bypass missing
  Docker access on a protected Netcup worker.
- Confirm real billed usage and detection latency once the owner can access
  GitHub Billing. Revert cadence if the security response objective requires
  more frequent scheduled proof.

## Release gate

Version 0.6 is **NOT RELEASE READY** until all open security evidence
requirements (#85–#88), cross-platform tests, independent exact-head
review, release scan and the explicit Human Gate are satisfied.
This file does not authorize merge or publication.
