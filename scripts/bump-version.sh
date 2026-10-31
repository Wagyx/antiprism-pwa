#!/usr/bin/env bash
# Bump the patch segment of VERSION (MAJOR.MINOR.PATCH) and sync package.json / version.ts.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION_FILE="$ROOT/VERSION"
PKG_JSON="$ROOT/web/package.json"
VERSION_TS="$ROOT/web/src/version.ts"

if [[ "${SKIP_VERSION_BUMP:-}" == "1" ]]; then
  echo "SKIP_VERSION_BUMP=1 — leaving version unchanged"
  exit 0
fi

if [[ ! -f "$VERSION_FILE" ]]; then
  echo "0.1.0" > "$VERSION_FILE"
fi

current="$(tr -d '[:space:]' < "$VERSION_FILE")"
if [[ ! "$current" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
  echo "Invalid VERSION '$current' (expected MAJOR.MINOR.PATCH)" >&2
  exit 1
fi

major="${BASH_REMATCH[1]}"
minor="${BASH_REMATCH[2]}"
patch="${BASH_REMATCH[3]}"
new="${major}.${minor}.$((patch + 1))"

echo "$new" > "$VERSION_FILE"

if [[ -f "$PKG_JSON" ]]; then
  # Portable replace of "version": "…"
  tmp="$(mktemp)"
  sed -E "s/\"version\":[[:space:]]*\"[^\"]+\"/\"version\": \"$new\"/" "$PKG_JSON" > "$tmp"
  mv "$tmp" "$PKG_JSON"
fi

if [[ -f "$VERSION_TS" ]]; then
  tmp="$(mktemp)"
  sed -E "s/export const APP_VERSION = \"[^\"]+\";/export const APP_VERSION = \"$new\";/" "$VERSION_TS" > "$tmp"
  mv "$tmp" "$VERSION_TS"
fi

echo "Version bumped: $current → $new"
