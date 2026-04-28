import { Pool } from 'pg';
import { logger } from './logger.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

export const pool = new Pool({
  connectionString: databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
});

pool.on('error', (error) => {
  logger.error('database pool error', { error });
});

function normalizeSql(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

export async function query<T = unknown>(text: string, params?: unknown[]): Promise<T[]> {
  const startedAt = Date.now();
  const sql = normalizeSql(text);
  try {
    const result = await pool.query(text, params as never);
    logger.info('database query succeeded', {
      sql,
      paramCount: params?.length ?? 0,
      rowCount: result.rowCount ?? result.rows.length,
      durationMs: Date.now() - startedAt,
    });
    return result.rows as T[];
  } catch (error) {
    logger.error('database query failed', {
      sql,
      paramCount: params?.length ?? 0,
      durationMs: Date.now() - startedAt,
      error,
    });
    throw error;
  }
}
