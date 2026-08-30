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
if ($fullRoot -ne 'C:\BoundedAgentRuntime' -and -not $fullRoot.StartsWith('C:\BoundedAgentRuntime\')) { throw 'Safety guard: Root must stay under C:\BoundedAgentRuntime.' }
$zones = 'runtime-core','runtime-state','secrets','evidence','builder-work','reviewer-work','journal'
foreach ($zone in $zones) { New-Item -ItemType Directory -Force -Path (Join-Path $fullRoot $zone) | Out-Null }
function Local-Sid([string]$Name) { return (Get-LocalUser -Name $Name -ErrorAction Stop).SID.Value }
$controllerSid = Local-Sid $ControllerName
$builderSid = Local-Sid $BuilderName
$reviewerSid = Local-Sid $ReviewerName
$systemSid = 'S-1-5-18'
$adminsSid = 'S-1-5-32-544'
function Invoke-IcaclsChecked {
    param([Parameter(ValueFromRemainingArguments=$true)][string[]]$Arguments)
    & icacls @Arguments | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "icacls failed ($LASTEXITCODE): $($Arguments -join ' ')" }
}
function Grant([string]$Sid,[string]$Rights) { return "*$Sid`:$Rights" }
function Set-ZoneAcl {
    param([string]$Path,[string[]]$Grants)
    Invoke-IcaclsChecked $Path '/inheritance:r'
    Invoke-IcaclsChecked $Path '/grant:r' (Grant $systemSid '(OI)(CI)F') (Grant $adminsSid '(OI)(CI)F')
    foreach ($grant in $Grants) { Invoke-IcaclsChecked $Path '/grant' $grant }
}
Set-ZoneAcl (Join-Path $fullRoot 'runtime-core') @((Grant $controllerSid '(OI)(CI)F'))
Set-ZoneAcl (Join-Path $fullRoot 'runtime-state') @((Grant $controllerSid '(OI)(CI)F'))
Set-ZoneAcl (Join-Path $fullRoot 'secrets') @((Grant $controllerSid '(OI)(CI)F'))
Set-ZoneAcl (Join-Path $fullRoot 'journal') @((Grant $controllerSid '(OI)(CI)F'))
Set-ZoneAcl (Join-Path $fullRoot 'evidence') @((Grant $controllerSid '(OI)(CI)F'),(Grant $reviewerSid '(OI)(CI)R'))
Set-ZoneAcl (Join-Path $fullRoot 'builder-work') @((Grant $controllerSid '(OI)(CI)F'),(Grant $builderSid '(OI)(CI)M'),(Grant $reviewerSid '(OI)(CI)RX'))
Set-ZoneAcl (Join-Path $fullRoot 'reviewer-work') @((Grant $controllerSid '(OI)(CI)F'),(Grant $reviewerSid '(OI)(CI)M'))
[Environment]::SetEnvironmentVariable('BOUNDED_AGENT_RUNTIME_ROOT',$fullRoot,'Machine')
[Environment]::SetEnvironmentVariable('BOUNDED_AGENT_PROTECTED_MODE','1','Machine')
Write-Host "RUNTIME_LAYOUT_PASS $fullRoot"
Write-Host 'ACLs use SIDs so the setup is independent of Windows display language.'
