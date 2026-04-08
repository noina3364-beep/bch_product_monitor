param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectRoot
)

$ErrorActionPreference = 'Stop'
$runDir = Join-Path $ProjectRoot '.run'

function Stop-PidFile {
  param(
    [string]$Name,
    [string]$PidFile
  )

  if (-not (Test-Path $PidFile)) {
    Write-Host "No $Name PID file found."
    return
  }

  $pidText = (Get-Content -Path $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1).Trim()
  if (-not $pidText) {
    Remove-Item -Path $PidFile -Force -ErrorAction SilentlyContinue
    Write-Host "No PID recorded for $Name."
    return
  }

  $existing = Get-Process -Id ([int]$pidText) -ErrorAction SilentlyContinue
  if ($existing) {
    try {
      Stop-Process -Id ([int]$pidText) -Force -ErrorAction Stop
      Write-Host "Stopped $Name (PID $pidText)."
    } catch {
      Write-Host "$Name PID $pidText was not running or could not be stopped directly."
    }
  } else {
    Write-Host "$Name is not running."
  }

  Remove-Item -Path $PidFile -Force -ErrorAction SilentlyContinue
}

function Stop-PortListeners {
  param(
    [int]$Port,
    [string]$Name,
    [string]$PidFile
  )

  $listenerPids = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique)

  if (-not $listenerPids.Count) {
    return
  }

  Write-Host "$Name port $Port is still in use."

  foreach ($listenerPid in $listenerPids) {
    try {
      Stop-Process -Id $listenerPid -Force -ErrorAction Stop
      Write-Host "Stopped PID $listenerPid on port $Port."
    } catch {
      Write-Host "Failed to stop PID $listenerPid on port $Port."
      throw
    }
  }

  if (Test-Path $PidFile) {
    Remove-Item -Path $PidFile -Force -ErrorAction SilentlyContinue
  }
}

$frontendPidFile = Join-Path $runDir 'frontend.pid'
$backendPidFile = Join-Path $runDir 'backend.pid'

Stop-PidFile -Name 'frontend' -PidFile $frontendPidFile
Stop-PidFile -Name 'backend' -PidFile $backendPidFile
Stop-PortListeners -Port 3000 -Name 'frontend' -PidFile $frontendPidFile
Stop-PortListeners -Port 3001 -Name 'backend' -PidFile $backendPidFile
