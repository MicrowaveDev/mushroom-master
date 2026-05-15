#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.production.yml"
CHECK_ONLY=0
PULL=0
BUILD=1

usage() {
  cat <<'EOF'
Build and run Mushroom Battles in production with Docker Compose.

This starts two services:
  postgres  PostgreSQL with a named Docker volume
  app       Express/Vue production app on 127.0.0.1:${PORT:-3021}

The app receives DATABASE_URL for the postgres container automatically:
  postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}

Examples:
  app/scripts/setup-docker-production.sh --check-only
  app/scripts/setup-docker-production.sh
  app/scripts/setup-docker-production.sh --pull
  app/scripts/setup-docker-production.sh --env-file .env.production

Options:
  --env-file PATH       Env file for Docker Compose. Default: .env
  --project-root DIR    Project root. Default: auto-detected repo root
  --compose-file PATH   Compose file. Default: docker-compose.production.yml
  --check-only          Validate env/tooling and print the resolved commands.
  --pull                Pull base images before starting.
  --no-build            Start without rebuilding the app image.
  -h, --help            Show this help.

Required env file values:
  NODE_ENV=production
  PORT=3021
  POSTGRES_PASSWORD=<strong-password>
  TELEGRAM_BOT_TOKEN=...
  TELEGRAM_BOT_USERNAME=...
  TELEGRAM_WEBHOOK_SECRET=...

Optional env file values:
  POSTGRES_DB=mushroom_battles
  POSTGRES_USER=mushroom_user
  PUBLIC_GAME_URL=https://mushroombattles.com/
  TELEGRAM_GAME_URL=https://mushroombattles.com/
  TELEGRAM_MINI_APP_NAME=app
  TELEGRAM_GAME_SHORT_NAME=mushroom_master
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

read_env_value() {
  local key="$1"
  local file="$2"
  local line
  line="$(grep -E "^[[:space:]]*(export[[:space:]]+)?${key}=" "$file" | tail -n 1 || true)"
  [[ -n "$line" ]] || return 0
  line="${line#export }"
  line="${line#${key}=}"
  line="${line%%#*}"
  line="${line%"${line##*[![:space:]]}"}"
  line="${line#"${line%%[![:space:]]*}"}"
  line="${line%\"}"
  line="${line#\"}"
  line="${line%\'}"
  line="${line#\'}"
  printf '%s\n' "$line"
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
    --check-only) CHECK_ONLY=1; shift ;;
    --pull) PULL=1; shift ;;
    --no-build) BUILD=0; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown option: $1" ;;
  esac
done

PROJECT_ROOT="$(cd "$PROJECT_ROOT" && pwd)"
ENV_FILE="$(resolve_path "$PROJECT_ROOT" "$ENV_FILE")"
COMPOSE_FILE="$(resolve_path "$PROJECT_ROOT" "$COMPOSE_FILE")"

[[ -f "${PROJECT_ROOT}/package.json" ]] || die "package.json not found in ${PROJECT_ROOT}"
[[ -f "${PROJECT_ROOT}/Dockerfile" ]] || die "Dockerfile not found in ${PROJECT_ROOT}"
[[ -f "$COMPOSE_FILE" ]] || die "compose file not found: $COMPOSE_FILE"
[[ -f "$ENV_FILE" ]] || die "env file not found: $ENV_FILE"
command -v docker >/dev/null 2>&1 || die "docker is not installed or not in PATH"
COMPOSE_BIN="$(compose_cmd)" || die "docker compose plugin or docker-compose is required"

NODE_ENV_VALUE="$(read_env_value NODE_ENV "$ENV_FILE")"
PORT_VALUE="$(read_env_value PORT "$ENV_FILE")"
POSTGRES_DB_VALUE="$(read_env_value POSTGRES_DB "$ENV_FILE")"
POSTGRES_USER_VALUE="$(read_env_value POSTGRES_USER "$ENV_FILE")"
POSTGRES_PASSWORD_VALUE="$(read_env_value POSTGRES_PASSWORD "$ENV_FILE")"
TELEGRAM_BOT_TOKEN_VALUE="$(read_env_value TELEGRAM_BOT_TOKEN "$ENV_FILE")"
TELEGRAM_BOT_USERNAME_VALUE="$(read_env_value TELEGRAM_BOT_USERNAME "$ENV_FILE")"
TELEGRAM_WEBHOOK_SECRET_VALUE="$(read_env_value TELEGRAM_WEBHOOK_SECRET "$ENV_FILE")"

