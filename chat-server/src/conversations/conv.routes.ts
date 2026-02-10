import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth/auth.middleware.js';
import { getOrCreateDmConversation, listUserConversations } from './conv.service.js';

export const conversationsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', { preHandler: (req, reply) => requireAuth(app, req, reply) }, async (req: any) => {
    return await listUserConversations(req.user.sub);
  });

  app.post('/dm', { preHandler: (req, reply) => requireAuth(app, req, reply) }, async (req: any) => {
    const body = z.object({ userId: z.string().uuid() }).parse(req.body);
    const conversationId = await getOrCreateDmConversation(req.user.sub, body.userId);
    return { id: conversationId };
  });
};
