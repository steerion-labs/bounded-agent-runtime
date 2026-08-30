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
$builderSid = (Get-LocalUser -Name $BuilderName -ErrorAction Stop).SID.Value
$reviewerSid = (Get-LocalUser -Name $ReviewerName -ErrorAction Stop).SID.Value
$adminGroup = Get-LocalGroup -SID ([Security.Principal.SecurityIdentifier]'S-1-5-32-544') -ErrorAction Stop
$admins = @(Get-LocalGroupMember -Group $adminGroup.Name -ErrorAction Stop | ForEach-Object { $_.SID.Value })
foreach ($sid in @($builderSid,$reviewerSid)) {
    if ($sid -in $admins) { $failures.Add("Worker is administrator: $sid") }
}
$zones = 'runtime-core','runtime-state','secrets','evidence','builder-work','reviewer-work','journal'
foreach ($zone in $zones) {
    if (-not (Test-Path (Join-Path $Root $zone))) { $failures.Add("Missing zone: $zone") }
}$forbidden = @('runtime-core','runtime-state','secrets','journal')
foreach ($zone in $forbidden) {
    $acl = Get-Acl (Join-Path $Root $zone)
    foreach ($rule in $acl.Access) {
        $sid = try { $rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value } catch { $rule.IdentityReference.Value }
        if ($sid -in @($builderSid,$reviewerSid)) { $failures.Add("Forbidden worker ACL grant: $sid -> $zone") }
    }
}
if ($failures.Count) {
    $failures | ForEach-Object { Write-Error $_ }
    exit 1
}
Write-Host 'HOST_BASELINE_PASS'
Write-Host 'This proves baseline account/ACL configuration only.'
Write-Host 'Run Test-StaticAcl.ps1, then Test-WorkerAccess.ps1 with real worker credentials.'