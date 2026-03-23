# Integration Testing Plan

## Setup

- Tests run via `yarn test` which uses `doppler run -- vitest run`
- All tests require Doppler to inject environment variables (no `SKIP_ENV_VALIDATION` fallback)
- DB must have migrations applied (`doppler run yarn migrate`)
- CI needs a `DOPPLER_TOKEN` secret configured in GitHub

## Test Files

### Unit tests (no DB)

- `src/lib/publicUserInfo.test.ts` — pure logic for display names
- `src/lib/trpc/routers/hello.test.ts` — in-memory counter, verifies tRPC caller works

### Integration tests (tRPC + DB, public procedures)

- `src/lib/trpc/routers/surveys.test.ts` — CRUD, missing optional fields, rating boundary values (1, 5), private surveys excluded from getPublic, ordering

### Integration tests (tRPC + DB, auth procedures with mocked PropelAuth)

- `src/lib/trpc/routers/prompts.test.ts` — CRUD, owner-only mutations, default title/tags, like/unlike toggle with counts, idempotent likes, privacy level enforcement
- `src/lib/trpc/routers/settings.test.ts` — stripeConfigured check, key CRUD, key replacement semantics, owner-only deletion

### Test utilities

- `vitest-setup.ts` — global test setup that mocks `propelauth` and `posthog` via `vi.mock()` so tests use fake auth instead of real PropelAuth
- `src/lib/trpc/routers/test-utils.ts` — shared auth mocking infrastructure:
  - `fakeUser()` — builds a PropelAuth User with org membership
  - `fakeAuthContext()` — builds a Request with cookies that satisfy apiProcedure/authProcedure/orgProcedure middleware

## Auth mocking strategy

- `createCaller` accepts a context object; auth procedures need `req` + `resHeaders` + valid cookies
- `test-utils.ts` mocks `propelauth.validateAccessTokenAndGetUser` to return a fake user, bypassing real PropelAuth
- Cookie encoding matches the real auth flow: `b2b_auth` (httpOnly, access token) + `js_b2b_auth` (public, userId/orgId)
- This lets us test `authProcedure` and `orgProcedure` chains without a running auth service

## Not planned (3rd party)

- Stripe webhooks/checkout — skip for now
- Fogbender widget — client-side only
- PostHog analytics — optional, no server logic to test (mocked in tests)
