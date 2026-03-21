// funny story: if you put this file to src/db/migrate.ts it will be running during
// `drizzle-kit generate` but moving it to src/db/scripts seems to fix the issue
import { runMigrations } from '../migrate-db';

const url = process.env.DATABASE_URL;
if (!url) {
	console.error('DATABASE_URL is required');
	process.exit(1);
}

console.log('Migrating database using migrations in ./src/db');

runMigrations(url)
	.then(() => {
		console.log('Migrations complete!');
		process.exit(0);
	})
	.catch((err) => {
		console.error('Migrations failed!', err);
		process.exit(1);
	});
