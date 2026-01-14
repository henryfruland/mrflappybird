#!/usr/bin/env bash
set -euo pipefail
# Lightweight helper to create a venv, install livereload and run the dev server.
ROOT="$(cd "$(dirname "$0")" && pwd)"
VENV="$ROOT/.venv"
PY="$VENV/bin/python"

if [ ! -d "$VENV" ]; then
  echo "Creating venv..."
  python3 -m venv "$VENV"
fi

echo "Installing/ensuring dependencies (livereload)..."
"$VENV/bin/pip" install --upgrade pip >/dev/null
"$VENV/bin/pip" install livereload >/dev/null

PORT=${1:-8000}
echo "Starting livereload server on http://127.0.0.1:$PORT (opening browser)"
exec "$PY" "$ROOT/run_server.py" --port "$PORT" --open
