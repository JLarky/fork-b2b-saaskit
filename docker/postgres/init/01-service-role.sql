-- Migrations enable RLS policies for Supabase's `service_role`. Stock Postgres has no such role;
-- create a placeholder so Drizzle migrations apply cleanly against local Docker Postgres.
CREATE ROLE service_role NOLOGIN;
