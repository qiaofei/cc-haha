#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${DESKTOP_DIR}/.." && pwd)"

TARGET_TRIPLE="aarch64-apple-darwin"
OUTPUT_DIR="${DESKTOP_DIR}/src-tauri/target/release/bundle/dmg"

usage() {
  cat <<'EOF'
Build Claude Code Haha desktop for macOS Apple Silicon and output a DMG.

Usage:
  ./desktop/scripts/build-macos-arm64.sh [extra tauri build args...]

Environment:
  SKIP_INSTALL=1   Skip `bun install` in the repo root and desktop app.
  SIGN_BUILD=1     Remove the default `--no-sign` flag and allow signed builds.
  OPEN_OUTPUT=1    Open the DMG output directory in Finder after a successful build.

Examples:
  ./desktop/scripts/build-macos-arm64.sh
  SKIP_INSTALL=1 ./desktop/scripts/build-macos-arm64.sh
  SIGN_BUILD=1 ./desktop/scripts/build-macos-arm64.sh --skip-stapling
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "[build-macos-arm64] This script must run on macOS." >&2
  exit 1
fi

if [[ "$(uname -m)" != "arm64" ]]; then
  echo "[build-macos-arm64] This script is intended for Apple Silicon hosts (arm64)." >&2
  exit 1
fi

for command in bun cargo rustc; do
  if ! command -v "${command}" >/dev/null 2>&1; then
    echo "[build-macos-arm64] Missing required command: ${command}" >&2
    exit 1
  fi
done

if [[ "${SKIP_INSTALL:-0}" != "1" ]]; then
  echo "[build-macos-arm64] Installing root dependencies..."
  (cd "${REPO_ROOT}" && bun install)

  echo "[build-macos-arm64] Installing desktop dependencies..."
  (cd "${DESKTOP_DIR}" && bun install)
fi

TAURI_ARGS=(
  bunx
  tauri
  build
  --target
  "${TARGET_TRIPLE}"
  --bundles
  dmg
  --ci
)

if [[ "${SIGN_BUILD:-0}" != "1" ]]; then
  TAURI_ARGS+=(--no-sign)
fi

if [[ "$#" -gt 0 ]]; then
  TAURI_ARGS+=("$@")
fi

echo "[build-macos-arm64] Building DMG for ${TARGET_TRIPLE}..."
(
  cd "${DESKTOP_DIR}"
  export TAURI_ENV_TARGET_TRIPLE="${TARGET_TRIPLE}"
  "${TAURI_ARGS[@]}"
)

LATEST_DMG="$(find "${OUTPUT_DIR}" -maxdepth 1 -type f -name '*.dmg' | sort | tail -n 1 || true)"

echo
echo "[build-macos-arm64] Build finished."
if [[ -n "${LATEST_DMG}" ]]; then
  echo "[build-macos-arm64] DMG: ${LATEST_DMG}"
else
  echo "[build-macos-arm64] No DMG found in ${OUTPUT_DIR}" >&2
fi

if [[ "${OPEN_OUTPUT:-0}" == "1" ]]; then
  open "${OUTPUT_DIR}"
fi
