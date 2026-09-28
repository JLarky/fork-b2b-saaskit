# PR 3 Spec: Shared HTTP Adapter and Error Mapping

## Goal

Create a unified HTTP adapter boundary for Effect handlers so API routes and tRPC wrappers
can share consistent request wiring and error-to-response behavior.

## Scope

- Shared handler runner and helpers (`runApiHandler`/equivalent).
- Centralized error mapping for known auth/domain failures and unknown failures.
- Response normalization helpers (JSON content type, headers passthrough).

## Proposed Changes

1. Standardize helper utilities in `src/handlers/api/shared.ts` (or shared handler module).
2. Ensure non-domain errors map to `500` safely.
3. Add normalization for `Authorization: Bearer <token>` parsing.
4. Add tests covering:
   - success responses
   - known auth/domain failures
   - unknown errors

## Acceptance Criteria

- Adapter behavior is reusable by standalone routes and router wrappers.
- Responses from shared helpers include predictable status and body semantics.
- Tests prove bearer token parsing and fallback error handling.

## Risks

- Divergent legacy handler conventions may conflict during migration.

## Mitigations

- Keep adapter API small and migrate callers incrementally.
