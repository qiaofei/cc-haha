#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

BUN="$HOME/.bun/bin/bun"
export PATH="$HOME/.bun/bin:$HOME/.cargo/bin:$PATH"

# Isolate this project's Claude config from ~/.claude used by the official CLI.
# Every code path (CLI, server, adapters, spawned children) falls back to
# ~/.claude when this is unset, so exporting it here keeps them all aligned.
export CLAUDE_CONFIG_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude-haha}"
mkdir -p "$CLAUDE_CONFIG_DIR"

LITELLM_PORT=4000
SERVER_PORT=3456
LITELLM_PID_FILE="$ROOT_DIR/.litellm.pid"
SERVER_PID_FILE="$ROOT_DIR/.server.pid"

cleanup() {
  echo ""
  if [[ -f "$LITELLM_PID_FILE" ]]; then
    kill "$(cat "$LITELLM_PID_FILE")" 2>/dev/null || true
    rm -f "$LITELLM_PID_FILE"
  fi
  if [[ -f "$SERVER_PID_FILE" ]]; then
    kill "$(cat "$SERVER_PID_FILE")" 2>/dev/null || true
    rm -f "$SERVER_PID_FILE"
  fi
  echo "All services stopped."
}
trap cleanup EXIT INT TERM

kill_port() {
  local port=$1
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN &>/dev/null; then
    echo "Port $port already in use, killing old process..."
    lsof -nP -iTCP:"$port" -sTCP:LISTEN | awk 'NR>1 {print $2}' | xargs kill 2>/dev/null || true
    sleep 1
  fi
}

wait_for() {
  local url=$1 name=$2
  echo -n "Waiting for $name"
  for i in {1..20}; do
    if curl -sf "$url" &>/dev/null; then
      echo " ready!"
      return 0
    fi
    echo -n "."
    sleep 1
  done
  echo " timeout! Check logs"
  exit 1
}

# 0. Ensure all dependencies are installed
echo "Checking dependencies..."
"$BUN" install --cwd "$ROOT_DIR" --silent
"$BUN" install --cwd "$ROOT_DIR/adapters" --silent
"$BUN" install --cwd "$ROOT_DIR/desktop" --silent

# 1. Start LiteLLM proxy
kill_port "$LITELLM_PORT"
echo "Starting LiteLLM proxy on port $LITELLM_PORT..."
litellm --config litellm_config.yaml --port "$LITELLM_PORT" &>/tmp/litellm.log &
echo $! > "$LITELLM_PID_FILE"
wait_for "http://localhost:$LITELLM_PORT/health" "LiteLLM"

# 2. Start API server
kill_port "$SERVER_PORT"
echo "Starting API server on port $SERVER_PORT..."
SERVER_PORT=$SERVER_PORT "$BUN" --env-file=.env run src/server/index.ts &>/tmp/cc-server.log &
echo $! > "$SERVER_PID_FILE"
wait_for "http://localhost:$SERVER_PORT/health" "API server"

# 3. Start Tauri desktop app (foreground)
echo "Starting desktop app..."
cd "$ROOT_DIR/desktop"
exec "$BUN" run tauri dev
