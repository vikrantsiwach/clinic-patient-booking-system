import rateLimit from 'express-rate-limit';

export const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
});

export const otpSendLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => (req.body as Record<string, string>)?.phone || req.ip || '',
  message: { error: 'RATE_LIMITED', message: 'Too many OTP requests. Try again in 10 minutes.' },
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => (req.body as Record<string, string>)?.email || req.ip || '',
  message: { error: 'RATE_LIMITED', message: 'Too many login attempts. Account locked for 15 minutes.' },
});
