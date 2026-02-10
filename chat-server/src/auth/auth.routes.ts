import type { FastifyPluginAsync } from 'fastify';
import argon2 from 'argon2';
import { z } from 'zod';
import { pool } from '../db/index.js';

const loginBodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/login', async (req, reply) => {
    const body = loginBodySchema.parse(req.body);

    const res = await pool.query<{
      id: string;
      username: string;
      display_name: string;
      password_hash: string;
      role: string;
      is_active: boolean;
    }>(
      'SELECT id, username, display_name, password_hash, role, is_active FROM users WHERE username = $1',
      [body.username]
    );

    const user = res.rows[0];
    if (!user || !user.is_active) {
      return reply.code(401).send({ message: 'invalid credentials' });
    }

    const ok = await argon2.verify(user.password_hash, body.password);
    if (!ok) {
      return reply.code(401).send({ message: 'invalid credentials' });
    }

    await pool.query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);

    const token = await reply.jwtSign({ sub: user.id, username: user.username, role: user.role });

    return reply.send({
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        role: user.role
      }
    });
  });
};
