# PR 4 Spec: Standalone API Route Migration

## Goal

Migrate standalone API routes to Effect handlers using shared service layers and adapter helpers.

## Scope

- `src/pages/api/fogbender.ts`
- `src/pages/api/create-checkout-session.ts`
- New/updated handlers under `src/handlers/api/*`
- Route-level tests covering happy path and failure path parity

## Proposed Changes

1. Move business logic into Effect handlers:
   - `fogbenderHandler`
   - `createCheckoutSessionHandler`
2. Keep Astro route files as thin HTTP adapters only.
3. Use shared helper runner for request context and error conversion.
4. Add tests for config missing, auth failures, invalid body, and success.

## Acceptance Criteria

- Both routes return behavior-parity responses with prior implementation.
- Unit tests validate route logic without live auth/stripe dependencies.
- Routes no longer instantiate auth/payment clients inline.

## Risks

- Subtle response-body/status differences can break clients.

## Mitigations

- Snapshot/contract tests for status and payload shape.
- Explicitly preserve prior error messaging where externally visible.
