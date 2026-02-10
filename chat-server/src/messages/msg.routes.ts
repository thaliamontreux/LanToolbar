import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth/auth.middleware.js';
import { isUserInConversation } from '../conversations/conv.service.js';
import { createMessage, listMessages, markRead } from './msg.service.js';

export const messagesRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/conversations/:id/messages',
    { preHandler: (req, reply) => requireAuth(app, req, reply) },
    async (req: any, reply) => {
      const params = z.object({ id: z.string().uuid() }).parse(req.params);
      const query = z
        .object({
          limit: z.coerce.number().int().positive().max(200).default(50),
          before: z.string().optional()
        })
        .parse(req.query);

      const ok = await isUserInConversation(req.user.sub, params.id);
      if (!ok) return reply.code(403).send({ message: 'forbidden' });

      return await listMessages(params.id, query.limit, query.before);
    }
  );

  app.post(
    '/conversations/:id/messages',
    { preHandler: (req, reply) => requireAuth(app, req, reply) },
    async (req: any, reply) => {
      const params = z.object({ id: z.string().uuid() }).parse(req.params);
      const body = z.object({ body: z.string().min(1).max(5000) }).parse(req.body);

      const ok = await isUserInConversation(req.user.sub, params.id);
      if (!ok) return reply.code(403).send({ message: 'forbidden' });

      const message = await createMessage(params.id, req.user.sub, body.body);
      return reply.code(201).send({ message });
    }
  );

  app.post(
    '/conversations/:id/read',
    { preHandler: (req, reply) => requireAuth(app, req, reply) },
    async (req: any, reply) => {
      const params = z.object({ id: z.string().uuid() }).parse(req.params);
      const body = z.object({ lastReadMessageId: z.string().uuid() }).parse(req.body);

      const ok = await isUserInConversation(req.user.sub, params.id);
      if (!ok) return reply.code(403).send({ message: 'forbidden' });

      await markRead(params.id, req.user.sub, body.lastReadMessageId);
      return reply.send({ ok: true });
    }
  );
};
