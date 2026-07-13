#!/usr/bin/env bash

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
