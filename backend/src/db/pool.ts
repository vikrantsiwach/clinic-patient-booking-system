import { Pool, PoolClient, QueryResult } from 'pg';
import env from '../config/env';

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err: Error) => {
  console.error('Unexpected DB pool error:', err.message);
});

const query = <T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> => pool.query<T>(text, params);

const transaction = async <T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export { pool, query, transaction };
