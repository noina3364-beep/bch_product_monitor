param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectRoot
)

$ErrorActionPreference = 'Stop'
Set-Location $ProjectRoot

$dbFile = Join-Path $ProjectRoot 'prisma\dev.db'
$needsSeed = -not (Test-Path $dbFile)
$runDir = Join-Path $ProjectRoot '.run'

if (-not (Test-Path $runDir)) {
  New-Item -Path $runDir -ItemType Directory | Out-Null
}

function Get-ListenerPids {
  param([int]$Port)

  @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique)
}

function Assert-PortFree {
  param(
    [int]$Port,
    [string]$Name
  )

  $pids = Get-ListenerPids -Port $Port
  if ($pids.Count -gt 0) {
    Write-Host "Port $Port is already in use by PID $($pids -join ', ')."
    Write-Host "Stop the existing $Name process first, or run stop.bat if it was started from this project."
    throw "Port $Port is already in use."
  }
}

function Invoke-CheckedCommand {
  param([string]$Command)

  & cmd /c $Command
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed: $Command"
  }
}

function Start-BackgroundCommand {
  param(
    [string]$Name,
    [string]$Command,
    [int]$Port,
    [string]$PidFile
  )

  $wrapper = Start-Process cmd.exe -ArgumentList '/c', $Command -WorkingDirectory $ProjectRoot -PassThru
  Write-Host "Started $Name wrapper with PID $($wrapper.Id)."

  $listenerPid = $null
  for ($attempt = 0; $attempt -lt 40; $attempt++) {
    $listenerPid = Get-ListenerPids -Port $Port | Select-Object -First 1
    if ($listenerPid) {
      break
    }

    Start-Sleep -Milliseconds 500
  }

  if (-not $listenerPid) {
    throw "$Name did not start listening on port $Port."
  }

  Set-Content -Path $PidFile -Value $listenerPid
  Write-Host "$Name is listening on port $Port with PID $listenerPid."
}

Assert-PortFree -Port 3000 -Name 'frontend'
Assert-PortFree -Port 3001 -Name 'backend'

Write-Host 'Generating Prisma client...'
Invoke-CheckedCommand 'npm run prisma:generate'

Write-Host 'Applying database schema...'
Invoke-CheckedCommand 'npm run prisma:push'

Write-Host 'Ensuring default Editor user exists...'
Invoke-CheckedCommand 'npm run auth:ensure-default-editor'

if ($needsSeed) {
  Write-Host ''
  Write-Host 'Seeding first-time database...'
  Invoke-CheckedCommand 'npm run prisma:seed'
}

Write-Host ''
Start-BackgroundCommand -Name 'frontend' -Command 'npm run dev' -Port 3000 -PidFile (Join-Path $runDir 'frontend.pid')
Start-BackgroundCommand -Name 'backend' -Command 'npm run dev:server' -Port 3001 -PidFile (Join-Path $runDir 'backend.pid')

Write-Host ''
Write-Host 'Frontend: http://127.0.0.1:3000'
Write-Host 'Backend:  http://127.0.0.1:3001'
Write-Host 'Login:'
Write-Host '  Editor  - username: editor   password: ChangeMe123!'
Write-Host '  Viewer  - use the "View as Viewer" button on the login page'
Write-Host 'App model:'
Write-Host '  - separate New and Existing category graphs'
Write-Host '  - weekly input with derived MTD and YTD views'
Write-Host 'Use stop.bat to stop both processes.'
