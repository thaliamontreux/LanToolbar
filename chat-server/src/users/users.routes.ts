import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import argon2 from 'argon2';
import { requireAuth } from '../auth/auth.middleware.js';
import { pool } from '../db/index.js';

function requireAdmin(req: any): boolean {
  return req.user?.role === 'admin';
}

export const usersRoutes: FastifyPluginAsync = async (app) => {
  app.get('/me', { preHandler: (req, reply) => requireAuth(app, req, reply) }, async (req: any) => {
    const res = await pool.query<{
      id: string;
      username: string;
      display_name: string;
      role: string;
      is_active: boolean;
      created_at: string;
      last_login_at: string | null;
    }>(
      'SELECT id, username, display_name, role, is_active, created_at, last_login_at FROM users WHERE id = $1',
      [req.user.sub]
    );

    if (!res.rows[0]) return { message: 'not found' };

    const u = res.rows[0];
    return {
      id: u.id,
      username: u.username,
      displayName: u.display_name,
      role: u.role,
      isActive: u.is_active,
      createdAt: u.created_at,
      lastLoginAt: u.last_login_at
    };
  });

  app.get('/', { preHandler: (req, reply) => requireAuth(app, req, reply) }, async () => {
    const res = await pool.query<{
      id: string;
      username: string;
      display_name: string;
      role: string;
      is_active: boolean;
    }>('SELECT id, username, display_name, role, is_active FROM users WHERE is_active = true ORDER BY username');

    return res.rows.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.display_name,
      role: u.role,
      isActive: u.is_active
    }));
  });

  app.post('/', { preHandler: (req, reply) => requireAuth(app, req, reply) }, async (req: any, reply) => {
    if (!requireAdmin(req)) return reply.code(403).send({ message: 'forbidden' });

    const body = z
      .object({
        username: z.string().min(1),
        displayName: z.string().min(1),
        password: z.string().min(8),
        role: z.enum(['admin', 'user']).optional()
      })
      .parse(req.body);

    const passwordHash = await argon2.hash(body.password);

    const res = await pool.query<{
      id: string;
      username: string;
      display_name: string;
      role: string;
      is_active: boolean;
    }>(
      `
      INSERT INTO users (username, display_name, password_hash, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, username, display_name, role, is_active;
    `,
      [body.username, body.displayName, passwordHash, body.role ?? 'user']
    );

    const u = res.rows[0];
    return reply.code(201).send({
      id: u.id,
      username: u.username,
      displayName: u.display_name,
      role: u.role,
      isActive: u.is_active
    });
  });

  app.patch('/:id', { preHandler: (req, reply) => requireAuth(app, req, reply) }, async (req: any, reply) => {
    if (!requireAdmin(req)) return reply.code(403).send({ message: 'forbidden' });

    const params = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z
      .object({
        isActive: z.boolean().optional(),
        displayName: z.string().min(1).optional(),
        password: z.string().min(8).optional()
      })
      .parse(req.body);

    if (body.password) {
      const hash = await argon2.hash(body.password);
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, params.id]);
    }

    if (body.displayName !== undefined) {
      await pool.query('UPDATE users SET display_name = $1 WHERE id = $2', [body.displayName, params.id]);
    }

    if (body.isActive !== undefined) {
      await pool.query('UPDATE users SET is_active = $1 WHERE id = $2', [body.isActive, params.id]);
    }

    return reply.send({ ok: true });
  });
};
