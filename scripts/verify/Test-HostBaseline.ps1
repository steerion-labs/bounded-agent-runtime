[CmdletBinding()]
param(
    [string]$Root = 'C:\BoundedAgentRuntime',
    [string]$ControllerName = 'AgentController',
    [string]$BuilderName = 'AgentBuilder',
    [string]$ReviewerName = 'AgentReviewer'
)
$ErrorActionPreference = 'Stop'
$failures = [System.Collections.Generic.List[string]]::new()

foreach ($name in @($ControllerName,$BuilderName,$ReviewerName)) {
    $user = Get-LocalUser -Name $name -ErrorAction SilentlyContinue
    if (-not $user) { $failures.Add("Missing local user: $name"); continue }
    if (-not $user.Enabled) { $failures.Add("Disabled local user: $name") }
}
$admins = @(Get-LocalGroupMember -Group 'Administrators' -ErrorAction Stop | ForEach-Object Name)
foreach ($name in @($BuilderName,$ReviewerName)) {
    if ($admins -match "\\$([regex]::Escape($name))$") { $failures.Add("Worker is administrator: $name") }
}
$zones = 'runtime-core','runtime-state','secrets','evidence','builder-work','reviewer-work','journal'
foreach ($zone in $zones) {
    if (-not (Test-Path (Join-Path $Root $zone))) { $failures.Add("Missing zone: $zone") }
}

$forbidden = @('runtime-core','runtime-state','secrets','journal')
foreach ($zone in $forbidden) {
    $acl = Get-Acl (Join-Path $Root $zone)
    foreach ($name in @($BuilderName,$ReviewerName)) {
        if ($acl.Access.IdentityReference.Value -match "\\$([regex]::Escape($name))$") {
            $failures.Add("Forbidden explicit ACL grant: $name -> $zone")
        }
    }
}

if ($failures.Count) {
    $failures | ForEach-Object { Write-Error $_ }
    exit 1
}
Write-Host 'HOST_BASELINE_PASS'
Write-Host 'This proves baseline account/ACL configuration only.'
Write-Host 'Run effective-access/adversarial checks before autonomous mutation.'
