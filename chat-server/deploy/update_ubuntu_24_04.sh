#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Run as root" >&2
  exit 1
fi

APP_DIR="${APP_DIR:-/opt/lan-chat}"
CHAT_DIR="$APP_DIR/chat-server"
ENV_FILE="${ENV_FILE:-/etc/lan-chat/lan-chat.env}"

if [[ ! -d "$APP_DIR/.git" ]]; then
  echo "Repo not found at $APP_DIR" >&2
  exit 1
fi

sudo -u lan-chat git -C "$APP_DIR" pull --ff-only

cd "$CHAT_DIR"
sudo -u lan-chat npm ci
sudo -u lan-chat npm run build

sudo -u lan-chat bash -lc "set -a; source '$ENV_FILE'; set +a; cd '$CHAT_DIR'; npm run migrate"

systemctl restart lan-chat

echo "OK"
