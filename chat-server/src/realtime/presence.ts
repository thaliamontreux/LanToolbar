import type { SocketStream } from '@fastify/websocket';

export type AuthedConnection = {
  userId: string;
  stream: SocketStream;
};

const connectionsByUserId = new Map<string, Set<SocketStream>>();

export function addConnection(userId: string, stream: SocketStream) {
  const set = connectionsByUserId.get(userId) ?? new Set<SocketStream>();
  set.add(stream);
  connectionsByUserId.set(userId, set);
}

export function removeConnection(userId: string, stream: SocketStream) {
  const set = connectionsByUserId.get(userId);
  if (!set) return;
  set.delete(stream);
  if (set.size === 0) connectionsByUserId.delete(userId);
}

export function isOnline(userId: string): boolean {
  return (connectionsByUserId.get(userId)?.size ?? 0) > 0;
}

export function sendToUser(userId: string, payload: unknown) {
  const set = connectionsByUserId.get(userId);
  if (!set) return;
  const data = JSON.stringify(payload);
  for (const s of set) {
    try {
      s.socket.send(data);
    } catch {
      // ignore
    }
  }
}

export function broadcast(payload: unknown) {
  const data = JSON.stringify(payload);
  for (const set of connectionsByUserId.values()) {
    for (const s of set) {
      try {
        s.socket.send(data);
      } catch {
        // ignore
      }
    }
  }
}
