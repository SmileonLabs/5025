$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env"
$runtimeDir = Join-Path $root ".local\runtime"

if (-not (Test-Path -LiteralPath $envFile)) {
  throw "Missing local environment file: $envFile"
}

Get-Content -LiteralPath $envFile -Encoding UTF8 | ForEach-Object {
  if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
    [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
  }
}

New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null

function Start-LocalService {
  param(
    [string]$Name,
    [string]$Package,
    [string]$Port
  )

  $pidFile = Join-Path $runtimeDir "$Name.pid"
  if (Test-Path -LiteralPath $pidFile) {
    $existingPid = [int](Get-Content -LiteralPath $pidFile)
    if (Get-Process -Id $existingPid -ErrorAction SilentlyContinue) {
      Write-Output "$Name is already running (PID $existingPid)."
      return
    }
    Remove-Item -LiteralPath $pidFile -Force
  }

  $env:PORT = $Port
  $stdout = Join-Path $runtimeDir "$Name.out.log"
  $stderr = Join-Path $runtimeDir "$Name.err.log"
  $process = Start-Process -FilePath "pnpm.cmd" `
    -ArgumentList @("--filter", $Package, "run", "dev") `
    -WorkingDirectory $root `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdout `
    -RedirectStandardError $stderr `
    -PassThru
  Set-Content -LiteralPath $pidFile -Value $process.Id -Encoding ASCII
  Write-Output "$Name started (PID $($process.Id), port $Port)."
}

Start-LocalService -Name "api" -Package "@workspace/api-server" -Port "5000"
Start-LocalService -Name "web" -Package "@workspace/bible-pay" -Port "5173"

Write-Output "Web: http://localhost:5173"
Write-Output "API health: http://localhost:5000/api/healthz"

