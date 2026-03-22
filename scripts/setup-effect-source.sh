#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/Effect-TS/effect-smol.git"

default_dir="${XDG_DATA_HOME:-${HOME:-}/.local/share}/effect-solutions/effect"
target_dir="${EFFECT_SOURCE_DIR:-$default_dir}"

# Some VM/cloud runners may not have a writable HOME/XDG location.
if ! mkdir -p "$(dirname "$target_dir")" 2>/dev/null; then
  target_dir="${PWD}/.cache/effect-source/effect"
  mkdir -p "$(dirname "$target_dir")"
fi

if [ -d "$target_dir/.git" ]; then
  git -C "$target_dir" pull --depth 1
else
  git clone --depth 1 "$REPO_URL" "$target_dir"
fi

printf 'Effect source ready at: %s\n' "$target_dir"
