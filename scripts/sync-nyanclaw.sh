#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/johnjames-bit/nyanclaw.git"
CACHE_DIR="/tmp/nyanclaw-latest"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPLIT_MD="$SCRIPT_DIR/../replit.md"

purge_stale() {
  for d in /tmp/nyanclaw*/; do
    [ -d "$d" ] || continue
    [ "$(realpath "$d")" = "$(realpath "$CACHE_DIR")" ] && continue
    rm -rf "$d"
    echo "purged stale: $d"
  done
}

purge_stale

if [ -d "$CACHE_DIR/.git" ]; then
  echo "updating existing cache..."
  (cd "$CACHE_DIR" && git fetch origin main --depth 1 2>/dev/null && git reset --hard origin/main 2>/dev/null)
else
  rm -rf "$CACHE_DIR"
  echo "fresh clone..."
  git clone --depth 1 "$REPO_URL" "$CACHE_DIR" 2>/dev/null
fi

LATEST=$(cd "$CACHE_DIR" && git rev-parse --short HEAD)
echo "nyanclaw synced -> $LATEST"

if [ -f "$REPLIT_MD" ]; then
  sed -i "s/\*\*Nyanclaw anchor\*\*: \`[a-f0-9]\{7\}\`/**Nyanclaw anchor**: \`$LATEST\`/" "$REPLIT_MD"
  echo "replit.md anchor updated -> $LATEST"
fi

purge_stale
echo "done. single cache at $CACHE_DIR"
