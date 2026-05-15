#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.production.yml"
SERVICE="app"
BUILD=0
PULL=0
FOLLOW_LOGS=0

usage() {
  cat <<'EOF'
Restart Mushroom Battles production services with Docker Compose.

By default this restarts only the app container and keeps Postgres running.

Examples:
  app/scripts/restart-production-server.sh
  app/scripts/restart-production-server.sh --build
  app/scripts/restart-production-server.sh --pull --build --logs
  app/scripts/restart-production-server.sh --all
  app/scripts/restart-production-server.sh --env-file .env.production

Options:
  --env-file PATH       Env file for Docker Compose. Default: .env
  --project-root DIR    Project root. Default: auto-detected repo root
  --compose-file PATH   Compose file. Default: docker-compose.production.yml
  --service NAME        Service to restart. Default: app
  --all                 Restart the full stack, including postgres
  --build               Rebuild before starting the selected service
  --pull                Pull base/service images before restart
  --logs                Follow app logs after restart
  -h, --help            Show this help.
EOF
}

die() {
  echo "error: $*" >&2
  exit 1
}

need_arg() {
  [[ $# -ge 2 && -n "${2:-}" ]] || die "$1 requires a value"
}

resolve_path() {
  local base="$1"
  local value="$2"
  if [[ "$value" = /* ]]; then
    printf '%s\n' "$value"
  else
    printf '%s\n' "${base}/${value}"
  fi
}

compose_cmd() {
  if docker compose version >/dev/null 2>&1; then
    printf 'docker compose'
  elif command -v docker-compose >/dev/null 2>&1; then
    printf 'docker-compose'
  else
    return 1
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file) need_arg "$@"; ENV_FILE="$2"; shift 2 ;;
    --project-root) need_arg "$@"; PROJECT_ROOT="$2"; shift 2 ;;
    --compose-file) need_arg "$@"; COMPOSE_FILE="$2"; shift 2 ;;
    --service) need_arg "$@"; SERVICE="$2"; shift 2 ;;
    --all) SERVICE=""; shift ;;
    --build) BUILD=1; shift ;;
    --pull) PULL=1; shift ;;
    --logs) FOLLOW_LOGS=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown option: $1" ;;
  esac
done

PROJECT_ROOT="$(cd "$PROJECT_ROOT" && pwd)"
ENV_FILE="$(resolve_path "$PROJECT_ROOT" "$ENV_FILE")"
COMPOSE_FILE="$(resolve_path "$PROJECT_ROOT" "$COMPOSE_FILE")"

[[ -f "${PROJECT_ROOT}/package.json" ]] || die "package.json not found in ${PROJECT_ROOT}"
[[ -f "$COMPOSE_FILE" ]] || die "compose file not found: $COMPOSE_FILE"
[[ -f "$ENV_FILE" ]] || die "env file not found: $ENV_FILE"
command -v docker >/dev/null 2>&1 || die "docker is not installed or not in PATH"
COMPOSE_BIN="$(compose_cmd)" || die "docker compose plugin or docker-compose is required"

cd "$PROJECT_ROOT"

BASE_ARGS=(--env-file "$ENV_FILE" -f "$COMPOSE_FILE")

# Validate Compose interpolation before touching containers.
# shellcheck disable=SC2086
${COMPOSE_BIN} "${BASE_ARGS[@]}" config >/dev/null

if [[ "$PULL" -eq 1 ]]; then
  if [[ -n "$SERVICE" ]]; then
    # shellcheck disable=SC2086
    ${COMPOSE_BIN} "${BASE_ARGS[@]}" pull "$SERVICE"
  else
    # shellcheck disable=SC2086
    ${COMPOSE_BIN} "${BASE_ARGS[@]}" pull
  fi
fi

if [[ "$BUILD" -eq 1 ]]; then
  if [[ -n "$SERVICE" ]]; then
    # shellcheck disable=SC2086
    ${COMPOSE_BIN} "${BASE_ARGS[@]}" up -d --build --no-deps "$SERVICE"
  else
    # shellcheck disable=SC2086
    ${COMPOSE_BIN} "${BASE_ARGS[@]}" up -d --build
  fi
else
  if [[ -n "$SERVICE" ]]; then
    # shellcheck disable=SC2086
    ${COMPOSE_BIN} "${BASE_ARGS[@]}" restart "$SERVICE"
  else
    # shellcheck disable=SC2086
    ${COMPOSE_BIN} "${BASE_ARGS[@]}" restart
  fi
fi

# shellcheck disable=SC2086
${COMPOSE_BIN} "${BASE_ARGS[@]}" ps

if [[ "$FOLLOW_LOGS" -eq 1 ]]; then
  LOG_SERVICE="${SERVICE:-app}"
  # shellcheck disable=SC2086
  ${COMPOSE_BIN} "${BASE_ARGS[@]}" logs -f --tail=100 "$LOG_SERVICE"
fi
