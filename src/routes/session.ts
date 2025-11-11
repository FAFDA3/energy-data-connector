import { Router } from 'express';
import { z } from 'zod';
import { openSession, revokeToken } from '../services/sessionManager.js';

const router = Router();

const openSchema = z.object({
  pin: z.string().min(4).max(12),
});

router.post('/open', (req, res) => {
  const parseResult = openSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parseResult.error.flatten() });
  }

  const session = openSession(parseResult.data.pin);
  if (!session) {
    return res.status(401).json({ error: 'Invalid PIN' });
  }

  return res.json({
    token: session.token,
    expiresAt: session.expiresAt,
  });
});

router.post('/revoke', (req, res) => {
  const token = req.body?.token;
  if (typeof token !== 'string') {
    return res.status(400).json({ error: 'token is required' });
  }
  revokeToken(token);
  return res.status(204).end();
});

export const sessionRouter = router;
