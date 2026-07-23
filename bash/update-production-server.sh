#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "${PROJECT_ROOT}/app/scripts/lib/production-server.sh"
ENV_FILE="${PROJECT_ROOT}/.env"
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.production.yml"
BRANCH="main"
PULL_CODE=1
BUILD=1
FOLLOW_LOGS=0
CACHE_CLEANUP=1
AGGRESSIVE_CLEANUP=1
HEALTH_URL=""

MIN_FREE_DISK_KB=$((5 * 1024 * 1024))
MAX_REPO_BUILD_CACHE_KB=$((1024 * 1024))
MAX_DOCKER_BUILD_CACHE_KB=$((2 * 1024 * 1024))
MIN_FREE_DISK_AFTER_CLEANUP_KB=$((3 * 1024 * 1024))

usage() {
  cat <<'EOF'
Update Mushroom Battles production from git and restart Docker Compose.

The script pulls origin/main, aggressively prunes safe Docker/repo build cache,
rebuilds the app container, waits for the local health route, and prints recent
logs on failure. Docker volumes are never pruned.

Examples:
  bash/update-production-server.sh
  bash/update-production-server.sh --logs
  bash/update-production-server.sh --preflight-cleanup
  bash/update-production-server.sh --no-pull --no-build

Options:
  --env-file PATH          Env file for Docker Compose. Default: .env
  --project-root DIR       Project root. Default: auto-detected repo root
  --compose-file PATH      Compose file. Default: docker-compose.production.yml
  --branch NAME            Git branch to pull. Default: main
  --health-url URL         Health URL. Default: http://127.0.0.1:${PORT:-3021}/api/health
  --no-pull                Do not pull from git
  --no-build               Restart without rebuilding the app image
  --no-cache-cleanup       Skip disk/cache cleanup
  --preflight-cleanup      Only prune cache when disk/cache thresholds are exceeded
  --aggressive-cleanup     Prune all unused Docker build/image cache before build (default)
  --logs                   Follow app logs after update
  -h, --help               Show this help.
EOF
}

root_free_kb() {
  df -Pk / | awk 'NR == 2 { print $4 }'
}

path_size_kb() {
  local path="$1"
  [[ -e "$path" ]] || {
    printf '0\n'
    return
  }
  du -sk "$path" 2>/dev/null | awk '{ print $1 }'
}

repo_build_cache_kb() {
  local total=0
  local size
  for path in \
    "${PROJECT_ROOT}/.docker-build-cache" \
    "${PROJECT_ROOT}/node_modules/.cache" \
    "${PROJECT_ROOT}/node_modules/.vite" \
    "${PROJECT_ROOT}/web/node_modules/.vite" \
    "${PROJECT_ROOT}/web/dist"; do
    size="$(path_size_kb "$path")"
    total=$((total + size))
  done
  printf '%s\n' "$total"
}

docker_build_cache_kb() {
  local total_kb=0
  local raw
  local kb

  while IFS= read -r raw; do
    [[ -n "$raw" ]] || continue
    kb="$(awk -v raw="$raw" '
      BEGIN {
        value = raw;
        unit = raw;
        gsub(/[^0-9.]/, "", value);
        gsub(/[0-9.]/, "", unit);
        if (value == "") {
          print 0;
          exit;
        }
        if (unit == "B") multiplier = 1 / 1024;
        else if (unit == "kB" || unit == "KB" || unit == "KiB") multiplier = 1;
        else if (unit == "MB") multiplier = 1000;
        else if (unit == "MiB") multiplier = 1024;
        else if (unit == "GB") multiplier = 1000 * 1000;
        else if (unit == "GiB") multiplier = 1024 * 1024;
        else if (unit == "TB") multiplier = 1000 * 1000 * 1000;
        else if (unit == "TiB") multiplier = 1024 * 1024 * 1024;
        else multiplier = 1;
        printf "%.0f\n", value * multiplier;
      }
    ')"
    total_kb=$((total_kb + kb))
  done < <(docker builder du --format '{{.Size}}' 2>/dev/null || true)

  printf '%s\n' "$total_kb"
}

docker_context_extra_kb() {
  local total=0
  local size
  for path in \
    "${PROJECT_ROOT}/node_modules" \
    "${PROJECT_ROOT}/screenshots" \
    "${PROJECT_ROOT}/test-results" \
    "${PROJECT_ROOT}/playwright-report" \
    "${PROJECT_ROOT}/data"; do
    size="$(path_size_kb "$path")"
    total=$((total + size))
  done
  printf '%s\n' "$total"
}

