#!/usr/bin/env bash
set -euo pipefail

base_url="${CDP_PROXY_BASE_URL:-http://localhost:3456}"

cmd="${1:-}"
if [[ -z "$cmd" ]]; then
  echo "usage: $0 <health|targets|eval|eval-file|click|screenshot|new|navigate|close> [args...]" >&2
  exit 1
fi
shift

case "$cmd" in
  health)
    curl -s "${base_url}/health"
    ;;
  targets)
    curl -s "${base_url}/targets"
    ;;
  eval)
    target="${1:?missing target}"
    js="${2:?missing js}"
    curl -s -X POST "${base_url}/eval?target=${target}" -d "$js"
    ;;
  eval-file)
    target="${1:?missing target}"
    file="${2:?missing file}"
    curl -s -X POST "${base_url}/eval?target=${target}" --data-binary @"$file"
    ;;
  click)
    target="${1:?missing target}"
    selector="${2:?missing selector}"
    curl -s -X POST "${base_url}/click?target=${target}" -d "$selector"
    ;;
  screenshot)
    target="${1:?missing target}"
    file="${2:?missing file}"
    curl -s "${base_url}/screenshot?target=${target}&file=${file}"
    ;;
  new)
    url="${1:?missing url}"
    curl -s "${base_url}/new?url=${url}"
    ;;
  navigate)
    target="${1:?missing target}"
    url="${2:?missing url}"
    curl -s "${base_url}/navigate?target=${target}&url=${url}"
    ;;
  close)
    target="${1:?missing target}"
    curl -s "${base_url}/close?target=${target}"
    ;;
  *)
    echo "unknown command: $cmd" >&2
    exit 1
    ;;
esac
