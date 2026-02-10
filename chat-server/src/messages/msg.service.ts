import { pool } from '../db/index.js';

export async function createMessage(conversationId: string, senderId: string, body: string) {
  const res = await pool.query<{
    id: string;
    conversation_id: string;
    sender_id: string;
    body: string;
    created_at: string;
  }>(
    `
    INSERT INTO messages (conversation_id, sender_id, body)
    VALUES ($1, $2, $3)
    RETURNING id, conversation_id, sender_id, body, created_at;
  `,
    [conversationId, senderId, body]
  );

  const m = res.rows[0];
  return {
    id: m.id,
    conversationId: m.conversation_id,
    senderId: m.sender_id,
    body: m.body,
    createdAt: m.created_at
  };
}

export async function listMessages(conversationId: string, limit: number, before?: string) {
  if (before) {
    const res = await pool.query<{
      id: string;
      conversation_id: string;
      sender_id: string;
      body: string;
      created_at: string;
    }>(
      `
      SELECT id, conversation_id, sender_id, body, created_at
      FROM messages
      WHERE conversation_id = $1 AND created_at < $2
      ORDER BY created_at DESC
      LIMIT $3;
    `,
      [conversationId, before, limit]
    );

    return res.rows
      .map((m) => ({
        id: m.id,
        conversationId: m.conversation_id,
        senderId: m.sender_id,
        body: m.body,
        createdAt: m.created_at
      }))
      .reverse();
  }

  const res = await pool.query<{
    id: string;
    conversation_id: string;
    sender_id: string;
    body: string;
    created_at: string;
  }>(
    `
    SELECT id, conversation_id, sender_id, body, created_at
    FROM messages
    WHERE conversation_id = $1
    ORDER BY created_at DESC
    LIMIT $2;
  `,
    [conversationId, limit]
  );

  return res.rows
    .map((m) => ({
      id: m.id,
      conversationId: m.conversation_id,
      senderId: m.sender_id,
      body: m.body,
      createdAt: m.created_at
    }))
    .reverse();
}

export async function markRead(conversationId: string, userId: string, lastReadMessageId: string) {
  await pool.query(
    `
    UPDATE conversation_participants
    SET last_read_message_id = $1
    WHERE conversation_id = $2 AND user_id = $3
  `,
    [lastReadMessageId, conversationId, userId]
  );
}
