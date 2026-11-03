import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import { requireAuth, verifyDashboardPassword, issueSessionToken, loginLimiter, SESSION_COOKIE } from './auth.js';
import { handleCronRun } from './cron.js';
import { handleZernioWebhook } from './webhooks.js';
import { apiRouter } from './api.js';
import { renderDashboardHtml, renderLoginHtml } from './dashboard.js';

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.SESSION_SECRET || 'secret-salt'));

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'social-engine-web', timestamp: new Date().toISOString() });
});

// 1. Secured Cron Endpoint: POST /api/run?slot=X
app.post('/api/run', handleCronRun);
app.get('/api/run', handleCronRun); // allow easy webhook GET triggers if needed

// 2. Zernio Webhooks: POST /api/webhooks/zernio
app.post('/api/webhooks/zernio', handleZernioWebhook);

// 3. Authentication: Login / Logout
app.get('/login', (req: Request, res: Response) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) {
    res.redirect('/');
    return;
  }
  res.send(renderLoginHtml());
});

app.post('/login', loginLimiter, async (req: Request, res: Response) => {
  const password = req.body.password;
  if (!password) {
    res.status(400).send(renderLoginHtml('Password is required'));
    return;
  }

  const isValid = await verifyDashboardPassword(password);
  if (!isValid) {
    res.status(401).send(renderLoginHtml('Invalid password. Access denied.'));
    return;
  }

  const token = issueSessionToken();
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res.redirect('/');
});

app.post('/logout', (req: Request, res: Response) => {
  res.clearCookie(SESSION_COOKIE);
  res.redirect('/login');
});

// 4. Protected Dashboard APIs
app.use('/api', requireAuth, apiRouter);

// 5. Protected Dashboard Root View
app.get('/', (req: Request, res: Response) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) {
    res.redirect('/login');
    return;
  }
  res.send(renderDashboardHtml());
});

app.listen(port, '0.0.0.0', () => {
  console.log(`[Web] Social Engine Web Server listening on http://0.0.0.0:${port}`);
  console.log(`[Web] Cron endpoint: POST /api/run?slot=X`);
  console.log(`[Web] Webhook endpoint: POST /api/webhooks/zernio`);
  console.log(`[Web] Dashboard: http://localhost:${port}/`);
});