[[ -z "$NODE_ENV_VALUE" || "$NODE_ENV_VALUE" == "production" ]] || die "NODE_ENV in $ENV_FILE must be production, found: $NODE_ENV_VALUE"
[[ -z "$PORT_VALUE" || "$PORT_VALUE" =~ ^[0-9]+$ ]] || die "PORT in $ENV_FILE must be numeric"
[[ -n "$POSTGRES_PASSWORD_VALUE" ]] || die "POSTGRES_PASSWORD is required in $ENV_FILE"
[[ "$POSTGRES_PASSWORD_VALUE" != "change-me" && "$POSTGRES_PASSWORD_VALUE" != "YOUR_POSTGRES_PASSWORD" ]] || die "POSTGRES_PASSWORD must be changed from the placeholder"
[[ -n "$TELEGRAM_BOT_TOKEN_VALUE" ]] || die "TELEGRAM_BOT_TOKEN is required in $ENV_FILE"
[[ -n "$TELEGRAM_BOT_USERNAME_VALUE" ]] || die "TELEGRAM_BOT_USERNAME is required in $ENV_FILE"
[[ -n "$TELEGRAM_WEBHOOK_SECRET_VALUE" ]] || die "TELEGRAM_WEBHOOK_SECRET is required in $ENV_FILE"

POSTGRES_DB_VALUE="${POSTGRES_DB_VALUE:-mushroom_battles}"
POSTGRES_USER_VALUE="${POSTGRES_USER_VALUE:-mushroom_user}"
PORT_VALUE="${PORT_VALUE:-3021}"

cd "$PROJECT_ROOT"

BASE_ARGS=(--env-file "$ENV_FILE" -f "$COMPOSE_FILE")

# Validate Compose interpolation before touching containers.
# shellcheck disable=SC2086
${COMPOSE_BIN} "${BASE_ARGS[@]}" config >/dev/null

cat <<EOF
Docker production config OK.

Compose:
  ${COMPOSE_BIN} --env-file ${ENV_FILE} -f ${COMPOSE_FILE} up -d$([[ "$BUILD" -eq 1 ]] && printf ' --build')

Services:
  app:      http://127.0.0.1:${PORT_VALUE}
  postgres: ${POSTGRES_USER_VALUE}@postgres:5432/${POSTGRES_DB_VALUE}

Useful commands:
  ${COMPOSE_BIN} --env-file ${ENV_FILE} -f ${COMPOSE_FILE} ps
  ${COMPOSE_BIN} --env-file ${ENV_FILE} -f ${COMPOSE_FILE} logs -f app
  ${COMPOSE_BIN} --env-file ${ENV_FILE} -f ${COMPOSE_FILE} exec postgres sh -c 'pg_dump -U "\$POSTGRES_USER" "\$POSTGRES_DB"' > mushroom_battles.dump.sql
EOF

if [[ "$CHECK_ONLY" -eq 1 ]]; then
  exit 0
fi

if [[ "$PULL" -eq 1 ]]; then
  # shellcheck disable=SC2086
  ${COMPOSE_BIN} "${BASE_ARGS[@]}" pull postgres
fi

if [[ "$BUILD" -eq 1 ]]; then
  # shellcheck disable=SC2086
  ${COMPOSE_BIN} "${BASE_ARGS[@]}" up -d --build
else
  # shellcheck disable=SC2086
  ${COMPOSE_BIN} "${BASE_ARGS[@]}" up -d
fi

# shellcheck disable=SC2086
${COMPOSE_BIN} "${BASE_ARGS[@]}" ps
