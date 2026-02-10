# LAN Chat Server

## Setup

1. Copy env

```bash
cp .env.example .env
```

2. Start Postgres (optional)

```bash
docker compose up -d
```

3. Install deps

```bash
npm install
```

4. Run migrations + seed admin

```bash
npm run migrate
npm run seed
```

5. Start server

```bash
npm run dev
```

## API

- `POST /auth/login` -> `{ token, user }`
- `GET /users/me`
- `GET /users`
- `POST /users` (admin)
- `PATCH /users/:id` (admin)
- `GET /conversations`
- `POST /conversations/dm`
- `GET /conversations/:id/messages`
- `POST /conversations/:id/messages`
- `POST /conversations/:id/read`

## WebSocket

- Connect to `ws://HOST:PORT/ws`
- First message: `{ "type": "auth", "token": "..." }`
