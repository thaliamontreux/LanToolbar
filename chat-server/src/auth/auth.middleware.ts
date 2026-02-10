import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export async function requireAuth(app: FastifyInstance, req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify();
  } catch {
    return reply.code(401).send({ message: 'unauthorized' });
  }
}
