#!/usr/bin/env bash
set -euo pipefail

DOMAIN="mushroombattles.com"
INCLUDE_WWW=1
SITE_NAME="mushroom-battles"
UPSTREAM_HOST="127.0.0.1"
UPSTREAM_PORT="${PORT:-3021}"
TLS_MODE="auto"
CERT_PATH=""
KEY_PATH=""
CERTBOT_SSL_OPTIONS="/etc/letsencrypt/options-ssl-nginx.conf"
CERTBOT_SSL_DHPARAM="/etc/letsencrypt/ssl-dhparams.pem"
INSTALL=0
RELOAD=1
NGINX_AVAILABLE="/etc/nginx/sites-available"
NGINX_ENABLED="/etc/nginx/sites-enabled"
ACME_ROOT="/var/www/certbot"

usage() {
  cat <<'EOF'
Create or print the nginx reverse-proxy config for Mushroom Battles.

Default behavior prints the generated config without touching /etc/nginx.
Use --install with sudo to write, enable, validate, and reload nginx.

Examples:
  app/scripts/setup-nginx-production.sh
  sudo app/scripts/setup-nginx-production.sh --install
  sudo app/scripts/setup-nginx-production.sh --install --tls off
  sudo app/scripts/setup-nginx-production.sh --install --port 3021

Options:
  --domain DOMAIN       Production domain. Default: mushroombattles.com
  --no-www             Do not include www.DOMAIN in server_name.
  --site-name NAME     nginx site filename. Default: mushroom-battles
  --host HOST          Upstream Node host. Default: 127.0.0.1
  --port PORT          Upstream Node port. Default: $PORT or 3021
  --tls auto|on|off    auto uses HTTPS only when cert files exist. Default: auto
  --cert PATH          TLS fullchain path. Default: /etc/letsencrypt/live/DOMAIN/fullchain.pem
  --key PATH           TLS private key path. Default: /etc/letsencrypt/live/DOMAIN/privkey.pem
  --ssl-options PATH   Optional Certbot SSL options include.
  --ssl-dhparam PATH   Optional Certbot ssl_dhparam file.
  --install            Write to sites-available, enable symlink, nginx -t, reload.
  --no-reload          Validate but do not reload nginx.
  --available DIR      sites-available directory. Default: /etc/nginx/sites-available
  --enabled DIR        sites-enabled directory. Default: /etc/nginx/sites-enabled
  --acme-root DIR      Webroot for ACME challenges. Default: /var/www/certbot
  -h, --help           Show this help.

First-time TLS flow:
  1. sudo app/scripts/setup-nginx-production.sh --install --tls off
  2. sudo certbot certonly --webroot -w /var/www/certbot -d mushroombattles.com -d www.mushroombattles.com
  3. sudo app/scripts/setup-nginx-production.sh --install --tls on
EOF
}

die() {
  echo "error: $*" >&2
  exit 1
}

need_arg() {
  [[ $# -ge 2 && -n "${2:-}" ]] || die "$1 requires a value"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) need_arg "$@"; DOMAIN="$2"; shift 2 ;;
    --no-www) INCLUDE_WWW=0; shift ;;
    --site-name) need_arg "$@"; SITE_NAME="$2"; shift 2 ;;
    --host) need_arg "$@"; UPSTREAM_HOST="$2"; shift 2 ;;
    --port) need_arg "$@"; UPSTREAM_PORT="$2"; shift 2 ;;
    --tls) need_arg "$@"; TLS_MODE="$2"; shift 2 ;;
    --cert) need_arg "$@"; CERT_PATH="$2"; shift 2 ;;
    --key) need_arg "$@"; KEY_PATH="$2"; shift 2 ;;
    --ssl-options) need_arg "$@"; CERTBOT_SSL_OPTIONS="$2"; shift 2 ;;
    --ssl-dhparam) need_arg "$@"; CERTBOT_SSL_DHPARAM="$2"; shift 2 ;;
    --install) INSTALL=1; shift ;;
    --no-reload) RELOAD=0; shift ;;
    --available) need_arg "$@"; NGINX_AVAILABLE="$2"; shift 2 ;;
    --enabled) need_arg "$@"; NGINX_ENABLED="$2"; shift 2 ;;
    --acme-root) need_arg "$@"; ACME_ROOT="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown option: $1" ;;
  esac
done

[[ -n "$DOMAIN" ]] || die "--domain is required"
[[ -n "$SITE_NAME" ]] || die "--site-name is required"
[[ "$UPSTREAM_PORT" =~ ^[0-9]+$ ]] || die "--port must be numeric"
case "$TLS_MODE" in
  auto|on|off) ;;
  *) die "--tls must be auto, on, or off" ;;
esac

if [[ -z "$CERT_PATH" ]]; then
  CERT_PATH="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
fi
if [[ -z "$KEY_PATH" ]]; then
  KEY_PATH="/etc/letsencrypt/live/${DOMAIN}/privkey.pem"
fi

SERVER_NAMES="$DOMAIN"
CERTBOT_ARGS="-d ${DOMAIN}"
if [[ "$INCLUDE_WWW" -eq 1 ]]; then
  SERVER_NAMES="${DOMAIN} www.${DOMAIN}"
  CERTBOT_ARGS="${CERTBOT_ARGS} -d www.${DOMAIN}"
