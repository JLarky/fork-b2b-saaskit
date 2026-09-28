---
title: 'Postgres database with Supabase'
needsEnv: ['DATABASE_URL']
---

Supabase (<a href="https://supabase.com" >https://supabase.com</a>) is an open source Firebase alternative, providing services like authentication, managed database, storage, functions, etc. In this project, we'll only use Supabase for its managed Postgres database service.

Supabase is free for 2 lightweight projects.

1. Create an account on <a href="https://supabase.com" >Supabase</a>, then:

- Create a new project named "b2b localhost"
- Click on "generate a password" link under "Database Password"
- Open a fresh editor buffer and paste the password there
- Click "Create new project" - this can take a few minutes to complete

2. Click on <a href="https://app.supabase.com/project/_/settings/database" >"Project Settings" - "Database"</a>, navigate to "Connection string" and copy the URI (it will look something like `postgresql://postgres.xxxxxxxxxxxxxxxxxxxx:[YOUR-PASSWORD]@aws-0-xx-xxxx-x.pooler.supabase.com:6543/postgres`)

3. Paste the URI to the editor buffer from step 1, replace `[YOUR-PASSWORD]` with your password, then copy the resulting string

4. Run `doppler secrets set DATABASE_URL` and set it the string from step 3

5. Run `doppler run pnpm migrate` to initialize the database. You should see your new tables in the <a href="https://app.supabase.com/project/_/editor" >Supabase table editor</a>

6. Restart `doppler run pnpm dev` to move to the next section of the tutorial

#### Restoring from a backup

The numbered steps above are a **fresh start**: new project, save `DATABASE_URL`, run migrations. If you are bringing back a paused project's data, restore into a new project instead of starting from those steps.

A project paused for more than a year cannot be unpaused from the dashboard. There is no Restore button — only **Download backups** / **Export your data**. Restore that backup into a new project, or restore it locally.

The database backup is not the whole project. Manual restore:

1. Create a new Supabase project (the free tier is still limited to 2 projects)
2. Download the backup from the paused project
3. Restore with `psql` locally (`psql` 16+)
4. Migrate storage objects separately with Supabase's Google Colab script
5. Recreate by hand (not in the DB backup): Edge Functions, Auth settings, API keys, Realtime settings, extensions, and read replicas

Then set `DATABASE_URL` on the new project the same way as step 4 above. If the backup already has this kit's tables, skip `pnpm migrate`.

Official docs: <a href="https://supabase.com/docs/guides/platform/migrating-within-supabase/dashboard-restore" >Restore Dashboard backup</a>
