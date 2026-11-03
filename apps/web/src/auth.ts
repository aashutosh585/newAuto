import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';

const SESSION_COOKIE = 'se_dashboard_session';
const SESSION_SECRET = process.env.SESSION_SECRET || 'fallback-secret-at-least-32-chars-long';

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login requests per windowMs
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export async function verifyDashboardPassword(plainTextPassword: string): Promise<boolean> {
  const hash = process.env.DASHBOARD_PASSWORD_HASH;
  if (!hash) {
    console.warn('[Auth] DASHBOARD_PASSWORD_HASH not configured in environment.');
    return false;
  }
  return await bcrypt.compare(plainTextPassword, hash);
}

export function issueSessionToken(): string {
  return jwt.sign({ authenticated: true, role: 'admin' }, SESSION_SECRET, {
    expiresIn: '7d',
  });
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // Check cookie or Authorization header
  const token = req.cookies?.[SESSION_COOKIE] || req.headers.authorization?.replace(/^Bearer\s+/, '');

  if (!token) {
    res.status(401).json({ error: 'Unauthorized: Session missing' });
    return;
  }

  try {
    const decoded = jwt.verify(token, SESSION_SECRET);
    (req as any).user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized: Session expired or invalid' });
  }
}

export { SESSION_COOKIE };

