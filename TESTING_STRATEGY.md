# Testing Strategy for B2B SaaS Kit

This document outlines a practical, layered testing strategy for the B2B SaaS Kit
given its heavy reliance on third-party SaaS products.

---

## Current State

| Metric | Value |
|--------|-------|
| Test files | 1 (`src/lib/publicUserInfo.test.ts`) |
| Test framework | Vitest 3, Node environment |
| External service mocks | None |
| Integration / E2E tests | None |
| CI test coverage | Unit tests only (`yarn test`) |

The codebase directly imports service clients at module scope (PropelAuth, Stripe,
PostgreSQL, PostHog, OpenAI) with no dependency injection, making services difficult
to swap for test doubles without `vi.mock`.

---

## Third-Party SaaS Dependency Map

| Service | Type | Used In | Testability Risk |
|---------|------|---------|-----------------|
| **PostgreSQL (Supabase)** | Required | All tRPC routers, schema, migrations | High — every mutation/query hits the DB |
| **PropelAuth** | Required | Auth middleware, token validation, user metadata | High — gates every authenticated endpoint |
| **Stripe** | Optional | Checkout, subscriptions, billing portal | Medium — used in settings and rate-limit bypass |
| **OpenAI** | Optional | `runPrompt` mutation (raw `fetch`) | Medium — single endpoint, expensive calls |
| **PostHog** | Optional | Analytics events in prompts router | Low — fire-and-forget, no return value used |
| **Fogbender** | Optional | Support widget, JWT signing | Low — isolated to one API route |
| **Google Fonts** | Optional | OG image generation | Low — only affects image rendering |

---

## Recommended Testing Layers

### Layer 1: Pure Unit Tests (no external services)

**Goal:** Cover all logic that can be tested without any service dependency.

**What to test:**
- `publicUserInfo` / `usersToPublicUserInfo` (already covered)
- `checkAccessToPrompt` — extract from `prompts.ts` and export; test all privacy-level × user combinations
- `rateLimitSharedKeyId` / `rateLimitSharedKeyResetsAt` — extract and test time-bucket logic
- `getStripeConfig` — test with/without env vars
- Zod schemas (`messageSchema`, `privacyLevelSchema`) — validate edge cases
- `canOnlyChangeOwnKey` in `settings.ts`
- Cookie parsing logic in `apiProcedure`

**How:** Standard Vitest with no mocking. Extract pure functions from router files and export
them from separate modules.

**Example — extracting `checkAccessToPrompt`:**

```ts
// src/lib/access.ts
export function checkAccessToPrompt(
  prompt: { privacyLevel: PrivacyLevel; userId: string; orgId: string },
  user: { userId: string; orgIdToOrgMemberInfo?: Record<string, unknown> } | undefined
): undefined | 'UNAUTHORIZED' | 'FORBIDDEN' { ... }
```

```ts
// src/lib/access.test.ts
describe('checkAccessToPrompt', () => {
  it('allows anyone to access public prompts', () => { ... });
  it('requires login for private prompts', () => { ... });
  it('restricts team prompts to org members', () => { ... });
  // etc.
});
```

### Layer 2: Service-Mocked Unit Tests (vi.mock)

**Goal:** Test tRPC router logic end-to-end within a single procedure, replacing
every external service with Vitest mocks.

**What to mock:**
| Module | Mock Strategy |
|--------|---------------|
| `src/db/db.ts` | `vi.mock` — return a fake `db` object with chainable Drizzle-like methods |
| `src/lib/propelauth.ts` | `vi.mock` — return stubs for `validateAccessTokenAndGetUser`, `fetchBatchUserMetadataByUserIds` |
| `src/lib/stripe.ts` | `vi.mock` — return stubs for `openStripe`, `getStripeConfig`, `searchSubscriptionsByOrgId` |
| `src/lib/posthog.ts` | `vi.mock` — make `trackEvent` a no-op |
| `src/t3-env.ts` | `vi.mock` — provide controlled env values, or use `SKIP_ENV_VALIDATION=true` |
| `global.fetch` | `vi.stubGlobal('fetch', ...)` — intercept OpenAI calls |

**How:** Use tRPC's `createCaller` (already exported from `src/lib/trpc/root.ts`)
to invoke procedures in-process.

**Example — testing `getPrompt`:**

```ts
// src/lib/trpc/routers/prompts.test.ts
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../../db/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([{ /* fake prompt row */ }]),
  },
}));

vi.mock('../../propelauth', () => ({
  propelauth: {
    validateAccessTokenAndGetUser: vi.fn().mockResolvedValue({ userId: 'u1', orgIdToOrgMemberInfo: {} }),
    fetchBatchUserMetadataByUserIds: vi.fn().mockResolvedValue({ u1: { userId: 'u1', username: 'tester' } }),
  },
}));

vi.mock('../../posthog', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('../../stripe', () => ({
  getStripeConfig: vi.fn().mockReturnValue(undefined),
  searchSubscriptionsByOrgId: vi.fn().mockResolvedValue([]),
  openStripe: vi.fn(),
}));

// Then use createCaller to invoke procedures
```

