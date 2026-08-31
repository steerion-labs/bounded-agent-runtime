# Network Broker and Secrets

BAR includes an optional controller-owned HTTPS path for integrations that need narrowly scoped outbound requests.

## Policy

See `policies/network-policy.example.json`.

A policy declares:

- allowed HTTPS hosts
- allowed ports
- allowed methods
- request/response byte limits
- timeout
- optional redirect policy
- host-specific secret header injection

`bar net check` resolves the target before connection and rejects private, loopback, link-local, benchmark and cloud-metadata address space.

```powershell
bar net check https://api.example.com --policy policies\network-policy.example.json
```

Wildcard host entries match subdomains only. `*.example.com` does not authorize `example.com` or `evil-example.com`.

## Secrets

```powershell
$env:API_TOKEN = '...'
bar secret set example_api --from-env API_TOKEN
bar secret list
```
Secrets are stored below the runtime secret zone and are never written into task JSON. Listing secrets returns names only.

Configured secret headers are injected by the broker after the public request headers are sanitized. Authorization/cookie/proxy-auth headers supplied by callers are stripped, and hop-by-hop/Host/Content-Length secret injection is rejected.

## Request path

```powershell
bar broker request https://api.example.com/v1/status `
  --policy policies\network-policy.example.json
```

The broker pins the already-validated DNS result for the TLS connection, preserves the original hostname for SNI/certificate validation, and enforces time/size limits.

Redirects are fail-closed unless the policy explicitly enables them. Redirect targets are checked again through the same network policy.

## Critical limitation

**The broker is not worker egress enforcement.**

If a Builder/Reviewer process can directly open arbitrary sockets, it may bypass the broker. Protected deployments must combine the broker with OS/container/network controls that deny direct worker egress. `bar doctor` reports this distinction instead of claiming the broker is a firewall.

The Docker adapter uses `--network none` by default and therefore provides a concrete zero-egress worker mode. Other local CLI adapters inherit the host's actual network boundary.
