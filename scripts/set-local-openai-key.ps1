$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env"

if (-not (Test-Path -LiteralPath $envFile)) {
  throw "Missing local environment file: $envFile"
}

do {
  Write-Host "Copy the full OpenAI API key, then RIGHT-CLICK here to paste it." -ForegroundColor Cyan
  $secureKey = Read-Host "OpenAI API key (hidden)" -AsSecureString
  $key = [System.Net.NetworkCredential]::new("", $secureKey).Password.Trim()
  if ($key.Length -lt 20) {
    Write-Host "The key was too short. Please paste the full key and try again." -ForegroundColor Yellow
  }
} while ($key.Length -lt 20)

$lines = @(Get-Content -LiteralPath $envFile -Encoding UTF8)
$baseUrlFound = $false
$keyFound = $false

$updated = foreach ($line in $lines) {
  if ($line -match '^AI_INTEGRATIONS_OPENAI_BASE_URL=') {
    $baseUrlFound = $true
    'AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1'
  } elseif ($line -match '^AI_INTEGRATIONS_OPENAI_API_KEY=') {
    $keyFound = $true
    "AI_INTEGRATIONS_OPENAI_API_KEY=$key"
  } else {
    $line
  }
}

if (-not $baseUrlFound) { $updated += 'AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1' }
if (-not $keyFound) { $updated += "AI_INTEGRATIONS_OPENAI_API_KEY=$key" }

Set-Content -LiteralPath $envFile -Value $updated -Encoding UTF8
Write-Host "Local OpenAI key saved successfully." -ForegroundColor Green
Read-Host "Press Enter to close"
