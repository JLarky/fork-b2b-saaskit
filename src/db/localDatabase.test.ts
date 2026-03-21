import { eq, sql as drizzleSql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { dbFolder } from '../../drizzle.config';

type DbModule = typeof import('./db');
type SchemaModule = typeof import('./schema');

const localDatabaseUrl =
	process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/b2bsaaskit';

process.env.DATABASE_URL = localDatabaseUrl;
process.env.PROPELAUTH_API_KEY ??= 'local-db-smoke-test';
process.env.PROPELAUTH_VERIFIER_KEY ??= 'local-db-smoke-test';
process.env.PUBLIC_AUTH_URL ??= 'http://localhost:3000';

const testLimitId = 'local-db-smoke-test';

let db: DbModule['db'];
let sql: DbModule['sql'];
let sharedKeyRatelimit: SchemaModule['sharedKeyRatelimit'];

async function clearTestRow() {
	await db.delete(sharedKeyRatelimit).where(eq(sharedKeyRatelimit.limitId, testLimitId));
}

beforeAll(async () => {
	const dbModule = await import('./db');
	const schemaModule = await import('./schema');

	db = dbModule.db;
	sql = dbModule.sql;
	sharedKeyRatelimit = schemaModule.sharedKeyRatelimit;

	try {
		await db.execute(drizzleSql`select 1`);
	} catch (error) {
		throw new Error(
			`Local Postgres is not reachable at ${localDatabaseUrl}. Start it with "yarn db:local:up".`,
			{ cause: error as Error }
		);
	}

	await migrate(db, { migrationsFolder: dbFolder });
	await clearTestRow();
});

afterAll(async () => {
	if (db && sharedKeyRatelimit) {
		await clearTestRow();
	}

	if (sql) {
		await sql.end({ timeout: 5 });
	}
});

describe('local database smoke test', () => {
	it('applies migrations and persists a read/write cycle', async () => {
		const initialRows = await db
			.select({ value: sharedKeyRatelimit.value })
			.from(sharedKeyRatelimit)
			.where(eq(sharedKeyRatelimit.limitId, testLimitId));

		expect(initialRows).toEqual([]);

		const insertResult = await db
			.insert(sharedKeyRatelimit)
			.values({
				limitId: testLimitId,
				value: 1,
			})
			.onConflictDoUpdate({
				target: sharedKeyRatelimit.limitId,
				set: {
					value: drizzleSql`${sharedKeyRatelimit.value} + 1`,
				},
			})
			.returning({ value: sharedKeyRatelimit.value });

		expect(insertResult[0]?.value).toBe(1);

		const updateResult = await db
			.insert(sharedKeyRatelimit)
			.values({
				limitId: testLimitId,
				value: 1,
			})
			.onConflictDoUpdate({
				target: sharedKeyRatelimit.limitId,
				set: {
					value: drizzleSql`${sharedKeyRatelimit.value} + 1`,
				},
			})
			.returning({ value: sharedKeyRatelimit.value });

		expect(updateResult[0]?.value).toBe(2);

		const persistedRows = await db
			.select({ value: sharedKeyRatelimit.value })
			.from(sharedKeyRatelimit)
			.where(eq(sharedKeyRatelimit.limitId, testLimitId));

		expect(persistedRows).toEqual([{ value: 2 }]);
	});
});
