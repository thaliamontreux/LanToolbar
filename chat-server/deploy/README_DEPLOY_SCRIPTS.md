# Deploy scripts

## install_ubuntu_24_04.sh

Copies code into `/opt/lan-chat`, installs packages, installs Node.js 20, configures Postgres, builds the app, runs migrations/seed, configures systemd + nginx.

Run as root:

```bash
sudo bash install_ubuntu_24_04.sh
```

Optional environment variables:

- `DOMAIN` (default: `chatterbox.pentastarstudios.com`)
- `PUBLIC_PORT` (default: `90`)
- `REPO_URL` (default: `git@github.com:thaliamontreux/LanToolbar.git`)
- `DB_NAME` (default: `lan_chat`)
- `DB_USER` (default: `lan_chat`)
- `DB_PASS` (generated if empty)
- `JWT_SECRET` (generated if empty)
- `ADMIN_PASSWORD` (generated if empty)
- `SELF_SIGNED_TLS` (default: `1`)

## update_ubuntu_24_04.sh

Pulls latest code, rebuilds, runs migrations, restarts systemd service.

```bash
sudo bash update_ubuntu_24_04.sh
```
