import { pool } from '../db/index.js';

export async function getOrCreateDmConversation(userAId: string, userBId: string): Promise<string> {
  const low = userAId < userBId ? userAId : userBId;
  const high = userAId < userBId ? userBId : userAId;

  const existing = await pool.query<{ conversation_id: string }>(
    'SELECT conversation_id FROM dm_pairs WHERE user_low = $1 AND user_high = $2',
    [low, high]
  );

  if (existing.rows[0]) return existing.rows[0].conversation_id;

  await pool.query('BEGIN');
  try {
    const conv = await pool.query<{ id: string }>('INSERT INTO conversations (type) VALUES (\'dm\') RETURNING id');
    const conversationId = conv.rows[0].id;

    await pool.query(
      'INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2), ($1, $3)',
      [conversationId, userAId, userBId]
    );

    await pool.query(
      'INSERT INTO dm_pairs (user_low, user_high, conversation_id) VALUES ($1, $2, $3)',
      [low, high, conversationId]
    );

    await pool.query('COMMIT');
    return conversationId;
  } catch (err) {
    await pool.query('ROLLBACK');
    throw err;
  }
}

export async function listUserConversations(userId: string) {
  const res = await pool.query<{
    id: string;
    type: string;
    created_at: string;
    last_message_at: string | null;
    last_message_body: string | null;
    last_message_sender_id: string | null;
  }>(
    `
    SELECT
      c.id,
      c.type,
      c.created_at,
      lm.created_at as last_message_at,
      lm.body as last_message_body,
      lm.sender_id as last_message_sender_id
    FROM conversations c
    JOIN conversation_participants cp ON cp.conversation_id = c.id
    LEFT JOIN LATERAL (
      SELECT m.created_at, m.body, m.sender_id
      FROM messages m
      WHERE m.conversation_id = c.id
      ORDER BY m.created_at DESC
      LIMIT 1
    ) lm ON true
    WHERE cp.user_id = $1
    ORDER BY lm.created_at DESC NULLS LAST, c.created_at DESC;
  `,
    [userId]
  );

  return res.rows.map((r) => ({
    id: r.id,
    type: r.type,
    createdAt: r.created_at,
    lastMessage: r.last_message_at
      ? {
          createdAt: r.last_message_at,
          body: r.last_message_body,
          senderId: r.last_message_sender_id
        }
      : null
  }));
}

export async function isUserInConversation(userId: string, conversationId: string): Promise<boolean> {
  const res = await pool.query('SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2', [
    conversationId,
    userId
  ]);
  return res.rowCount > 0;
}

export async function getOtherParticipantId(conversationId: string, meUserId: string): Promise<string | null> {
  const res = await pool.query<{ user_id: string }>(
    'SELECT user_id FROM conversation_participants WHERE conversation_id = $1 AND user_id <> $2 LIMIT 1',
    [conversationId, meUserId]
  );
  return res.rows[0]?.user_id ?? null;
}