print_disk_summary() {
  local free_kb="$1"
  local repo_cache_kb="$2"
  local docker_cache_kb="$3"
  local context_extra_kb="$4"

  echo ""
  echo "Disk/cache summary:"
  echo "  root free:            $(df -h / | awk 'NR == 2 { print $4 }')"
  echo "  repo build cache:     $((repo_cache_kb / 1024)) MB"
  echo "  docker build cache:   $((docker_cache_kb / 1024)) MB"
  echo "  excluded local files: $((context_extra_kb / 1024)) MB"
}

cleanup_repo_cache() {
  rm -rf \
    "${PROJECT_ROOT}/.docker-build-cache" \
    "${PROJECT_ROOT}/node_modules/.cache" \
    "${PROJECT_ROOT}/node_modules/.vite" \
    "${PROJECT_ROOT}/web/node_modules/.vite" \
    "${PROJECT_ROOT}/web/dist"
}

cleanup_docker_space() {
  local mode="$1"
  local remove_repo_cache="$2"

  echo ""
  echo "Cleaning Docker/cache space (${mode})..."

  if [[ "$remove_repo_cache" -eq 1 ]]; then
    cleanup_repo_cache
  fi

  docker container prune -f >/dev/null || true

  if [[ "$mode" == "aggressive" ]]; then
    docker builder prune -af >/dev/null || true
    if docker buildx version >/dev/null 2>&1; then
      docker buildx prune -af >/dev/null || true
    fi
    docker system prune -af >/dev/null || true
    docker image prune -af >/dev/null || true
  else
    docker builder prune -f --filter until=24h >/dev/null || true
    if docker buildx version >/dev/null 2>&1; then
      docker buildx prune -f --filter until=24h >/dev/null || true
    fi
    docker image prune -f >/dev/null || true
  fi

  docker network prune -f >/dev/null || true
  docker system df || true
}

maybe_cleanup_docker_space() {
  local free_kb
  local repo_cache_kb
  local docker_cache_kb
  local context_extra_kb
  local needs_cleanup=0
  local remove_repo_cache=0
  local cleanup_mode="preflight"

  if [[ "$CACHE_CLEANUP" -eq 0 ]]; then
    return
  fi

  free_kb="$(root_free_kb)"
  repo_cache_kb="$(repo_build_cache_kb)"
  docker_cache_kb="$(docker_build_cache_kb)"
  context_extra_kb="$(docker_context_extra_kb)"

  print_disk_summary "$free_kb" "$repo_cache_kb" "$docker_cache_kb" "$context_extra_kb"

  if [[ "$AGGRESSIVE_CLEANUP" -eq 1 ]]; then
    needs_cleanup=1
    remove_repo_cache=1
    cleanup_mode="aggressive"
  fi

  if [[ -n "$free_kb" && "$free_kb" -lt "$MIN_FREE_DISK_KB" ]]; then
    echo "Low root free space detected before build."
    needs_cleanup=1
  fi

  if [[ -n "$repo_cache_kb" && "$repo_cache_kb" -gt "$MAX_REPO_BUILD_CACHE_KB" ]]; then
    echo "Repo build cache exceeds threshold."
    needs_cleanup=1
    remove_repo_cache=1
  fi

  if [[ -n "$docker_cache_kb" && "$docker_cache_kb" -gt "$MAX_DOCKER_BUILD_CACHE_KB" ]]; then
    echo "Docker build cache exceeds threshold."
    needs_cleanup=1
  fi

  if [[ "$needs_cleanup" -eq 1 ]]; then
    cleanup_docker_space "$cleanup_mode" "$remove_repo_cache"
  fi

  free_kb="$(root_free_kb)"
  if [[ -n "$free_kb" && "$free_kb" -lt "$MIN_FREE_DISK_AFTER_CLEANUP_KB" ]]; then
    die "root free space is still too low for a Docker build: $(df -h / | awk 'NR == 2 { print $4 }') free"
  fi

  if [[ -n "$context_extra_kb" && "$context_extra_kb" -gt "$MAX_REPO_BUILD_CACHE_KB" ]]; then
    echo "Large local deploy artifacts are present but excluded from Docker context by .dockerignore."
  fi
}

run_compose() {
  # shellcheck disable=SC2086
  ${COMPOSE_BIN} "${BASE_ARGS[@]}" "$@"
}

