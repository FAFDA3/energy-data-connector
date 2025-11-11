import { randomUUID } from 'crypto';
import { loadConfig } from '../config/index.js';

export type Session = {
  token: string;
  createdAt: number;
  expiresAt: number;
};

const sessions = new Map<string, Session>();
const config = loadConfig();

export function openSession(pin: string): Session | null {
  if (config.connector.sessionPin && config.connector.sessionPin !== pin) {
    return null;
  }

  const now = Date.now();
  const token = randomUUID();
  const session: Session = {
    token,
    createdAt: now,
    expiresAt: now + config.connector.sessionTtlSeconds * 1000,
  };
  sessions.set(token, session);
  return session;
}

export function validateToken(token?: string): Session | null {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session;
}

export function revokeToken(token: string): void {
  sessions.delete(token);
}

export function purgeExpiredSessions(): void {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt < now) {
      sessions.delete(token);
    }
  }
}
