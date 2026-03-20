# AGENTS.md

## Cursor Cloud specific instructions

### Overview

This is "Prompts with Friends" — a B2B SaaS starter kit built with Astro 5, React 18, Tailwind CSS, tRPC, and Drizzle ORM (PostgreSQL). It is a single application (not a monorepo).

### Running the dev server

```
SKIP_ENV_VALIDATION=true yarn dev
```

The app runs on `http://localhost:3000`. The `SKIP_ENV_VALIDATION=true` flag bypasses required env var checks for external services (Supabase, PropelAuth, Doppler). Without it, the server will error on startup unless all required env vars are set.

### Lint, type-check, and format

- **Lint:** `yarn lint` (ESLint, zero warnings policy via `--max-warnings 0`)
- **Type-check:** `SKIP_ENV_VALIDATION=true yarn ci:check` (runs `astro check && tsc --noEmit`; needs `SKIP_ENV_VALIDATION=true` because `t3-env.ts` validates env vars at import time)
- **Format:** `yarn fmt` (Prettier)
- **Fix all:** `yarn fix` (lint --fix + Prettier)

### Key caveats

- There are no automated test suites (no test runner configured).
- The project uses Yarn Classic (1.x) — do not use npm or pnpm.
- All scripts in `package.json` that interact with the database are designed to run under `doppler run` for secret injection. In cloud agent environments without Doppler, always prefix with `SKIP_ENV_VALIDATION=true`.
- The `vite-plugin-checker` TypeScript overlay may emit `[ERROR] [vite] Found 0 errors` in the terminal even when there are no errors — this is normal and not a failure.
- The Astro adapter is set to Vercel (`@astrojs/vercel`). For local dev, `astro dev` handles this transparently.
