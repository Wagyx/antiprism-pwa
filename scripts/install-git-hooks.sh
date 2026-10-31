#!/usr/bin/env bash
# Install repo hooks into .git/hooks (no git config changes).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOOK_SRC="$ROOT/.githooks/pre-commit"
HOOK_DST="$ROOT/.git/hooks/pre-commit"

if [[ ! -d "$ROOT/.git" ]]; then
  echo "Not a git repository: $ROOT" >&2
  exit 1
fi

mkdir -p "$ROOT/.git/hooks"
cp -f "$HOOK_SRC" "$HOOK_DST"
chmod +x "$HOOK_DST" "$HOOK_SRC" "$ROOT/scripts/bump-version.sh"
echo "Installed pre-commit hook → .git/hooks/pre-commit"
echo "Patch version will bump on each commit (SKIP_VERSION_BUMP=1 to skip)."
