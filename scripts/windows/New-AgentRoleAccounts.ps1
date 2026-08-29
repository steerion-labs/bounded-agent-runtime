[CmdletBinding()]
param(
    [string]$ControllerName = 'AgentController',
    [string]$BuilderName = 'AgentBuilder',
    [string]$ReviewerName = 'AgentReviewer'
)

$ErrorActionPreference = 'Stop'
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Run this script from an elevated PowerShell.'
}

function New-RandomSecurePassword {
    $bytes = New-Object byte[] 36
    [Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
    try {
        $plain = 'Aa1!' + [Convert]::ToBase64String($bytes)
        return ConvertTo-SecureString $plain -AsPlainText -Force
    }
    finally { [Array]::Clear($bytes, 0, $bytes.Length) }
}

foreach ($name in @($ControllerName, $BuilderName, $ReviewerName)) {
    if (-not (Get-LocalUser -Name $name -ErrorAction SilentlyContinue)) {
        New-LocalUser -Name $name -Password (New-RandomSecurePassword) -PasswordNeverExpires:$false -UserMayNotChangePassword:$true | Out-Null
    }
    Enable-LocalUser -Name $name
}

foreach ($name in @($ControllerName, $BuilderName, $ReviewerName)) {
    $adminMember = Get-LocalGroupMember -Group 'Administrators' -ErrorAction Stop |
        Where-Object { $_.Name -match "\\$([regex]::Escape($name))$" }
    if ($adminMember) { throw "$name must not be an Administrator during runtime." }
}

Write-Host 'Role accounts ready.'
Write-Host "Controller: $env:COMPUTERNAME\$ControllerName"
Write-Host "Builder:    $env:COMPUTERNAME\$BuilderName"
Write-Host "Reviewer:   $env:COMPUTERNAME\$ReviewerName"
Write-Host 'Passwords were generated in memory and were not written to disk.'
