# PR 5-8 Spec: tRPC Router Domain Migrations

## Goal

Migrate tRPC routers to thin adapters over Effect handlers, one domain per PR to keep review scope clear.

## Planned PR Breakdown

## PR 5: Surveys router migration

- Files: `src/lib/trpc/routers/surveys.ts`, `src/handlers/surveys.ts`, tests
- Dependencies: Database service
- Deliverable: surveys logic in handlers, router wraps `Effect.runPromise` only

## PR 6: Auth router migration

- Files: `src/lib/trpc/routers/auth.ts`, `src/handlers/auth.ts`, tests
- Dependencies: Auth + HttpRequest services
- Deliverable: cookie/header side effects handled through request context service

## PR 7: Settings router migration

- Files: `src/lib/trpc/routers/settings.ts`, `src/handlers/settings.ts`, tests
- Dependencies: Database + Payments services
- Deliverable: settings/usage/billing logic extracted to handlers

## PR 8: Prompts router migration

- Files: `src/lib/trpc/routers/prompts.ts`, `src/handlers/prompts.ts`, tests
- Dependencies: Database + Auth + Payments + Analytics (+ optional OpenAI access)
- Deliverable: all prompt business logic extracted; router is adapter only

## Shared Acceptance Criteria Across PR 5-8

- Router files remain thin request/validation adapters.
- Domain logic is tested via handler tests with mocked service layers.
- Error contracts remain parity-compatible with existing client expectations.

## Risks

- Prompts domain has highest complexity and widest dependency surface.

## Mitigations

- Keep prompts in its own PR.
- Add targeted tests for auth edge cases, rate limits, and serialization parity.
