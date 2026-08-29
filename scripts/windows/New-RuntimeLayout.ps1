[CmdletBinding()]
param(
    [string]$Root = 'C:\BoundedAgentRuntime',
    [string]$ControllerName = 'AgentController',
    [string]$BuilderName = 'AgentBuilder',
    [string]$ReviewerName = 'AgentReviewer'
)
$ErrorActionPreference = 'Stop'
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Run from elevated PowerShell.' }

$fullRoot = [IO.Path]::GetFullPath($Root)
if ($fullRoot -ne 'C:\BoundedAgentRuntime' -and -not $fullRoot.StartsWith('C:\BoundedAgentRuntime\')) {
    throw 'Safety guard: Root must stay under C:\BoundedAgentRuntime.'
}
$zones = 'runtime-core','runtime-state','secrets','evidence','builder-work','reviewer-work','journal'
foreach ($zone in $zones) { New-Item -ItemType Directory -Force -Path (Join-Path $fullRoot $zone) | Out-Null }

$controller = "$env:COMPUTERNAME\$ControllerName"
$builder = "$env:COMPUTERNAME\$BuilderName"
$reviewer = "$env:COMPUTERNAME\$ReviewerName"
function Set-ZoneAcl {
    param([string]$Path,[string[]]$Grants)
    & icacls $Path /inheritance:r | Out-Null
    & icacls $Path /grant:r 'SYSTEM:(OI)(CI)F' 'BUILTIN\Administrators:(OI)(CI)F' | Out-Null
    foreach ($grant in $Grants) { & icacls $Path /grant $grant | Out-Null }
}
Set-ZoneAcl (Join-Path $fullRoot 'runtime-core') @("${controller}:(OI)(CI)F")
Set-ZoneAcl (Join-Path $fullRoot 'runtime-state') @("${controller}:(OI)(CI)F")
Set-ZoneAcl (Join-Path $fullRoot 'secrets') @("${controller}:(OI)(CI)F")
Set-ZoneAcl (Join-Path $fullRoot 'journal') @("${controller}:(OI)(CI)F")
Set-ZoneAcl (Join-Path $fullRoot 'evidence') @("${controller}:(OI)(CI)F","${reviewer}:(OI)(CI)R")
Set-ZoneAcl (Join-Path $fullRoot 'builder-work') @("${controller}:(OI)(CI)F","${builder}:(OI)(CI)M","${reviewer}:(OI)(CI)RX")
Set-ZoneAcl (Join-Path $fullRoot 'reviewer-work') @("${controller}:(OI)(CI)F","${reviewer}:(OI)(CI)M")

Write-Host "Runtime layout created at $fullRoot"
Write-Host 'Workers have no ACL grant to runtime-core, runtime-state, secrets or journal.'
Write-Host 'Run verification scripts before using real repositories or credentials.'
