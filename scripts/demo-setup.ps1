# scripts/demo-setup.ps1
#
# One-shot Ideathon demo bootstrap for Windows. Sequence:
#   1. pnpm stack:up
#   2. Wait up to 60s for postgres / redis / ispring healthchecks
#   3. Run db migrations exactly once
#   4. pnpm demo:seed
#   5. Activate services/ai/.venv, then run both Python doc seeders
#   6. Print summary table + the 4 URLs to open
#
# Strict: any step that fails aborts the script with exit 1.
# Idempotent: re-running is safe.

$ErrorActionPreference = 'Stop'
$ProgressPreference    = 'SilentlyContinue'

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

function Section($title) {
  Write-Host ""
  Write-Host ("== {0} " -f $title).PadRight(72, '=') -ForegroundColor Cyan
}

function Fail($message) {
  Write-Host ""
  Write-Host ("FAIL: {0}" -f $message) -ForegroundColor Red
  exit 1
}

function Check-Cmd($cmd) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Fail "required command '$cmd' not found on PATH"
  }
}

# ---------------------------------------------------------------------------
# 0. Pre-flight: tooling sanity
# ---------------------------------------------------------------------------
Section "0. pre-flight"
Check-Cmd 'pnpm'
Check-Cmd 'docker'
Write-Host "  repo root  : $RepoRoot"
Write-Host "  pnpm       : $((pnpm --version) -replace '\s','')"
Write-Host "  docker     : $((docker --version) -replace 'Docker version ','')"

# ---------------------------------------------------------------------------
# 1. Bring the stack up
# ---------------------------------------------------------------------------
Section "1. pnpm stack:up"
& pnpm stack:up
if ($LASTEXITCODE -ne 0) { Fail "pnpm stack:up exited $LASTEXITCODE" }

# ---------------------------------------------------------------------------
# 2. Wait for healthchecks (up to 60s total)
# ---------------------------------------------------------------------------
Section "2. wait for healthchecks"

function Wait-DockerHealthy($container, $timeoutSec = 60) {
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  while ((Get-Date) -lt $deadline) {
    $status = ''
    try {
      $status = (docker inspect --format '{{.State.Health.Status}}' $container 2>$null)
    } catch { $status = '' }
    if ($status -eq 'healthy') {
      Write-Host ("  [ok ] {0,-26} healthy" -f $container) -ForegroundColor Green
      return $true
    }
    if ($status -eq 'unhealthy') {
      Write-Host ("  [..] {0,-26} unhealthy, still waiting" -f $container)
    } else {
      Write-Host ("  [..] {0,-26} status='{1}'" -f $container, $status)
    }
    Start-Sleep -Seconds 3
  }
  return $false
}

if (-not (Wait-DockerHealthy 'vitality-postgres'    60)) { Fail "postgres did not become healthy" }
if (-not (Wait-DockerHealthy 'vitality-redis'       60)) { Fail "redis did not become healthy" }
if (-not (Wait-DockerHealthy 'vitality-ispring-mock' 60)) { Fail "ispring-mock did not become healthy" }

# Best-effort secondary probe on the iSpring HTTP endpoint — the healthcheck
# alone is occasionally lying for the first request.
try {
  $h = Invoke-RestMethod -Uri 'http://localhost:4010/api/v1/_health' -TimeoutSec 5
  Write-Host ("  [ok ] ispring HTTP probe: {0}" -f ($h | ConvertTo-Json -Compress)) -ForegroundColor Green
} catch {
  Write-Host "  [warn] ispring HTTP probe failed (continuing anyway): $($_.Exception.Message)" -ForegroundColor Yellow
}

# ---------------------------------------------------------------------------
# 3. DB migrations
# ---------------------------------------------------------------------------
Section "3. db migrations"
& pnpm --filter '@vitality/api' exec tsx src/db/migrate-cli.ts
if ($LASTEXITCODE -ne 0) { Fail "migrate-cli exited $LASTEXITCODE" }

# ---------------------------------------------------------------------------
# 4. demo seed
# ---------------------------------------------------------------------------
Section "4. demo seed (skills + hr + personas + aziz state)"
& pnpm demo:seed
if ($LASTEXITCODE -ne 0) { Fail "pnpm demo:seed exited $LASTEXITCODE" }

# ---------------------------------------------------------------------------
# 5. Python doc ingestion
# ---------------------------------------------------------------------------
Section "5. AI doc ingestion"
$VenvActivate = Join-Path $RepoRoot 'services/ai/.venv/Scripts/Activate.ps1'
if (-not (Test-Path $VenvActivate)) {
  Fail "missing venv at services/ai/.venv. Create it with:`n    cd services/ai`n    python -m venv .venv`n    .venv/Scripts/Activate.ps1`n    pip install -e .[dev]"
}
. $VenvActivate
Push-Location (Join-Path $RepoRoot 'services/ai')
try {
  & python -m scripts.seed_demo_docs
  if ($LASTEXITCODE -ne 0) { Fail "seed_demo_docs exited $LASTEXITCODE" }
  & python -m scripts.seed_demo_docs_extended
  if ($LASTEXITCODE -ne 0) { Fail "seed_demo_docs_extended exited $LASTEXITCODE" }
} finally {
  Pop-Location
}

# ---------------------------------------------------------------------------
# 6. Summary + URLs
# ---------------------------------------------------------------------------
Section "6. ready"

Write-Host ""
Write-Host "  seeded:" -ForegroundColor Green
Write-Host "    skills.skill_nodes      = 10"
Write-Host "    skills.role_requirements = 8"
Write-Host "    skills.training_modules  = 13"
Write-Host "    hr.employees             = 38 + 3 demo personas"
Write-Host "    hr.newcomers             = 8 + 1 (Aziz)"
Write-Host "    gamification.badges      = 5"
Write-Host "    gamification.quests      = 3"
Write-Host "    rag.documents (base)     = 6"
Write-Host "    rag.documents (extended) = 14"
Write-Host ""
Write-Host "  open these tabs:" -ForegroundColor Green
Write-Host "    http://localhost:5173/                 (Landing)"
Write-Host "    http://localhost:5173/chat             (Chat — switch to uz/ru)"
Write-Host "    http://localhost:5173/simulator/kyc    (KYC Simulator)"
Write-Host "    http://localhost:5173/hr               (HR Dashboard)"
Write-Host "    http://localhost:5173/me               (Aziz's profile)"
Write-Host "    http://localhost:5173/skills           (Skills overview)"
Write-Host ""
Write-Host "  next: run 'pnpm demo:bench' to verify chat P95 <= 2000 ms" -ForegroundColor Yellow
Write-Host ""
exit 0
