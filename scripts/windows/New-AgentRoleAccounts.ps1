[CmdletBinding()]
param(
    [string]$ControllerName = 'AgentController',
    [string]$BuilderName = 'AgentBuilder',
    [string]$ReviewerName = 'AgentReviewer',
    [Security.SecureString]$ControllerPassword,
    [Security.SecureString]$BuilderPassword,
    [Security.SecureString]$ReviewerPassword
)
$ErrorActionPreference = 'Stop'
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Run this script from an elevated PowerShell.' }

function Ensure-RoleUser {
    param([string]$Name,[Security.SecureString]$Password)
    $existing = Get-LocalUser -Name $Name -ErrorAction SilentlyContinue
    if (-not $existing) {
        if (-not $Password) { $Password = Read-Host "Enter a strong local service-account password for $Name" -AsSecureString }
        New-LocalUser -Name $Name -Password $Password -PasswordNeverExpires:$true -UserMayNotChangePassword:$true -AccountNeverExpires | Out-Null
    }
    Enable-LocalUser -Name $Name
}
Ensure-RoleUser $ControllerName $ControllerPassword
Ensure-RoleUser $BuilderName $BuilderPassword
Ensure-RoleUser $ReviewerName $ReviewerPassword
foreach ($name in @($ControllerName,$BuilderName,$ReviewerName)) {
    $adminMember = Get-LocalGroupMember -Group 'Administrators' -ErrorAction Stop |
        Where-Object { $_.Name -match "\\$([regex]::Escape($name))$" }
    if ($adminMember) { throw "$name must not be an Administrator during runtime." }
}
Write-Host 'ROLE_ACCOUNTS_PASS'
Write-Host 'Passwords are operator-supplied, never printed, and never written by this script.'
Write-Host 'For production, prefer managed service identities and an explicit credential-rotation policy where available.'
