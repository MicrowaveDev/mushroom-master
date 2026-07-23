#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CORE_SCRIPT="${PROJECT_ROOT}/vendor/backpack-game-core/bash/update-production-server.sh"
BRANCH="main"
PULL_CODE=1
SHOW_HELP=0
CORE_ARGS=()

die() {
  echo "error: $*" >&2
  exit 1
}

need_arg() {
  [[ $# -ge 2 && -n "${2:-}" ]] || die "$1 requires a value"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --branch)
      need_arg "$@"
      BRANCH="$2"
      shift 2
      ;;
    --no-pull)
      PULL_CODE=0
      shift
      ;;
    -h|--help)
      SHOW_HELP=1
      shift
      ;;
    *)
      CORE_ARGS+=("$1")
      shift
      ;;
  esac
done

cd "$PROJECT_ROOT"
command -v git >/dev/null 2>&1 || die "git is not installed or not in PATH"

if [[ "$PULL_CODE" -eq 1 ]]; then
  [[ -z "$(git status --porcelain)" ]] \
    || die "working tree is dirty; commit or stash changes before production update"
  echo "Pulling Mushroom Battles ${BRANCH}..."
  git fetch origin "$BRANCH"
  git checkout "$BRANCH"
  git pull --ff-only origin "$BRANCH"
fi

echo "Synchronizing and initializing pinned submodules..."
git submodule sync --recursive
git submodule update --init --recursive --progress

[[ -f "$CORE_SCRIPT" ]] || die "core production updater not found: ${CORE_SCRIPT}"

if [[ "$SHOW_HELP" -eq 1 ]]; then
  cat <<'EOF'
Mushroom Battles production bootstrap options:
  --branch NAME            Product branch to pull. Default: main
  --no-pull                Skip the product Git pull; still initialize core

Shared production runner options:
EOF
  exec bash "$CORE_SCRIPT" --help
fi

exec bash "$CORE_SCRIPT" \
  --project-root "$PROJECT_ROOT" \
  --env-file .env \
  --compose-file docker-compose.production.yml \
  --service app \
  --health-port-env PORT \
  --health-port-default 3021 \
  --health-path /api/health \
  "${CORE_ARGS[@]}"