fi

TLS_ENABLED=0
if [[ "$TLS_MODE" == "on" ]]; then
  [[ -f "$CERT_PATH" ]] || die "TLS cert not found: $CERT_PATH"
  [[ -f "$KEY_PATH" ]] || die "TLS key not found: $KEY_PATH"
  TLS_ENABLED=1
elif [[ "$TLS_MODE" == "auto" && -f "$CERT_PATH" && -f "$KEY_PATH" ]]; then
  TLS_ENABLED=1
fi

render_proxy_locations() {
  cat <<EOF
  location / {
    proxy_pass http://mushroom_battles_app;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Host \$host;
    proxy_set_header X-Forwarded-Port \$server_port;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection \$mushroom_battles_connection_upgrade;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
    proxy_buffering off;
  }
EOF
}

render_tls_settings() {
  cat <<EOF
  ssl_certificate ${CERT_PATH};
  ssl_certificate_key ${KEY_PATH};
EOF

  if [[ -f "$CERTBOT_SSL_OPTIONS" ]]; then
    cat <<EOF
  include ${CERTBOT_SSL_OPTIONS};
EOF
  else
    cat <<'EOF'
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_prefer_server_ciphers off;
  ssl_session_cache shared:SSL:10m;
  ssl_session_timeout 1d;
  ssl_session_tickets off;
EOF
  fi

  if [[ -f "$CERTBOT_SSL_DHPARAM" ]]; then
    cat <<EOF
  ssl_dhparam ${CERTBOT_SSL_DHPARAM};
EOF
  fi
}

render_config() {
  cat <<EOF
# Managed by app/scripts/setup-nginx-production.sh.
# Reverse proxy for Mushroom Battles.

map \$http_upgrade \$mushroom_battles_connection_upgrade {
  default upgrade;
  '' close;
}

upstream mushroom_battles_app {
  server ${UPSTREAM_HOST}:${UPSTREAM_PORT};
  keepalive 32;
}

server {
  listen 80;
  listen [::]:80;
  server_name ${SERVER_NAMES};

  access_log /var/log/nginx/${SITE_NAME}.access.log;
  error_log /var/log/nginx/${SITE_NAME}.error.log warn;

  client_max_body_size 2m;

  location /.well-known/acme-challenge/ {
    root ${ACME_ROOT};
  }

EOF

  if [[ "$TLS_ENABLED" -eq 1 ]]; then
    cat <<'EOF'
  location / {
    return 301 https://$host$request_uri;
  }
}

EOF
    cat <<EOF
server {
  listen 443 ssl;
  listen [::]:443 ssl;
  http2 on;
  server_name ${SERVER_NAMES};

  access_log /var/log/nginx/${SITE_NAME}.access.log;
  error_log /var/log/nginx/${SITE_NAME}.error.log warn;

$(render_tls_settings)

  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

  client_max_body_size 2m;

$(render_proxy_locations)
}
EOF
  else
    render_proxy_locations
    cat <<'EOF'
}
EOF
  fi
}

CONFIG="$(render_config)"
TARGET="${NGINX_AVAILABLE}/${SITE_NAME}"
LINK="${NGINX_ENABLED}/${SITE_NAME}"

if [[ "$INSTALL" -ne 1 ]]; then
  printf '%s\n' "$CONFIG"
  if [[ "$TLS_ENABLED" -ne 1 ]]; then
    cat >&2 <<EOF

TLS is not enabled because cert files were not found or --tls off was used.
After this config is installed and DNS points here, request a certificate:
  sudo certbot certonly --webroot -w ${ACME_ROOT} ${CERTBOT_ARGS}
Then rerun:
  sudo $0 --install --tls on --domain ${DOMAIN}
EOF
  fi
  exit 0
fi

if [[ "$(id -u)" -ne 0 ]]; then
  die "--install must be run as root, e.g. sudo $0 --install"
fi

command -v nginx >/dev/null 2>&1 || die "nginx is not installed or not in PATH"

mkdir -p "$NGINX_AVAILABLE" "$NGINX_ENABLED" "$ACME_ROOT"

if [[ -e "$TARGET" ]]; then
  BACKUP="${TARGET}.bak.$(date +%Y%m%d%H%M%S)"
  cp "$TARGET" "$BACKUP"
  echo "Backed up existing config to $BACKUP"
fi

TMP_FILE="$(mktemp)"
printf '%s\n' "$CONFIG" > "$TMP_FILE"
install -m 0644 "$TMP_FILE" "$TARGET"
rm -f "$TMP_FILE"

ln -sfn "$TARGET" "$LINK"

echo "Wrote $TARGET"
echo "Enabled $LINK"
nginx -t

if [[ "$RELOAD" -eq 1 ]]; then
  if command -v systemctl >/dev/null 2>&1; then
    systemctl reload nginx
  else
    nginx -s reload
  fi
  echo "Reloaded nginx"
else
  echo "Skipped nginx reload because --no-reload was set"
fi

if [[ "$TLS_ENABLED" -ne 1 ]]; then
  cat <<EOF

HTTP config is active. To enable HTTPS after DNS points to this server:
  sudo certbot certonly --webroot -w ${ACME_ROOT} ${CERTBOT_ARGS}
  sudo $0 --install --tls on --domain ${DOMAIN}
EOF
fi
