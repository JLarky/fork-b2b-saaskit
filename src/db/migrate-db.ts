import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

import { dbFolder } from '../../drizzle.config';

/**
 * Apply Drizzle migrations using only a connection URL (no t3-env / full app config).
 * Used by `yarn migrate` and local Postgres test setup.
 */
export async function runMigrations(databaseUrl: string) {
	const sql = postgres(databaseUrl);
	const db = drizzle(sql);
	try {
		await migrate(db, { migrationsFolder: dbFolder });
	} finally {
		await sql.end();
	}
}
