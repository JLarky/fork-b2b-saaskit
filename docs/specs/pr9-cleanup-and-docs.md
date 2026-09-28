# PR 9 Spec: Cleanup, Dependency Pruning, and Docs

## Goal

Finalize migration by removing dead compatibility code, pruning obsolete dependencies, and updating docs.

## Scope

- Remove unused legacy helpers and dead code paths left after handler migration.
- Confirm whether any tRPC-related dependencies can be removed at this stage.
- Update changelog/TODO/spec references to reflect completion status.

## Proposed Changes

1. Delete deprecated modules that are no longer imported.
2. Run typecheck/lint/test and fix any fallout.
3. Update workflow docs and migration spec outcomes.

## Acceptance Criteria

- No dead imports or unreachable legacy files remain for completed phases.
- Package manifest reflects actual runtime/tooling usage.
- Documentation accurately describes current architecture.

## Risks

- Premature dependency removal may break transitive tooling.

## Mitigations

- Remove dependencies only after verifying no imports/reference paths remain.
- Keep this PR strictly cleanup-only (no functional behavior changes).
