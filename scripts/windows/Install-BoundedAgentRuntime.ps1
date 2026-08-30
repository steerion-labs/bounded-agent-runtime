[CmdletBinding(SupportsShouldProcess)]
param(
    [string]$Root = 'C:\BoundedAgentRuntime',
    [switch]$SkipAccounts
)
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Run this installer from elevated Windows PowerShell.' }

if (-not $SkipAccounts -and $PSCmdlet.ShouldProcess('local role accounts','create/verify')) {
    & (Join-Path $here 'New-AgentRoleAccounts.ps1')
}
if ($PSCmdlet.ShouldProcess($Root,'create protected runtime layout')) {
    & (Join-Path $here 'New-RuntimeLayout.ps1') -Root $Root
    $env:BOUNDED_AGENT_RUNTIME_ROOT = [IO.Path]::GetFullPath($Root)
    $env:BOUNDED_AGENT_PROTECTED_MODE = '1'
}
Write-Host 'INSTALL_STAGE_PASS'
Write-Host 'Run Test-HostBaseline.ps1 and Test-StaticAcl.ps1 next.'
Write-Host 'Then run Test-WorkerAccess.ps1 with real Builder and Reviewer credentials.'
Write-Host 'Do not add source-control or deployment credentials to worker identities.'
