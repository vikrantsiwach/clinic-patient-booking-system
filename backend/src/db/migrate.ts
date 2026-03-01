import 'dotenv/config';
import { Pool, PoolClient } from 'pg';
import fs from 'fs';
import path from 'path';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/clinic_db',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const MIGRATIONS_DIR = path.join(__dirname, '../../../database/migrations');
const SEEDS_DIR = path.join(__dirname, '../../../database/seeds');

async function ensureMigrationsTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      ran_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

async function hasRun(client: PoolClient, filename: string): Promise<boolean> {
  const { rows } = await client.query(
    'SELECT 1 FROM schema_migrations WHERE filename = $1', [filename]
  );
  return rows.length > 0;
}

async function markRun(client: PoolClient, filename: string): Promise<void> {
  await client.query(
    'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING', [filename]
  );
}

async function runMigrations(client: PoolClient): Promise<void> {
  console.log('\n🗄️  Running migrations…');
  const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
  let count = 0;
  for (const file of files) {
    if (await hasRun(client, file)) {
      console.log(`  ↩ ${file} (already applied)`);
      continue;
    }
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    await client.query(sql);
    await markRun(client, file);
    console.log(`  ✓ ${file}`);
    count++;
  }
  if (count === 0) console.log('  (no new migrations)');
}

async function runSeeds(client: PoolClient): Promise<void> {
  console.log('\n🌱 Running seeds…');
  const files = fs.readdirSync(SEEDS_DIR).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(SEEDS_DIR, file), 'utf8');
    await client.query(sql);
    console.log(`  ✓ ${file}`);
  }
}

async function main(): Promise<void> {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    await runMigrations(client);
    await runSeeds(client);

    console.log('\n✅ Database ready!\n');
    console.log('Default login credentials:');
    console.log('  Admin:        admin@clinic.local      / Admin@2026');
    console.log('  Doctor:       doctor@clinic.local     / Admin@2026');
    console.log('  Receptionist: reception@clinic.local  / Admin@2026\n');
  } catch (err) {
    console.error('\nMigration failed:', (err as Error).message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