restart_with_retry() {
  local first_attempt_exit=0

  set +e
  if [[ "$BUILD" -eq 1 ]]; then
    run_compose up -d --build --remove-orphans app
  else
    run_compose restart app
  fi
  first_attempt_exit=$?
  set -e

  if [[ "$first_attempt_exit" -eq 0 ]]; then
    return
  fi

  echo ""
  echo "Docker restart/build failed on the first attempt. Retrying after aggressive cache cleanup..."
  cleanup_docker_space "aggressive" "1"
  if [[ "$BUILD" -eq 1 ]]; then
    run_compose up -d --build --remove-orphans app
  else
    run_compose restart app
  fi
}

wait_for_app_health() {
  local attempts=36
  local response=""
  local app_container=""
  local state=""
  local restarts=""

  echo ""
  echo "Waiting for app health: ${HEALTH_URL}"

  for attempt in $(seq 1 "$attempts"); do
    response="$(curl -fsS --max-time 3 "$HEALTH_URL" 2>/dev/null || true)"
    if [[ "$response" == *'"success":true'* ]]; then
      echo "App health check passed."
      return
    fi

    app_container="$(run_compose ps -q app || true)"
    if [[ -n "$app_container" ]]; then
      state="$(docker inspect -f '{{.State.Status}}' "$app_container" 2>/dev/null || true)"
      restarts="$(docker inspect -f '{{.RestartCount}}' "$app_container" 2>/dev/null || true)"
      if [[ "$state" == "exited" || "$state" == "dead" ]]; then
        echo "App container state is ${state}."
        run_compose logs --tail=160 app || true
        exit 1
      fi
      if [[ -n "$restarts" && "$restarts" -gt 2 ]]; then
        echo "App container restarted ${restarts} times while waiting for health."
        run_compose logs --tail=160 app || true
        exit 1
      fi
    fi

    echo "  attempt ${attempt}/${attempts}: state=${state:-unknown} restarts=${restarts:-unknown}"
    sleep 5
  done

  echo "App did not become healthy in time."
  run_compose ps || true
  run_compose logs --tail=160 app || true
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file) need_arg "$@"; ENV_FILE="$2"; shift 2 ;;
    --project-root) need_arg "$@"; PROJECT_ROOT="$2"; shift 2 ;;
    --compose-file) need_arg "$@"; COMPOSE_FILE="$2"; shift 2 ;;
    --branch) need_arg "$@"; BRANCH="$2"; shift 2 ;;
    --health-url) need_arg "$@"; HEALTH_URL="$2"; shift 2 ;;
    --no-pull) PULL_CODE=0; shift ;;
    --no-build) BUILD=0; shift ;;
    --no-cache-cleanup) CACHE_CLEANUP=0; shift ;;
    --preflight-cleanup) AGGRESSIVE_CLEANUP=0; shift ;;
    --aggressive-cleanup) AGGRESSIVE_CLEANUP=1; shift ;;
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
command -v git >/dev/null 2>&1 || die "git is not installed or not in PATH"
command -v docker >/dev/null 2>&1 || die "docker is not installed or not in PATH"
command -v curl >/dev/null 2>&1 || die "curl is not installed or not in PATH"
COMPOSE_BIN="$(compose_cmd)" || die "docker compose plugin or docker-compose is required"

PORT_VALUE="$(read_env_value PORT "$ENV_FILE")"
PORT_VALUE="${PORT_VALUE:-3021}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:${PORT_VALUE}/api/health}"

cd "$PROJECT_ROOT"
BASE_ARGS=(--env-file "$ENV_FILE" -f "$COMPOSE_FILE")

run_compose config >/dev/null

echo ""
echo "Update details:"
echo "  project root: ${PROJECT_ROOT}"
echo "  branch:       ${BRANCH}"
echo "  env file:     ${ENV_FILE}"
echo "  compose file: ${COMPOSE_FILE}"
echo "  health URL:   ${HEALTH_URL}"

if [[ "$PULL_CODE" -eq 1 ]]; then
  [[ -z "$(git status --porcelain)" ]] || die "working tree is dirty; commit/stash changes before production update"
  echo ""
  echo "Pulling latest code..."
  git fetch origin "$BRANCH"
  git checkout "$BRANCH"
  git pull --ff-only origin "$BRANCH"
  if [[ -f .gitmodules ]]; then
    echo ""
    echo "Synchronizing submodule URLs..."
    git submodule sync --recursive
    echo "Initializing and fetching pinned submodules..."
    git submodule update --init --recursive --progress
  fi
fi

echo ""
echo "Checking disk and Docker cache state..."
maybe_cleanup_docker_space

echo ""
echo "Restarting production app..."
restart_with_retry
wait_for_app_health

run_compose ps

if [[ "$FOLLOW_LOGS" -eq 1 ]]; then
  run_compose logs -f --tail=100 app
fi

echo ""
echo "Production update complete."
