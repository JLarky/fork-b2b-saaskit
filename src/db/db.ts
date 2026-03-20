import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { ENV } from 'varlock/env';

export const sql = postgres(ENV.DATABASE_URL);

export const db = drizzle(sql);
