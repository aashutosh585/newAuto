import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

export const SESSION_COOKIE_NAME = 'se_admin_session';
const SESSION_SECRET = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || 'fallback-secret-at-least-32-chars-long';

export async function verifyMasterPassword(inputPassword: string): Promise<boolean> {
  const adminPassword = process.env.ADMIN_PASSWORD || process.env.DASHBOARD_PASSWORD;
  const hash = process.env.DASHBOARD_PASSWORD_HASH;

  // 1. Direct match with .env plain text password (easy, zero-config for personal use)
  if (adminPassword && inputPassword === adminPassword) {
    return true;
  }

  // 2. Fallback to bcrypt hash check if provided
  if (hash) {
    try {
      const match = await bcrypt.compare(inputPassword, hash);
      if (match) return true;
    } catch {
      // ignore
    }
  }

  return false;
}

export function createSessionToken(): string {
  return jwt.sign({ role: 'admin', authTime: Date.now() }, SESSION_SECRET, {
    expiresIn: '30d',
  });
}

export function verifySessionToken(token: string): boolean {
  try {
    jwt.verify(token, SESSION_SECRET);
    return true;
  } catch {
    return false;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return false;
  return verifySessionToken(token);
}

