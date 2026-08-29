[CmdletBinding()]
param(
    [string]$Root = 'C:\BoundedAgentRuntime',
    [string]$ControllerName = 'AgentController',
    [string]$BuilderName = 'AgentBuilder',
    [string]$ReviewerName = 'AgentReviewer'
)
$ErrorActionPreference = 'Stop'
$failures = [System.Collections.Generic.List[string]]::new()
$protected = 'runtime-core','runtime-state','secrets','journal'
$workerWritable = @{ 'builder-work'=$BuilderName; 'reviewer-work'=$ReviewerName }
foreach ($zone in $protected) {
    $p = Join-Path $Root $zone
    if (-not (Test-Path $p)) { $failures.Add("Missing protected zone: $zone"); continue }
    $acl = Get-Acl $p
    if (-not $acl.AreAccessRulesProtected) { $failures.Add("Inheritance still enabled: $zone") }
    foreach ($name in @($BuilderName,$ReviewerName)) {
        if ($acl.Access.IdentityReference.Value -match "\\$([regex]::Escape($name))$") { $failures.Add("Worker ACL present: $name -> $zone") }
    }
}
foreach ($zone in $workerWritable.Keys) {
    $p = Join-Path $Root $zone; $name=$workerWritable[$zone]
    $acl=Get-Acl $p
    $rule=$acl.Access | Where-Object { $_.IdentityReference.Value -match "\\$([regex]::Escape($name))$" -and $_.AccessControlType -eq 'Allow' }
    if (-not $rule) { $failures.Add("Expected worker grant missing: $name -> $zone") }
}
$admins=@(Get-LocalGroupMember -Group 'Administrators' -ErrorAction Stop | ForEach-Object Name)
foreach($name in @($BuilderName,$ReviewerName)){if($admins -match "\\$([regex]::Escape($name))$"){$failures.Add("Worker is administrator: $name")}}
if($failures.Count){$failures|ForEach-Object{Write-Error $_};exit 1}
Write-Host 'EFFECTIVE_ACCESS_STATIC_PASS'
Write-Host 'Static ACL/group analysis passed. For hostile production hosts, add token-level execution tests for installed tools.'
