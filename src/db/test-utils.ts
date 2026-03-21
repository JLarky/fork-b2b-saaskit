import { PGlite } from '@electric-sql/pglite';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { drizzle } from 'drizzle-orm/pglite';

import { dbFolder } from '../../drizzle.config';

/**
 * Drizzle's default migrator runs each SQL chunk via a prepared statement. PGlite
 * rejects chunks that contain several statements (e.g. CREATE TABLE + ALTER + POLICY).
 * The simple-query `exec` path accepts those, so we mirror drizzle's journal logic here.
 */
async function runPgliteMigrations(client: PGlite, migrationsFolder: string) {
	const migrations = readMigrationFiles({ migrationsFolder });
	const migrationsSchema = 'drizzle';
	const migrationsTable = '__drizzle_migrations';

	await client.exec(`CREATE SCHEMA IF NOT EXISTS "${migrationsSchema}"`);
	await client.exec(`
			CREATE TABLE IF NOT EXISTS "${migrationsSchema}"."${migrationsTable}" (
				id SERIAL PRIMARY KEY,
				hash text NOT NULL,
				created_at bigint
			)
		`);

	const dbMigrations = await client.query<{ created_at: string }>(
		`select id, hash, created_at from "${migrationsSchema}"."${migrationsTable}" order by created_at desc limit 1`
	);
	const lastDbMigration = dbMigrations.rows[0];

	await client.transaction(async (tx) => {
		for (const migration of migrations) {
			if (!lastDbMigration || Number(lastDbMigration.created_at) < migration.folderMillis) {
				for (const stmt of migration.sql) {
					const trimmed = stmt.trim();
					if (trimmed.length > 0) {
						await tx.exec(trimmed);
					}
				}
				await tx.query(
					`insert into "${migrationsSchema}"."${migrationsTable}" ("hash", "created_at") values ($1, $2)`,
					[migration.hash, migration.folderMillis]
				);
			}
		}
	});
}

/**
 * In-memory Postgres (PGlite) for tests—no Docker or network Postgres required.
 * Applies the same Drizzle migrations as production; `service_role` exists because
 * migration SQL references Supabase’s role.
 */
export async function createTestDatabase() {
	const client = new PGlite();
	await client.waitReady;
	await client.exec('CREATE ROLE service_role NOLOGIN');
	await runPgliteMigrations(client, dbFolder);
	const db = drizzle(client);
	return {
		db,
		client,
		async close() {
			await client.close();
		},
	};
}
