import crypto from 'crypto';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import env from '../config/env';

export const hmacVerify: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  // In mock mode, skip verification
  if (env.SMS_MOCK) { next(); return; }

  const signature = req.headers['x-msg91-signature'] || req.headers['x-webhook-signature'];
  if (!signature) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing webhook signature' });
    return;
  }

  const body = JSON.stringify(req.body);
  const expected = crypto
    .createHmac('sha256', env.MSG91_WEBHOOK_SECRET)
    .update(body)
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signature as string), Buffer.from(expected))) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid webhook signature' });
    return;
  }

  next();
};
