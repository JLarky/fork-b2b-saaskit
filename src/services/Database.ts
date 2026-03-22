import { Context, Layer } from 'effect';

import { db } from '../db/db';

export type DatabaseClient = typeof db;

export class Database extends Context.Tag('Database')<Database, DatabaseClient>() {}

export const DatabaseLive = Layer.succeed(Database, db);

export const DatabaseTest = (database: DatabaseClient) => Layer.succeed(Database, database);
