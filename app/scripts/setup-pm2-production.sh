#!/usr/bin/env bash
set -euo pipefail

APP_NAME="mushroom-battles"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"
PORT="${PORT:-3021}"
RUN_BUILD=1
RUN_STARTUP=1
RUN_SAVE=1
INSTALL_PM2=0
CHECK_ONLY=0
PM2_USER="$(id -un)"
PM2_HOME_DIR="${HOME:-/root}"

usage() {
  cat <<'EOF'
Build and run Mushroom Battles under PM2 for production.

The script validates that production uses PostgreSQL by requiring a
DATABASE_URL in the selected env file with a postgres:// or postgresql:// URL.
It starts app/server/start.js with NODE_ENV=production and DOTENV_CONFIG_PATH
pointing at that env file, then saves the PM2 process list.

Examples:
  app/scripts/setup-pm2-production.sh
  app/scripts/setup-pm2-production.sh --env-file .env.production
  sudo app/scripts/setup-pm2-production.sh --install-pm2
  sudo app/scripts/setup-pm2-production.sh --startup-user root --startup-home /root

Options:
  --name NAME           PM2 process name. Default: mushroom-battles
  --env-file PATH       Env file to load through dotenv. Default: .env
  --port PORT           App port. Default: $PORT or 3021
  --project-root DIR    Project root. Default: auto-detected repo root
  --skip-build          Do not run npm run game:build before PM2 restart.
  --no-startup          Do not run pm2 startup.
  --no-save             Do not run pm2 save.
  --install-pm2         Install PM2 globally with npm if pm2 is missing.
  --check-only          Validate production env and exit without changing PM2.
  --startup-user USER   User for pm2 startup. Default: current user
  --startup-home DIR    Home directory for pm2 startup. Default: $HOME
  -h, --help            Show this help.

Recommended env file values for production:
  NODE_ENV=production
  DATABASE_URL=postgres://user:password@localhost:5432/mushroom_master
  PUBLIC_GAME_URL=https://mushroombattles.com/
  TELEGRAM_GAME_URL=https://mushroombattles.com/
  TELEGRAM_BOT_TOKEN=...
  TELEGRAM_BOT_USERNAME=...
  TELEGRAM_WEBHOOK_SECRET=...
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
  local value="$1"
  if [[ "$value" = /* ]]; then
    printf '%s\n' "$value"
  else
    printf '%s\n' "${PROJECT_ROOT}/${value}"
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

while [[ $# -gt 0 ]]; do
  case "$1" in
    --name) need_arg "$@"; APP_NAME="$2"; shift 2 ;;
    --env-file) need_arg "$@"; ENV_FILE="$2"; shift 2 ;;
    --port) need_arg "$@"; PORT="$2"; shift 2 ;;
    --project-root) need_arg "$@"; PROJECT_ROOT="$2"; shift 2 ;;
    --skip-build) RUN_BUILD=0; shift ;;
    --no-startup) RUN_STARTUP=0; shift ;;
    --no-save) RUN_SAVE=0; shift ;;
    --install-pm2) INSTALL_PM2=1; shift ;;
    --check-only) CHECK_ONLY=1; shift ;;
    --startup-user) need_arg "$@"; PM2_USER="$2"; shift 2 ;;
    --startup-home) need_arg "$@"; PM2_HOME_DIR="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown option: $1" ;;
  esac
done

PROJECT_ROOT="$(cd "$PROJECT_ROOT" && pwd)"
ENV_FILE="$(resolve_path "$ENV_FILE")"

[[ -f "${PROJECT_ROOT}/package.json" ]] || die "package.json not found in ${PROJECT_ROOT}"
[[ -f "${PROJECT_ROOT}/app/server/start.js" ]] || die "app/server/start.js not found in ${PROJECT_ROOT}"
[[ -f "$ENV_FILE" ]] || die "env file not found: $ENV_FILE"
[[ "$PORT" =~ ^[0-9]+$ ]] || die "--port must be numeric"

DATABASE_URL="$(read_env_value DATABASE_URL "$ENV_FILE")"
NODE_ENV_VALUE="$(read_env_value NODE_ENV "$ENV_FILE")"

[[ -n "$DATABASE_URL" ]] || die "DATABASE_URL is required in $ENV_FILE for production"
case "$DATABASE_URL" in
  postgres://*|postgresql://*) ;;
  *) die "DATABASE_URL must use postgres:// or postgresql:// in production" ;;
esac
if [[ -n "$NODE_ENV_VALUE" && "$NODE_ENV_VALUE" != "production" ]]; then
  die "NODE_ENV in $ENV_FILE must be production, found: $NODE_ENV_VALUE"
fi

if [[ "$CHECK_ONLY" -eq 1 ]]; then
  cat <<EOF
Production env check passed.

Environment:
  NODE_ENV=production
  PORT=${PORT}
  DOTENV_CONFIG_PATH=${ENV_FILE}
  DATABASE_URL=${DATABASE_URL%%@*}@...
EOF
  exit 0
fi

if ! command -v pm2 >/dev/null 2>&1; then
  if [[ "$INSTALL_PM2" -eq 1 ]]; then
    command -v npm >/dev/null 2>&1 || die "npm is required to install pm2"
    npm install -g pm2
  else
    die "pm2 is not installed. Install it with: npm install -g pm2, or rerun with --install-pm2"
  fi
fi

cd "$PROJECT_ROOT"

if [[ "$RUN_BUILD" -eq 1 ]]; then
  npm run game:build
fi

if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  NODE_ENV=production \
  PORT="$PORT" \
  DOTENV_CONFIG_PATH="$ENV_FILE" \
    pm2 restart "$APP_NAME" --update-env
else
  NODE_ENV=production \
  PORT="$PORT" \
  DOTENV_CONFIG_PATH="$ENV_FILE" \
    pm2 start app/server/start.js \
      --name "$APP_NAME" \
      --cwd "$PROJECT_ROOT" \
      --time \
      --update-env
fi

pm2 status "$APP_NAME"

if [[ "$RUN_SAVE" -eq 1 ]]; then
  pm2 save
fi

if [[ "$RUN_STARTUP" -eq 1 ]]; then
  pm2 startup systemd -u "$PM2_USER" --hp "$PM2_HOME_DIR"
fi

cat <<EOF

PM2 production setup complete.

Process:
  pm2 status ${APP_NAME}
  pm2 logs ${APP_NAME}
  pm2 restart ${APP_NAME} --update-env

Environment:
  NODE_ENV=production
  PORT=${PORT}
  DOTENV_CONFIG_PATH=${ENV_FILE}
  DATABASE_URL=${DATABASE_URL%%@*}@...
EOF
