# PR 1 Spec: Testability and Environment Gating

## Goal

Make tests runnable in clean CI/cloud environments without production secrets by preventing
import-time environment validation failures during test execution.

## Scope

- Add test-specific env validation bypass in Vitest setup.
- Keep runtime behavior unchanged for development and production.
- Document the behavior in migration notes/TODO.

## Proposed Changes

1. Add a Vitest setup file that sets `process.env.SKIP_ENV_VALIDATION = "true"` early.
2. Wire setup file in `vitest.config.ts` via `test.setupFiles`.
3. Keep `src/t3-env.ts` behavior unchanged for non-test modes unless a safer mode check is preferred.

## Acceptance Criteria

- `yarn test` starts and collects suites without requiring `DATABASE_URL`,
  `PROPELAUTH_API_KEY`, `PROPELAUTH_VERIFIER_KEY`, or `PUBLIC_AUTH_URL`.
- No behavior change in dev/prod env validation.
- Existing tests continue to pass or fail only for legitimate logic reasons.

## Risks

- Hidden reliance on env vars inside tests can be masked by global skip.

## Mitigations

- Prefer explicit per-test service layer mocking.
- Add notes in test setup to keep env skip test-only.