**Why `vi.mock` rather than DI?** The codebase uses direct top-level imports
(e.g., `export const propelauth = initBaseAuth(...)`) which run at import time.
Full DI would require a significant refactor. `vi.mock` is the pragmatic approach
that matches the existing architecture.

### Layer 3: Database Integration Tests (real Postgres, mocked SaaS)

**Goal:** Validate that Drizzle queries, transactions, and migrations work correctly
against a real PostgreSQL instance.

**Setup:**
1. Use a local PostgreSQL via Docker (or a lightweight test container library
   like `testcontainers`).
2. Run Drizzle migrations before each test suite.
3. Mock all non-DB services (PropelAuth, Stripe, PostHog, OpenAI) with `vi.mock`.
4. Seed minimal test data using Drizzle's `db.insert(...)`.

**What to test:**
- CRUD operations on `prompts`, `promptLikes`, `gptKeys`, `sharedKeyRatelimit`
- Transaction behavior in `createKey` / `deleteKey`
- Rate-limit upsert logic (`rateLimitUpsert`)
- Privacy-level filtering in `getPrompts`
- Conflict handling (`onConflictDoNothing`, `onConflictDoUpdate`)

**Docker Compose snippet for test DB:**

```yaml
# docker-compose.test.yml
services:
  test-db:
    image: postgres:15
    environment:
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
      POSTGRES_DB: b2bsaaskit_test
    ports:
      - "5433:5432"
```

**CI integration:**

```yaml
# .github/workflows/test.yml — add a service container
services:
  postgres:
    image: postgres:15
    env:
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
      POSTGRES_DB: b2bsaaskit_test
    ports:
      - 5433:5432
    options: >-
      --health-cmd pg_isready
      --health-interval 5s
      --health-timeout 5s
      --health-retries 5
```

### Layer 4: Contract Tests for SaaS APIs

**Goal:** Verify that the app's assumptions about third-party API shapes remain
valid, without calling the real services in CI.

**Approach — MSW (Mock Service Worker) for HTTP-based APIs:**

