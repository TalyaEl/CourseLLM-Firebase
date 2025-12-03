import { Pool } from 'pg';

/**
 * Postgres connection pool for IST event storage.
 * Uses a singleton pattern to reuse connections.
 */

let pool: Pool | null = null;

/**
 * Get or create the Postgres connection pool.
 * Reads connection string from IST_DB_URL environment variable.
 * 
 * @throws Error if IST_DB_URL is not set
 */
export function getPool(): Pool {
  if (!process.env.IST_DB_URL) {
    console.warn('[IST][DB] IST_DB_URL env var is not set');
    throw new Error('IST_DB_URL env var is not set');
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.IST_DB_URL,
      // For Supabase, SSL may be required
      // Uncomment the line below if you encounter SSL errors:
      // ssl: { rejectUnauthorized: false },
    });
    console.log('[IST][DB] Postgres pool initialized');
  }

  return pool;
}

