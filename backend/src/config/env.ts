import 'dotenv/config';

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3001'),

  // Database
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/clinic_db',

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-in-production-must-be-32-chars-min',
  JWT_EXPIRY: process.env.JWT_EXPIRY || '24h',
  BCRYPT_COST: parseInt(process.env.BCRYPT_COST || '12'),

  // CORS
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',

  // SMS — mock in dev, real MSG91 in prod
  SMS_MOCK: process.env.SMS_MOCK !== 'false', // true by default in dev
  MSG91_AUTH_KEY: process.env.MSG91_AUTH_KEY || 'DEMO_KEY',
  MSG91_SENDER_ID: process.env.MSG91_SENDER_ID || 'CLINIC',
  MSG91_WEBHOOK_SECRET: process.env.MSG91_WEBHOOK_SECRET || 'demo-webhook-secret',
  MSG91_MISSED_CALL_VMN: process.env.MSG91_MISSED_CALL_VMN || '+910000000000',

  // Business rules
  CANCELLATION_WINDOW_HOURS: parseInt(process.env.CANCELLATION_WINDOW_HOURS || '2'),
  OTP_EXPIRY_MINUTES: parseInt(process.env.OTP_EXPIRY_MINUTES || '10'),
  OTP_MAX_ATTEMPTS: parseInt(process.env.OTP_MAX_ATTEMPTS || '5'),
  OTP_MAX_SENDS_PER_WINDOW: parseInt(process.env.OTP_MAX_SENDS_PER_WINDOW || '3'),

  // Admin
  ADMIN_ALERT_PHONE: process.env.ADMIN_ALERT_PHONE || '',
};

export default env;
