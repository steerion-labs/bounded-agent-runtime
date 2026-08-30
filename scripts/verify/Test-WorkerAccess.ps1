[CmdletBinding()]
param(
    [string]$Root = 'C:\BoundedAgentRuntime',
    [Parameter(Mandatory)][PSCredential]$BuilderCredential,
    [Parameter(Mandatory)][PSCredential]$ReviewerCredential
)
$ErrorActionPreference = 'Stop'
function Invoke-Probe {
    param([PSCredential]$Credential,[string]$Command,[int]$ExpectedExit,[string]$Label)
    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($Command))
    $p = Start-Process powershell.exe -Credential $Credential -ArgumentList '-NoProfile','-NonInteractive','-EncodedCommand',$encoded -Wait -PassThru -WindowStyle Hidden
    if ($p.ExitCode -ne $ExpectedExit) { throw "$Label failed: expected $ExpectedExit, got $($p.ExitCode)" }
}
$protectedProbe = Join-Path $Root 'secrets\worker-access-probe.txt'
Set-Content -Path $protectedProbe -Value 'controller-only' -Encoding ASCII
$builderFile = Join-Path $Root 'builder-work\builder-probe.txt'
$reviewerFile = Join-Path $Root 'reviewer-work\reviewer-probe.txt'
$verificationProbe = Join-Path $Root 'verification-work\controller-test-probe.txt'
Set-Content -Path $verificationProbe -Value 'controller-test-only' -Encoding ASCII
$protectedLiteral = $protectedProbe.Replace("'", "''")
$builderLiteral = $builderFile.Replace("'", "''")
$reviewerLiteral = $reviewerFile.Replace("'", "''")
$verificationLiteral = $verificationProbe.Replace("'", "''")
try {
    Invoke-Probe $BuilderCredential "try { Get-Content -LiteralPath '$protectedLiteral' -ErrorAction Stop | Out-Null; exit 41 } catch { exit 0 }" 0 'Builder protected read denial'
    Invoke-Probe $ReviewerCredential "try { Get-Content -LiteralPath '$protectedLiteral' -ErrorAction Stop | Out-Null; exit 42 } catch { exit 0 }" 0 'Reviewer protected read denial'
    Invoke-Probe $BuilderCredential "try { Set-Content -LiteralPath '$builderLiteral' -Value ok -ErrorAction Stop; exit 0 } catch { exit 43 }" 0 'Builder own workspace write'
    Invoke-Probe $ReviewerCredential "try { Set-Content -LiteralPath '$reviewerLiteral' -Value ok -ErrorAction Stop; exit 0 } catch { exit 44 }" 0 'Reviewer own workspace write'
    Invoke-Probe $ReviewerCredential "try { Set-Content -LiteralPath '$builderLiteral' -Value bad -ErrorAction Stop; exit 45 } catch { exit 0 }" 0 'Reviewer builder-work write denial'
    Invoke-Probe $BuilderCredential "try { Get-Content -LiteralPath '$verificationLiteral' -ErrorAction Stop | Out-Null; exit 46 } catch { exit 0 }" 0 'Builder verification-work read denial'
    Invoke-Probe $ReviewerCredential "try { Set-Content -LiteralPath '$verificationLiteral' -Value verified -ErrorAction Stop; exit 0 } catch { exit 47 }" 0 'Reviewer verification-work write'
    Write-Host 'WORKER_ACCESS_PASS'
} finally {
    Remove-Item $protectedProbe,$builderFile,$reviewerFile,$verificationProbe -Force -ErrorAction SilentlyContinue
}
