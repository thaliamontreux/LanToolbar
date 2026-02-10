#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Run as root" >&2
  exit 1
fi

DOMAIN="${DOMAIN:-chatterbox.pentastarstudios.com}"
PUBLIC_PORT="${PUBLIC_PORT:-90}"
REPO_URL="${REPO_URL:-git@github.com:thaliamontreux/LanToolbar.git}"
APP_DIR="${APP_DIR:-/opt/lan-chat}"
CHAT_DIR="$APP_DIR/chat-server"
ENV_DIR="${ENV_DIR:-/etc/lan-chat}"
ENV_FILE="$ENV_DIR/lan-chat.env"

DB_NAME="${DB_NAME:-lan_chat}"
DB_USER="${DB_USER:-lan_chat}"
DB_PASS="${DB_PASS:-}"

JWT_SECRET="${JWT_SECRET:-}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
ADMIN_DISPLAY_NAME="${ADMIN_DISPLAY_NAME:-Admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"

SELF_SIGNED_TLS="${SELF_SIGNED_TLS:-1}"

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y --no-install-recommends \
  ca-certificates curl git \
  nginx \
  postgresql postgresql-contrib \
  openssl \
  build-essential python3 make g++

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

if ! id -u lan-chat >/dev/null 2>&1; then
  useradd --system --create-home --home-dir "$APP_DIR" --shell /usr/sbin/nologin lan-chat
fi

mkdir -p "$APP_DIR"
chown -R lan-chat:lan-chat "$APP_DIR"

mkdir -p "$ENV_DIR"
chmod 750 "$ENV_DIR"

if [[ ! -d "$APP_DIR/.git" ]]; then
  sudo -u lan-chat git clone "$REPO_URL" "$APP_DIR"
else
  sudo -u lan-chat git -C "$APP_DIR" pull --ff-only
fi

cd "$CHAT_DIR"
sudo -u lan-chat npm ci
sudo -u lan-chat npm run build

if [[ -z "$DB_PASS" ]]; then
  DB_PASS="$(openssl rand -hex 16)"
  echo "Generated DB_PASS=$DB_PASS" >&2
fi

if [[ -z "$JWT_SECRET" ]]; then
  JWT_SECRET="$(openssl rand -hex 32)"
  echo "Generated JWT_SECRET=$JWT_SECRET" >&2
fi

if [[ -z "$ADMIN_PASSWORD" ]]; then
  ADMIN_PASSWORD="$(openssl rand -hex 16)"
  echo "Generated ADMIN_PASSWORD=$ADMIN_PASSWORD" >&2
fi

sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}') THEN
    CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};
  END IF;
END$$;
SQL

sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"

cat > "$ENV_FILE" <<EOF
DATABASE_URL=postgres://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}
JWT_SECRET=${JWT_SECRET}
HOST=127.0.0.1
PORT=3000
ADMIN_USERNAME=${ADMIN_USERNAME}
ADMIN_DISPLAY_NAME=${ADMIN_DISPLAY_NAME}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
EOF
chmod 640 "$ENV_FILE"
chown root:lan-chat "$ENV_FILE" || true

sudo -u lan-chat bash -lc "set -a; source '$ENV_FILE'; set +a; cd '$CHAT_DIR'; npm run migrate; npm run seed"

cp "$CHAT_DIR/deploy/lan-chat.service" /etc/systemd/system/lan-chat.service
systemctl daemon-reload
systemctl enable --now lan-chat

TLS_CERT="/etc/ssl/certs/${DOMAIN}.crt"
TLS_KEY="/etc/ssl/private/${DOMAIN}.key"

if [[ "$SELF_SIGNED_TLS" == "1" ]]; then
  mkdir -p /etc/ssl/private
  if [[ ! -f "$TLS_CERT" || ! -f "$TLS_KEY" ]]; then
    openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
      -keyout "$TLS_KEY" -out "$TLS_CERT" \
      -subj "/CN=${DOMAIN}"
    chmod 600 "$TLS_KEY"
  fi
fi

NGINX_TMP="/etc/nginx/sites-available/lan-chat"
sed -E \
  -e "s/server_name [^;]+;/server_name ${DOMAIN};/g" \
  -e "s/listen [0-9]+( ssl)?;/listen ${PUBLIC_PORT} ssl;/g" \
  -e "s#/etc/ssl/certs/[^ ]+\.crt#${TLS_CERT}#g" \
  -e "s#/etc/ssl/private/[^ ]+\.key#${TLS_KEY}#g" \
  "$CHAT_DIR/deploy/nginx-lan-chat.conf" > "$NGINX_TMP"

ln -sf /etc/nginx/sites-available/lan-chat /etc/nginx/sites-enabled/lan-chat
nginx -t
systemctl reload nginx

echo "OK"
