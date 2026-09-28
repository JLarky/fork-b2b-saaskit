# TODO

- [x] Phase 1: Add Effect, define services, typed errors (docs/specs/effect-migration.md)
- [x] Phase 2: Migrate standalone API routes to Effect (fogbender.ts, create-checkout-session.ts)
- [x] Phase 3: Migrate surveys router to Effect handlers
- [x] Phase 4: Migrate complex routers to Effect (auth, settings, prompts)
- [ ] Phase 5: Replace tRPC with Effect HTTP (optional, see spec)

## Discovered during Phase 1 (for human review)

- [ ] `prompts.ts` has two functions (`resolvePropelAuthUsers`, `resolvePropelPublicUsers`) that TypeScript hints could be async — consider converting
- [ ] PostHog analytics creates a new client + shutdownAsync per event call (both in existing `posthog.ts` and new `AnalyticsLive`); consider a long-lived client if the deployment model allows batched flush
- [ ] The two standalone API routes (`fogbender.ts`, `create-checkout-session.ts`) each create their own `initBaseAuth()` inline — Phase 2 will unify these on the `Auth` service layer
- [ ] `effect-migration.md` spec snippets use `process.env` and `BaseAuthClient`; implementation uses `serverEnv` and `ReturnType<typeof initBaseAuth>` — consider syncing the spec to match implementation patterns

## Stacked PR plan (clear review slices)

- [ ] PR 1: Testability and env gating (docs/specs/pr1-testability-env-gating.md)
- [ ] PR 2: Effect services and test layers (docs/specs/pr2-effect-services-and-test-layers.md)
- [ ] PR 3: Shared HTTP adapter and error mapping (docs/specs/pr3-shared-http-adapter-and-error-mapping.md)
- [ ] PR 4: Standalone API route migration (docs/specs/pr4-standalone-api-route-migration.md)
- [ ] PR 5-8: tRPC router domain migrations (docs/specs/pr5-pr8-trpc-router-domain-migrations.md)
- [ ] PR 9: Cleanup, dependency pruning, and docs (docs/specs/pr9-cleanup-and-docs.md)
