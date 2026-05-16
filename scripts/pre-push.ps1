# pre-push hook (PowerShell, Windows-friendly).
#
# This file is NOT auto-installed. To use it, wire it up via your hook
# manager of choice (lefthook, simple-git-hooks) or call it from
# .git/hooks/pre-push:
#
#   #!/bin/sh
#   pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/pre-push.ps1
#
# We intentionally do not depend on husky so the toolchain stays small for
# the Ideathon repo. Mirrors scripts/pre-push.sh; either is sufficient.

$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

Write-Host "[pre-push] i18n + security audits"
pnpm i18n:audit
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
pnpm security:audit
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "[pre-push] OK"
