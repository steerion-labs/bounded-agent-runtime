[CmdletBinding()]
param(
    [string]$Root = 'C:\BoundedAgentRuntime',
    [string]$ControllerName = 'AgentController',
    [string]$BuilderName = 'AgentBuilder',
    [string]$ReviewerName = 'AgentReviewer'
)
$ErrorActionPreference = 'Stop'
$failures = [System.Collections.Generic.List[string]]::new()
function Get-Sid([string]$Name) { return (Get-LocalUser -Name $Name -ErrorAction Stop).SID.Value }
function Rule-Sid($Rule) {
    try { return $Rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value }
    catch { return $Rule.IdentityReference.Value }
}
$controllerSid = Get-Sid $ControllerName
$builderSid = Get-Sid $BuilderName
$reviewerSid = Get-Sid $ReviewerName
$forbiddenBroad = @('S-1-1-0','S-1-5-11','S-1-5-32-545')
$protected = 'runtime-core','runtime-state','secrets','verification-work','journal'
foreach ($zone in $protected) {
    $p = Join-Path $Root $zone
    if (-not (Test-Path $p)) { $failures.Add("Missing protected zone: $zone"); continue }
    $acl = Get-Acl $p
    if (-not $acl.AreAccessRulesProtected) { $failures.Add("Inheritance enabled: $zone") }
    $controllerAllow = $false
    foreach ($rule in $acl.Access) {
        $sid = Rule-Sid $rule
        if ($sid -eq $controllerSid -and $rule.AccessControlType -eq 'Allow') { $controllerAllow = $true }
        if ($sid -in @($builderSid,$reviewerSid)) { $failures.Add("Worker ACL present: $sid -> $zone") }
        if ($sid -in $forbiddenBroad -and $rule.AccessControlType -eq 'Allow') { $failures.Add("Broad allow principal: $sid -> $zone") }
    }    if (-not $controllerAllow) { $failures.Add("Controller allow missing: $zone") }
}
$expected = @{
    'builder-work' = $builderSid
    'reviewer-work' = $reviewerSid
}
foreach ($zone in $expected.Keys) {
    $p = Join-Path $Root $zone
    if (-not (Test-Path $p)) { $failures.Add("Missing worker zone: $zone"); continue }
    $acl = Get-Acl $p
    $found = $false
    foreach ($rule in $acl.Access) {
        $sid = Rule-Sid $rule
        if ($sid -eq $expected[$zone] -and $rule.AccessControlType -eq 'Allow') { $found = $true }
    }
    if (-not $found) { $failures.Add("Expected worker allow missing: $zone") }
}
$adminGroup = Get-LocalGroup -SID ([Security.Principal.SecurityIdentifier]'S-1-5-32-544') -ErrorAction Stop
$admins = @(Get-LocalGroupMember -Group $adminGroup.Name -ErrorAction Stop | ForEach-Object { $_.SID.Value })
foreach ($sid in @($builderSid,$reviewerSid)) {
    if ($sid -in $admins) { $failures.Add("Worker is administrator: $sid") }
}
if ($failures.Count) { $failures | ForEach-Object { Write-Error $_ }; exit 1 }
Write-Host 'STATIC_ACL_PASS'
Write-Host 'This is a static SID/ACL check, not a token-level effective-access proof.'