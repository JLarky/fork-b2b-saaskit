import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { dbFolder } from '../../drizzle.config';

const defaultTestDatabaseUrl =
	'postgresql://postgres:postgres@127.0.0.1:54321/b2bsaaskit_test';

export function getTestDatabaseUrl() {
	return process.env.TEST_DATABASE_URL ?? defaultTestDatabaseUrl;
}

/**
 * Open a pooled connection, run migrations, and return a Drizzle client for tests.
 * Caller must call `close()` when finished.
 */
export async function createTestDatabase() {
	const url = getTestDatabaseUrl();
	const sql = postgres(url);
	const db = drizzle(sql);
	await migrate(db, { migrationsFolder: dbFolder });
	return {
		db,
		sql,
		async close() {
			await sql.end();
		},
	};
}
