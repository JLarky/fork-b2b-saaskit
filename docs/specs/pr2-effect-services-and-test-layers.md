# PR 2 Spec: Effect Services and Test Layers

## Goal

Introduce foundational Effect service abstractions and test layers without changing endpoint behavior.

## Scope

- Service definitions in `src/services/*` (Auth, Database, Payments, Analytics, HttpRequest).
- Typed domain errors in `src/errors.ts`.
- Unit tests for services and error helpers.

## Proposed Changes

1. Ensure each external dependency is represented by a `Context.Tag`.
2. Add live implementations and deterministic test layers.
3. Add tests that validate contracts and expected failure mapping.

## Acceptance Criteria

- Service modules compile and are consumed by at least one test.
- Tests can provide mocked service layers to run logic deterministically.
- No user-facing route behavior changes in this PR.

## Risks

- Service interfaces may overfit current usages and require later expansion.

## Mitigations

- Keep interfaces narrow and focused on currently used methods.
- Prefer additive interface changes in later PRs.
