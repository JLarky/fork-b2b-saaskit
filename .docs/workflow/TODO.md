# TODO

- [ ] Migrate tRPC to Effect docs/specs/effect-migration.md
  - [x] Add initial Effect services and migrate `fogbender` and `create-checkout-session`
  - [ ] Migrate remaining inline PropelAuth API route `src/pages/api/orgs/[orgId].ts`
  - [ ] Move `hello` and `surveys` routers to Effect-backed handlers behind thin tRPC wrappers
  - [ ] Migrate `auth`, `settings`, and `prompts` router logic to Effect handlers
  - [ ] Re-evaluate whether removing tRPC transport is still worthwhile after Phases 1-4
