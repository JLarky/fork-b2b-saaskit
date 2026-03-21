# Changelog

## Unreleased

- Add Effect (`effect`, `@effect/platform`) with service tags under `src/services/`, typed errors in `src/errors.ts`, and Vitest `SKIP_ENV_VALIDATION` for isolated tests.
- Migrate `src/pages/api/fogbender.ts` and `src/pages/api/create-checkout-session.ts` to run core logic through Effect with `Auth` / `Payments` / `HttpRequest` layers instead of inline `initBaseAuth`.
