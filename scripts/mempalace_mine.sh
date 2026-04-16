#!/bin/bash
set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
MEMPALACE_PYTHON=${MEMPALACE_PYTHON:-"$HOME/.venvs/mempalace/bin/python"}

exec "$MEMPALACE_PYTHON" "$SCRIPT_DIR/mempalace_mine.py" "$@"
