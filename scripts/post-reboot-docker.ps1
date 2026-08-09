# Post-reboot helper: bring up AKS Docker stack after Docker Desktop is available.
# One-shot when registered as schtask AKS-PostReboot-Docker (deletes itself at end).
#
# Port map (avoids native Postgres :5432, MinIO :9000/:9001, Next :3000):
#   compose Postgres  5434 -> 5432
#   compose MinIO     9010 -> 9000, 9011 -> 9001
#   compose app       3001 -> 3000
# Native Postgres on 5432 is left running.

$ErrorActionPreference = "Continue"
$RepoRoot = "C:\Personal\AgenticAI\AKSv2"
$LogFile = Join-Path $RepoRoot "tmp-docker-post-reboot.txt"
$TaskName = "AKS-PostReboot-Docker"
$DockerDesktop = Join-Path $env:LOCALAPPDATA "Programs\DockerDesktop\Docker Desktop.exe"

function Write-Log {
  param([string]$Message)
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
  Add-Content -Path $LogFile -Value $line -Encoding UTF8
  Write-Host $line
}

try {
  Set-Location $RepoRoot
  "=== AKS post-reboot Docker bring-up ===" | Set-Content -Path $LogFile -Encoding UTF8
  Write-Log "Repo: $RepoRoot"
  Write-Log "User: $env:USERNAME"

  $EnvFile = Join-Path $RepoRoot ".env.docker"
  if (-not (Test-Path $EnvFile)) {
    Write-Log "ERROR: .env.docker not found at $EnvFile"
    throw ".env.docker missing"
  }

  # Start Docker Desktop if engine is not up yet
  $engineUp = $false
  try {
    docker info 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { $engineUp = $true }
  } catch {}

  if (-not $engineUp) {
    if (Test-Path $DockerDesktop) {
      Write-Log "Starting Docker Desktop: $DockerDesktop"
      Start-Process -FilePath $DockerDesktop
    } else {
      Write-Log "WARN: Docker Desktop.exe not found at $DockerDesktop — will still poll docker info"
    }
  } else {
    Write-Log "Docker engine already responding"
  }

  Write-Log "Polling docker info every 5s (up to 10 minutes)..."
  $deadline = (Get-Date).AddMinutes(10)
  $ready = $false
  $wslInstallAttempted = $false

  while ((Get-Date) -lt $deadline) {
    try {
      $infoOut = docker info 2>&1 | Out-String
      if ($LASTEXITCODE -eq 0) {
        $ready = $true
        Write-Log "Docker engine ready"
        break
      }
      Write-Log "docker info not ready (exit=$LASTEXITCODE)"
      if ($infoOut) {
        $snippet = ($infoOut -replace "`r?`n", " ").Substring(0, [Math]::Min(200, $infoOut.Length))
        Write-Log "  $snippet"
      }
    } catch {
      Write-Log "docker info exception: $($_.Exception.Message)"
    }

    # If WSL has no distro, install Ubuntu-24.04 once and keep waiting
    if (-not $wslInstallAttempted) {
      try {
        $distros = wsl -l -q 2>&1 | Out-String
        $hasDistro = $false
        if ($LASTEXITCODE -eq 0 -and $distros) {
          foreach ($line in ($distros -split "`r?`n")) {
            if ($line.Trim().Length -gt 0) { $hasDistro = $true; break }
          }
        }
        if (-not $hasDistro) {
          Write-Log "WSL has no distro — running: wsl --install -d Ubuntu-24.04 --no-launch"
          $wslInstallAttempted = $true
          wsl --install -d Ubuntu-24.04 --no-launch 2>&1 | ForEach-Object { Write-Log "  wsl: $_" }
        }
      } catch {
        Write-Log "WSL check/install note: $($_.Exception.Message)"
        $wslInstallAttempted = $true
      }
    }

    Start-Sleep -Seconds 5
  }

  if (-not $ready) {
    Write-Log "ERROR: Docker engine not ready after 10 minutes"
    throw "Docker not ready"
  }

  Write-Log "Running: docker compose --env-file .env.docker up --build -d"
  Write-Log "Host ports: app :3001, MinIO :9010/:9011, Postgres :5434 (native Postgres :5432 untouched)"
  $composeOut = docker compose --env-file .env.docker up --build -d 2>&1 | Out-String
  $composeOut -split "`r?`n" | ForEach-Object { if ($_.Length -gt 0) { Write-Log $_ } }

  if ($LASTEXITCODE -ne 0) {
    Write-Log "ERROR: docker compose failed with exit code $LASTEXITCODE"
    throw "docker compose failed"
  }

  Write-Log "Stack started."
  Write-Log "  Storefront: http://localhost:3001/en"
  Write-Log "  Admin:      http://localhost:3001/admin/login"
  Write-Log "  MinIO API:  http://localhost:9010"
  Write-Log "  MinIO UI:   http://localhost:9011"
  Write-Log "  Postgres (compose host): localhost:5434"
} catch {
  Write-Log "FATAL: $($_.Exception.Message)"
} finally {
  # One-shot: remove startup task if present
  Write-Log "Deleting scheduled task $TaskName (if present)..."
  schtasks /Delete /TN $TaskName /F 2>&1 | ForEach-Object { Write-Log "  $_" }
  Write-Log "Done."
}
