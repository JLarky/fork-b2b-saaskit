import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { Context, Layer } from 'effect';
import postgres from 'postgres';

import { serverEnv } from '../t3-env';

export class Database extends Context.Tag('Database')<Database, PostgresJsDatabase>() {}

// Singleton-per-isolate: construct once, reuse across requests.
export const DatabaseLive = Layer.sync(Database, () => drizzle(postgres(serverEnv.DATABASE_URL)));
