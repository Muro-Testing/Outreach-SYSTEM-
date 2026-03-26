param(
  [string]$RepoRoot = "",
  [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"

if (-not $RepoRoot) {
  $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

Set-Location $RepoRoot

$realEnv = Join-Path $RepoRoot ".env"
$backupEnv = Join-Path $RepoRoot ".env.codex-backup"
$hadRealEnv = Test-Path $realEnv
$testEnv = @"
SUPABASE_URL=https://example.supabase.co
SUPABASE_SERVICE_ROLE_KEY=test-service-role-key
GOOGLE_MAPS_API_KEY=test-google-key
MISTRAL_API_KEY=test-mistral-key
PORT=8787
CORS_ORIGIN=http://localhost:5173
"@

$result = [ordered]@{
  task = "docker-install"
  timestamp = (Get-Date).ToString("o")
  inputs = @{
    composeFile = "docker-compose.yml"
    envMode = "temporary-sanitized"
    ports = @{
      api = 8787
      web = 5173
    }
  }
  processed = @{
    apiHealth = $null
    webStatus = $null
    composeServices = @()
  }
  success = $false
  errors = @()
}

try {
  if ($hadRealEnv) {
    Move-Item -LiteralPath $realEnv -Destination $backupEnv -Force
  }

  Set-Content -LiteralPath $realEnv -Value $testEnv -NoNewline

  docker compose down --remove-orphans | Out-Null
  docker compose up --build -d | Out-Null

  Start-Sleep -Seconds 12

  $composePsJson = docker compose ps --format json | ConvertFrom-Json
  if ($composePsJson -isnot [System.Array]) {
    $composePsJson = @($composePsJson)
  }

  $apiHealth = Invoke-RestMethod -Uri "http://localhost:8787/health" -TimeoutSec 20
  $webResponse = Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:5173" -TimeoutSec 20

  $result.processed.apiHealth = $apiHealth
  $result.processed.webStatus = $webResponse.StatusCode
  $result.processed.composeServices = @(
    $composePsJson | ForEach-Object {
      @{
        service = $_.Service
        state = $_.State
        publishers = $_.Publishers
      }
    }
  )
  $result.success = $true
}
catch {
  $result.errors = @($_.Exception.Message)
}
finally {
  docker compose down --remove-orphans | Out-Null
  Remove-Item -LiteralPath $realEnv -Force -ErrorAction SilentlyContinue
  if ($hadRealEnv -and (Test-Path $backupEnv)) {
    Move-Item -LiteralPath $backupEnv -Destination $realEnv -Force
  }
}

$json = $result | ConvertTo-Json -Depth 8

if ($OutputPath) {
  $outputDirectory = Split-Path -Parent $OutputPath
  if ($outputDirectory) {
    New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
  }
  Set-Content -LiteralPath $OutputPath -Value $json
}

Write-Output $json
