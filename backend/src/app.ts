import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import env from './config/env';
import routes from './routes/index';

const app = express();

// Security headers
app.use(helmet());

// CORS
app.use(cors({
  origin: env.FRONTEND_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-msg91-signature', 'x-webhook-signature'],
}));

// Body parsing
app.use(express.json({ limit: '1mb' }));

// Health check
app.get('/health', (_req: Request, res: Response) => res.json({ status: 'ok', env: env.NODE_ENV }));

// API routes
app.use('/api', routes);

// 404
app.use((req: Request, res: Response) => res.status(404).json({ error: 'NOT_FOUND', path: req.path }));

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

export default app;
