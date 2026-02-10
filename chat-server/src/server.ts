import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import { env } from './config/env.js';
import { authRoutes } from './auth/auth.routes.js';
import { usersRoutes } from './users/users.routes.js';
import { conversationsRoutes } from './conversations/conv.routes.js';
import { messagesRoutes } from './messages/msg.routes.js';
import { wsRoutes } from './realtime/ws.js';

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: true,
  credentials: true
});

await app.register(jwt, {
  secret: env.JWT_SECRET
});

await app.register(websocket);

await app.register(authRoutes, { prefix: '/auth' });
await app.register(usersRoutes, { prefix: '/users' });
await app.register(conversationsRoutes, { prefix: '/conversations' });
await app.register(messagesRoutes, { prefix: '' });
await app.register(wsRoutes, { prefix: '/ws' });

await app.listen({ host: env.HOST, port: env.PORT });
