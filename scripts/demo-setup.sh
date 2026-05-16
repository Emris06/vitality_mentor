#!/usr/bin/env bash
# scripts/demo-setup.sh
#
# One-shot Ideathon demo bootstrap for macOS / Linux. POSIX bash.
#
# Mirrors scripts/demo-setup.ps1 step-for-step. Re-runnable.
#
# Steps:
#   1. pnpm stack:up
#   2. Wait up to 60s for postgres / redis / ispring healthchecks
#   3. Run db migrations exactly once
#   4. pnpm demo:seed
#   5. Activate services/ai/.venv, then run both Python doc seeders
#   6. Print summary table + the 4 URLs to open

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

cyan() { printf '\033[36m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
red() { printf '\033[31m%s\033[0m\n' "$*"; }

section() {
  echo ""
  cyan "== $1 ==============================================="
}

fail() {
  echo ""
  red "FAIL: $1"
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "required command '$1' not found on PATH"
}

# ---------------------------------------------------------------------------
# 0. pre-flight
# ---------------------------------------------------------------------------
section "0. pre-flight"
need_cmd pnpm
need_cmd docker
echo "  repo root  : ${REPO_ROOT}"
echo "  pnpm       : $(pnpm --version)"
echo "  docker     : $(docker --version | sed 's/Docker version //')"

# ---------------------------------------------------------------------------
# 1. stack up
# ---------------------------------------------------------------------------
section "1. pnpm stack:up"
pnpm stack:up

# ---------------------------------------------------------------------------
# 2. healthchecks
# ---------------------------------------------------------------------------
section "2. wait for healthchecks"

wait_healthy() {
  local container="$1"
  local timeout="${2:-60}"
  local elapsed=0
  while [[ "${elapsed}" -lt "${timeout}" ]]; do
    local status
    status="$(docker inspect --format '{{.State.Health.Status}}' "${container}" 2>/dev/null || echo '')"
    if [[ "${status}" == "healthy" ]]; then
      printf '  [ok ] %-26s healthy\n' "${container}"
      return 0
    fi
    printf '  [..] %-26s status=%s\n' "${container}" "${status:-unknown}"
    sleep 3
    elapsed=$((elapsed + 3))
  done
  return 1
}

wait_healthy vitality-postgres     60 || fail "postgres did not become healthy"
wait_healthy vitality-redis        60 || fail "redis did not become healthy"
wait_healthy vitality-ispring-mock 60 || fail "ispring-mock did not become healthy"

if curl -fsS --max-time 5 http://localhost:4010/api/v1/_health >/dev/null 2>&1; then
  green "  [ok ] ispring HTTP probe: 200"
else
  yellow "  [warn] ispring HTTP probe failed (continuing anyway)"
fi

# ---------------------------------------------------------------------------
# 3. db migrations
# ---------------------------------------------------------------------------
section "3. db migrations"
pnpm --filter '@vitality/api' exec tsx src/db/migrate-cli.ts

# ---------------------------------------------------------------------------
# 4. demo seed
# ---------------------------------------------------------------------------
section "4. demo seed (skills + hr + personas + aziz state)"
pnpm demo:seed

# ---------------------------------------------------------------------------
# 5. python doc ingestion
# ---------------------------------------------------------------------------
section "5. AI doc ingestion"
VENV_ACTIVATE_NIX="${REPO_ROOT}/services/ai/.venv/bin/activate"
if [[ ! -f "${VENV_ACTIVATE_NIX}" ]]; then
  fail "missing venv at services/ai/.venv. Create it with:
    cd services/ai
    python -m venv .venv
    source .venv/bin/activate
    pip install -e '.[dev]'"
fi
# shellcheck disable=SC1090
source "${VENV_ACTIVATE_NIX}"
(
  cd "${REPO_ROOT}/services/ai"
  python -m scripts.seed_demo_docs
  python -m scripts.seed_demo_docs_extended
)

# ---------------------------------------------------------------------------
# 6. summary + URLs
# ---------------------------------------------------------------------------
section "6. ready"
echo ""
green "  seeded:"
echo "    skills.skill_nodes        = 10"
echo "    skills.role_requirements  = 8"
echo "    skills.training_modules   = 13"
echo "    hr.employees              = 38 + 3 demo personas"
echo "    hr.newcomers              = 8 + 1 (Aziz)"
echo "    gamification.badges       = 5"
echo "    gamification.quests       = 3"
echo "    rag.documents (base)      = 6"
echo "    rag.documents (extended)  = 14"
echo ""
green "  open these tabs:"
echo "    http://localhost:5173/                 (Landing)"
echo "    http://localhost:5173/chat             (Chat - switch to uz/ru)"
echo "    http://localhost:5173/simulator/kyc    (KYC Simulator)"
echo "    http://localhost:5173/hr               (HR Dashboard)"
echo "    http://localhost:5173/me               (Aziz's profile)"
echo "    http://localhost:5173/skills           (Skills overview)"
echo ""
yellow "  next: run 'pnpm demo:bench' to verify chat P95 <= 2000 ms"
echo ""
exit 0
