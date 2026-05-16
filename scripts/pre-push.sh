#!/usr/bin/env bash
# pre-push hook (bash).
#
# This file is NOT auto-installed. To use it, copy/symlink into your local
# git hooks dir:
#   ln -s ../../scripts/pre-push.sh .git/hooks/pre-push && chmod +x .git/hooks/pre-push
# or wire it up with whatever hook manager you prefer (lefthook, simple-git-hooks,
# husky). We intentionally do not depend on husky here so the toolchain stays
# small for the Ideathon repo.
#
# Runs the two cheap audits that prevent the most embarrassing regressions:
# missing translations and any code path that drifts toward real bank data.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "[pre-push] i18n + security audits"
pnpm i18n:audit
pnpm security:audit
echo "[pre-push] OK"
