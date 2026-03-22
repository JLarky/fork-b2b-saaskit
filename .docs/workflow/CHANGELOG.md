# Changelog

## Phase 1: Effect Services and Typed Errors

**Branch:** `cursor/agentic-loop-workflow-3e69`
**Base:** `feat--effect`

### Added

- `effect@3.21.0`, `@effect/platform@0.96.0`, `@effect/language-service@0.81.0`
- `src/services/Database.ts` — Database service (Context.Tag + Layer)
- `src/services/Auth.ts` — Auth service with narrowed AuthClient interface
- `src/services/Payments.ts` — Payments service (nullable for optional Stripe)
- `src/services/Analytics.ts` — Analytics service (no-op when PostHog key absent)
- `src/services/HttpRequest.ts` — Per-request context (no Live layer)
- `src/services/index.ts` — Barrel re-exports
- `src/errors.ts` — Typed error classes: Unauthorized, Forbidden, NotFound, RateLimited
- 16 new tests across `errors.test.ts` and `services.test.ts`

### Updated

- `tsconfig.json` — @effect/language-service plugin + $schema
- `docs/tech.md` — Documented services directory, lifetime table, test env note

### Architecture decisions

- Live layers use `serverEnv` (validated via t3-env), not raw `process.env`
- Database/Auth/Payments/Analytics are singleton-per-isolate; HttpRequest is per-request
- Existing tRPC procedures and singletons are untouched (no behavior change)

### Review process

- All 6 review personas (Designer, Architect, Domain Expert, Code Expert, Performance Expert, Human Advocate) evaluated the plan and implementation
- Key feedback addressed: env consistency, PostHog lifecycle documentation, test naming, HttpRequest layer docs

## Phase 2: Migrate Standalone API Routes

### Added

- `src/handlers/fogbender.ts` — Effect handler for Fogbender JWT generation
- `src/handlers/checkout.ts` — Effect handler for Stripe checkout session
- `src/handlers/response.ts` — shared `catchHttpErrors` helper (error tag → HTTP status)
- 9 new tests across `fogbender.test.ts` and `checkout.test.ts`

### Changed

- `src/pages/api/fogbender.ts` — thin wrapper over Effect handler
- `src/pages/api/create-checkout-session.ts` — thin wrapper over Effect handler

### Architecture decisions

- Handlers in `src/handlers/` return typed data, not Response objects — for testability
- Page files own error-to-Response mapping via `catchHttpErrors` + `catchAllDefect`
- Both routes now use the shared `Auth` service instead of inline `initBaseAuth()`
- FOGBENDER_SECRET injected as function parameter (not a service — single consumer)

## Phase 3: Migrate Surveys Router

### Added

- `src/handlers/surveys.ts` — Effect handlers: `getPublicSurveys`, `postSurvey`
- `src/handlers/surveys.test.ts` — 4 tests with mock Database layers

### Changed

- `src/lib/trpc/routers/surveys.ts` — thin tRPC wrapper over Effect handlers

### Architecture decisions

- tRPC wrappers provide Database via `Layer.succeed(Database, db)` — reuses the
  existing module-level singleton, no new connections
- hello router deferred to Phase 4 (counter is trivially stateful, hello procedure
  depends on tRPC unthunk context)
