import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const TEST_DATABASE_URL =
	process.env.TEST_DATABASE_URL ?? 'postgres://testuser:testpass@localhost:54322/testdb';

export function createTestDb() {
	const sql = postgres(TEST_DATABASE_URL, { max: 1 });
	const db = drizzle(sql);
	return { sql, db };
}

export async function migrateTestDb(
	sql: ReturnType<typeof postgres>,
	db: ReturnType<typeof drizzle>
) {
	// service_role is a Supabase-specific role referenced in migration RLS policies
	await sql`DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
	await migrate(db, { migrationsFolder: './src/db' });
}

export async function teardown(sql: ReturnType<typeof postgres>) {
	await sql.end();
}
