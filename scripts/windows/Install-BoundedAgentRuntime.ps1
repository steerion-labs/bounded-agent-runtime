[CmdletBinding(SupportsShouldProcess)]
param(
    [string]$Root = 'C:\BoundedAgentRuntime',
    [switch]$SkipAccounts
)
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = Split-Path -Parent (Split-Path -Parent $here)

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Run this installer from elevated Windows PowerShell.'
}

if (-not $SkipAccounts -and $PSCmdlet.ShouldProcess('local role accounts','create/verify')) {
    & (Join-Path $here 'New-AgentRoleAccounts.ps1')
}
if ($PSCmdlet.ShouldProcess($Root,'create protected runtime layout')) {
    & (Join-Path $here 'New-RuntimeLayout.ps1') -Root $Root
}

Write-Host 'INSTALL_STAGE_PASS'
Write-Host 'Run scripts\verify\Test-HostBaseline.ps1 next.'
Write-Host 'Do not add worker credentials or enable remote mutations yet.'
