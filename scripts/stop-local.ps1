$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $root ".local\runtime"

function Stop-ProcessTree {
  param(
    [int]$ProcessId,
    [array]$Processes
  )

  $children = $Processes | Where-Object { $_.ParentProcessId -eq $ProcessId }
  foreach ($child in $children) {
    Stop-ProcessTree -ProcessId $child.ProcessId -Processes $Processes
  }
  Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
}

$processes = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue)
foreach ($name in @("web", "api")) {
  $pidFile = Join-Path $runtimeDir "$name.pid"
  if (-not (Test-Path -LiteralPath $pidFile)) {
    Write-Output "$name is not running."
    continue
  }

  $processId = [int](Get-Content -LiteralPath $pidFile)
  Stop-ProcessTree -ProcessId $processId -Processes $processes
  Remove-Item -LiteralPath $pidFile -Force
  Write-Output "$name stopped."
}