For services accessed via HTTP (OpenAI, Google Fonts), use
[MSW](https://mswjs.io/) to intercept network requests and return
contract-conforming responses.

```ts
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

const server = setupServer(
  http.post('https://api.openai.com/v1/chat/completions', () => {
    return HttpResponse.json({
      choices: [{ message: { content: 'Mocked response' } }],
    });
  }),
);

beforeAll(() => server.listen());
afterAll(() => server.close());
```

**Approach — SDK-based services (Stripe, PropelAuth, PostHog):**

For SDK clients, create thin wrapper modules that can be `vi.mock`'d. Alternatively,
use the official test modes:

| Service | Test Mode |
|---------|-----------|
| **Stripe** | [Test mode API keys](https://stripe.com/docs/testing) — real API with test data |
| **PropelAuth** | Test environment with test users (separate project) |
| **PostHog** | Disable in tests (`PUBLIC_POSTHOG_KEY=undefined`) |

**Scheduled contract validation (optional):**

Run a nightly CI job that calls each real SaaS in test/sandbox mode to detect
breaking changes early:

```yaml
# .github/workflows/contract-check.yml
on:
  schedule:
    - cron: '0 6 * * *'
jobs:
  contract:
    steps:
      - run: yarn test:contracts
    env:
      STRIPE_SECRET_KEY: ${{ secrets.STRIPE_TEST_KEY }}
      PROPELAUTH_API_KEY: ${{ secrets.PROPELAUTH_TEST_KEY }}
```

### Layer 5: E2E / Smoke Tests

**Goal:** Validate critical user journeys through the full stack.

**Tool:** Playwright (recommended for Astro + React apps).

**What to test:**
1. Sign-up → create org → land on app page
2. Create a prompt → see it in the list → view it
3. Like / unlike a prompt
4. Settings page loads with subscription status
5. Support widget appears (Fogbender)

**External service handling in E2E:**

| Service | E2E Strategy |
|---------|--------------|
| **PropelAuth** | Use a dedicated test PropelAuth project with pre-created test users. Automate login via API rather than UI. |
| **Supabase/Postgres** | Use a test database; reset between runs. |
| **Stripe** | Use Stripe test mode; use [test card numbers](https://stripe.com/docs/testing#cards). |
| **OpenAI** | Mock with MSW at the network level, or use a tiny local HTTP server that mimics the response shape. |
| **PostHog** | Disable (no `PUBLIC_POSTHOG_KEY`). |
| **Fogbender** | Optionally disable; or use test widget ID. |

---

## Architectural Recommendations

### 1. Extract Pure Logic from Routers

The tRPC routers in `src/lib/trpc/routers/` mix business logic with DB queries and
SaaS API calls. Extract pure functions so they can be unit-tested without mocks:

```
Before:  router handler → DB query + Stripe call + logic + PostHog call
After:   router handler → calls pure function(dbResult, stripeResult) → PostHog call
```

**Candidates for extraction:**
- `checkAccessToPrompt` (already pure, just not exported)
- Rate-limit bucket calculation
- Prompt permission/visibility filtering
- Subscription status determination

### 2. Create Service Wrapper Modules

Wrap each SaaS client in a thin module that exports a clear interface. This makes
`vi.mock` simpler and documents the API surface your app actually uses:

```ts
// src/services/auth.ts
import { propelauth } from '../lib/propelauth';

export const authService = {
  validateToken: (token: string) =>
    propelauth.validateAccessTokenAndGetUser(token),
  fetchUsers: (userIds: string[]) =>
    propelauth.fetchBatchUserMetadataByUserIds(userIds),
};
```

Now tests mock one module (`src/services/auth`) instead of understanding PropelAuth's
internal structure.

### 3. Use `SKIP_ENV_VALIDATION` in Tests

The `t3-env.ts` validation throws at import time if env vars are missing. Set
`SKIP_ENV_VALIDATION=true` in the Vitest environment to avoid this:

```ts
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: {
      SKIP_ENV_VALIDATION: 'true',
    },
  },
});
```

### 4. Establish Test Data Factories

Create shared factories for common objects (users, prompts, orgs):

```ts
// src/test/factories.ts
import type { UserMetadata } from '@propelauth/node';

export function buildUser(overrides: Partial<UserMetadata> = {}): UserMetadata {
  return {
    userId: 'test-user-1',
    email: 'test@example.com',
    username: 'testuser',
    firstName: 'Test',
    lastName: 'User',
    orgIdToOrgMemberInfo: {},
    ...overrides,
  } as UserMetadata;
}

export function buildPrompt(overrides = {}) {
  return {
    promptId: 'prompt-1',
    userId: 'test-user-1',
    orgId: 'org-1',
    privacyLevel: 'public' as const,
    title: 'Test Prompt',
    description: '',
    tags: [],
    template: [],
    ...overrides,
  };
}
```

---

## Suggested Implementation Priorities

### Phase 1 — Quick Wins (low effort, high value)

1. **Extract and unit-test `checkAccessToPrompt`** — covers a critical
   authorization path with zero mocking.
2. **Extract and unit-test rate-limit functions** — `rateLimitSharedKeyId`,
   `rateLimitSharedKeyResetsAt`.
3. **Add `SKIP_ENV_VALIDATION` to vitest config** — enables mocked-service tests.
4. **Create test factories** — reusable `buildUser`, `buildPrompt`.
5. **Mock `posthog.ts` globally** — `trackEvent` is a side-effect-only function;
   a global mock prevents test noise.

### Phase 2 — Core Coverage (moderate effort)

6. **Add `vi.mock`-based tests for `prompts.ts` router** — the largest and most
   complex router; mock DB + PropelAuth + Stripe + PostHog + OpenAI.
7. **Add tests for `settings.ts` router** — mock DB + Stripe.
8. **Add tests for `auth.ts` router** — mock PropelAuth + cookie serialization.
9. **Add MSW-based contract test for OpenAI** — validate request/response shapes.

### Phase 3 — Database Integration (higher effort)

10. **Set up Docker-based test Postgres** — with Drizzle migrations.
11. **Write integration tests for DB operations** — prompts CRUD, rate limiting,
    key management.
12. **Add CI service container** — PostgreSQL in GitHub Actions.

### Phase 4 — End-to-End (highest effort)

13. **Set up Playwright** — with Astro dev server.
14. **Write smoke tests** — login, create prompt, view prompt.
15. **Set up test SaaS accounts** — PropelAuth test project, Stripe test mode.

---

## CI Pipeline Recommendations

```
PR opened / push to main
├── Lint (oxlint)           ← existing
├── Format (prettier)       ← existing
├── Type check (tsc)        ← existing
├── Unit tests (vitest)     ← existing, expand with Layers 1-2
├── DB integration tests    ← new, Layer 3, needs Postgres service
└── E2E smoke tests         ← new, Layer 5, needs all test services

Nightly (scheduled)
└── Contract tests          ← new, Layer 4, calls real test-mode APIs
```

---

## Key Principles

1. **Isolate what you own.** The biggest testing ROI comes from testing _your_
   business logic (access control, rate limiting, data transformations) in isolation
   from third-party services.

2. **Mock at the boundary.** Use `vi.mock` on your own wrapper modules rather than
   deep-mocking SDK internals. This makes tests resilient to SDK version changes.

3. **Use real services sparingly.** Reserve real SaaS calls for nightly contract
   tests or dedicated integration environments — never in fast CI loops.

4. **Test optional services as absent.** Since Stripe, OpenAI, PostHog, and
   Fogbender are all optional, test the code paths where they are _not configured_
   (env vars undefined). These paths are just as important as the happy path.

5. **Prefer extraction over mocking.** Every function you can extract into a
   pure module is one fewer mock you need to maintain.
