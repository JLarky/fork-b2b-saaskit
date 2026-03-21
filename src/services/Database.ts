import { Context, Layer } from 'effect';

import { db } from '../db/db';

export class Database extends Context.Tag('Database')<Database, typeof db>() {}

/** Uses the shared Drizzle instance from `src/db/db.ts` (single DB connection pool). */
export const DatabaseLive = Layer.succeed(Database, db);
