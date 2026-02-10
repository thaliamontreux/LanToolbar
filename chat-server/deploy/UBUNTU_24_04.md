# Ubuntu 24.04 deployment

## Assumptions

- Hostname: `chatterbox.pentastarstudios.com`
- Node server listens on `127.0.0.1:3000`
- Nginx terminates TLS and proxies:
  - `/api/*` -> Node
  - `/ws` -> Node (WebSocket)

## 1) Install system packages

```bash
sudo apt update
sudo apt install -y nginx postgresql postgresql-contrib ca-certificates curl
```

## 2) Install Node.js (recommended: Node 20 LTS)

Use your preferred method (NodeSource, nvm, etc). Confirm:

```bash
node -v
npm -v
```

## 3) Create Linux user + directories

```bash
sudo useradd --system --create-home --home-dir /opt/lan-chat --shell /usr/sbin/nologin lan-chat
sudo mkdir -p /opt/lan-chat
sudo mkdir -p /etc/lan-chat
sudo chown -R lan-chat:lan-chat /opt/lan-chat
sudo chmod 750 /etc/lan-chat
```

## 4) Deploy the app code

On the server, clone your repo and place it at:

`/opt/lan-chat`

Example:

```bash
sudo -u lan-chat git clone git@github.com:thaliamontreux/LanToolbar.git /opt/lan-chat
cd /opt/lan-chat/chat-server
sudo -u lan-chat npm ci
sudo -u lan-chat npm run build
```

## 5) Configure Postgres

Create DB + user:

```bash
sudo -u postgres psql
```

```sql
CREATE DATABASE lan_chat;
CREATE USER lan_chat WITH ENCRYPTED PASSWORD 'CHANGE_ME';
GRANT ALL PRIVILEGES ON DATABASE lan_chat TO lan_chat;
\c lan_chat
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

Set `/etc/lan-chat/lan-chat.env` (copy from `deploy/lan-chat.env.example`).

Then run migrations + seed:

```bash
cd /opt/lan-chat/chat-server
sudo -u lan-chat npm run migrate
sudo -u lan-chat npm run seed
```

## 6) systemd service

Copy unit file:

```bash
sudo cp /opt/lan-chat/chat-server/deploy/lan-chat.service /etc/systemd/system/lan-chat.service
sudo systemctl daemon-reload
sudo systemctl enable --now lan-chat
sudo systemctl status lan-chat
```

Logs:

```bash
journalctl -u lan-chat -f
```

## 7) TLS certificate (LAN)

Use either:

- Your own internal CA and issue a cert for `chat.lan`
- Or a self-signed cert (requires clients to trust it)

Place files at:

- `/etc/ssl/certs/chat.lan.crt`
- `/etc/ssl/private/chat.lan.key`

## 8) Nginx

Copy the Nginx config:

```bash
sudo cp /opt/lan-chat/chat-server/deploy/nginx-lan-chat.conf /etc/nginx/sites-available/lan-chat
sudo ln -sf /etc/nginx/sites-available/lan-chat /etc/nginx/sites-enabled/lan-chat
sudo nginx -t
sudo systemctl reload nginx
```

## 9) Endpoints

- REST base: `https://chatterbox.pentastarstudios.com:90/api/...`
- WebSocket: `wss://chatterbox.pentastarstudios.com:90/ws`

Example login:

`POST https://chatterbox.pentastarstudios.com:90/api/auth/login`
