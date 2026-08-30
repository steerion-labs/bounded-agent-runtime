# Security Policy

## Supported versions

Security fixes are applied to the current `main` branch. Until tagged releases are published, no older commit should be assumed to receive security backports.

## Reporting a vulnerability

Do not open a public issue for a vulnerability that could enable authority bypass, credential exposure, sandbox escape, reviewer bypass, evidence forgery, Human Gate bypass or protected mutation.

Use GitHub Private Vulnerability Reporting for this repository when available. If that channel is unavailable, open a minimal public issue asking the maintainers for a private reporting channel without including exploit details.

Do not submit real secrets, tokens, private keys, customer data, proprietary source code or production credentials in a report.

## Response expectations

This is a community open-source reference project and does not offer a contractual SLA. Maintainers should acknowledge valid private reports as soon as practical, keep exploit details private while a fix is being prepared, and publish remediation notes after affected code is fixed.

## Security scope

The repository contains controller enforcement logic plus Windows isolation setup and verification scripts. It is not a security certification for a host.

The demo child processes do not prove separate Windows-token isolation. Before enabling real external mutations, operators must verify the actual worker identities, filesystem access, credentials, installed tools, network policy and mutation adapter behavior on the target host.

Any replacement adapter, new tool fallback, policy change or external side effect changes the threat model and requires re-verification.
