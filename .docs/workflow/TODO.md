# TODO

## Follow-ups for day shift

- [ ] Align `getPrompt.canEdit` with org-bound update authorization. It currently checks only `userId`, while `updatePrompt` now requires both `userId` and active `orgId`.
- [ ] Decide whether `deletePrompt` should remain user-only authorization or also enforce active-org matching for consistency with `updatePrompt`.
- [ ] Consider hardening `updatePrompt` with `WHERE promptId AND userId AND orgId` plus affected-row checks to enforce authorization at SQL level too.
