import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/index.js';
import { getOrCreateDmConversation, getOtherParticipantId, isUserInConversation } from '../conversations/conv.service.js';
import { createMessage, markRead } from '../messages/msg.service.js';
import { addConnection, broadcast, removeConnection, sendToUser } from './presence.js';

type ClientMsg =
  | { type: 'auth'; token: string }
  | { type: 'message.send'; toUserId: string; body: string }
  | { type: 'message.read'; conversationId: string; lastReadMessageId: string }
  | { type: 'typing'; conversationId: string; isTyping: boolean }
  | { type: 'ping'; t: number };

export const wsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', { websocket: true }, (stream) => {
    let authedUserId: string | null = null;

    function send(payload: unknown) {
      stream.socket.send(JSON.stringify(payload));
    }

    stream.socket.on('message', async (raw) => {
      let msg: ClientMsg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (!authedUserId) {
        if (msg.type !== 'auth') {
          send({ type: 'auth.error', message: 'expected auth' });
          stream.socket.close();
          return;
        }

        try {
          const payload: any = await app.jwt.verify(msg.token);
          authedUserId = payload.sub;

          const res = await pool.query<{ id: string; username: string; display_name: string; role: string }>(
            'SELECT id, username, display_name, role FROM users WHERE id = $1',
            [authedUserId]
          );

          const user = res.rows[0];
          if (!user) {
            send({ type: 'auth.error', message: 'invalid token' });
            stream.socket.close();
            return;
          }

          addConnection(authedUserId, stream);
          send({
            type: 'auth.ok',
            user: { id: user.id, username: user.username, displayName: user.display_name, role: user.role }
          });
          broadcast({ type: 'presence', userId: authedUserId, status: 'online' });
        } catch {
          send({ type: 'auth.error', message: 'invalid token' });
          stream.socket.close();
        }

        return;
      }

      if (msg.type === 'ping') {
        send({ type: 'pong', t: msg.t });
        return;
      }

      if (msg.type === 'message.send') {
        const parsed = z
          .object({ type: z.literal('message.send'), toUserId: z.string().uuid(), body: z.string().min(1).max(5000) })
          .parse(msg);

        const conversationId = await getOrCreateDmConversation(authedUserId, parsed.toUserId);
        const message = await createMessage(conversationId, authedUserId, parsed.body);

        // Echo to sender + deliver to recipient.
        send({ type: 'message.new', message });
        sendToUser(parsed.toUserId, { type: 'message.new', message });
        return;
      }

      if (msg.type === 'message.read') {
        const parsed = z
          .object({
            type: z.literal('message.read'),
            conversationId: z.string().uuid(),
            lastReadMessageId: z.string().uuid()
          })
          .parse(msg);

        const ok = await isUserInConversation(authedUserId, parsed.conversationId);
        if (!ok) return;

        await markRead(parsed.conversationId, authedUserId, parsed.lastReadMessageId);
        const otherId = await getOtherParticipantId(parsed.conversationId, authedUserId);
        if (otherId) {
          sendToUser(otherId, {
            type: 'message.read',
            conversationId: parsed.conversationId,
            userId: authedUserId,
            lastReadMessageId: parsed.lastReadMessageId
          });
        }
        return;
      }

      if (msg.type === 'typing') {
        const parsed = z
          .object({ type: z.literal('typing'), conversationId: z.string().uuid(), isTyping: z.boolean() })
          .parse(msg);

        const ok = await isUserInConversation(authedUserId, parsed.conversationId);
        if (!ok) return;

        const otherId = await getOtherParticipantId(parsed.conversationId, authedUserId);
        if (!otherId) return;

        sendToUser(otherId, {
          type: 'typing',
          conversationId: parsed.conversationId,
          userId: authedUserId,
          isTyping: parsed.isTyping
        });
        return;
      }
    });

    stream.socket.on('close', () => {
      if (!authedUserId) return;
      removeConnection(authedUserId, stream);
      broadcast({ type: 'presence', userId: authedUserId, status: 'offline' });
    });
  });
};
