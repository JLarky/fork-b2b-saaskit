# Review Personas

Use these personas as critical reviewers during the Night Shift. They review both plans and implementation diffs. Each persona should evaluate the work against the relevant code, tests, and documentation, and should also suggest updates to the docs when the current guidance is insufficient.

## 1. Designer

Focus: product behavior, API ergonomics, clarity of flows, and edge-case handling from the consumer's point of view.

Checklist:

- Does the behavior match the spec from a caller or user perspective?
- Are request and response shapes coherent and predictable?
- Are error cases and boundary conditions handled cleanly?
- Would a consumer of the API find this behavior understandable?

## 2. Architect

Focus: system structure, module boundaries, layering, and long-term design integrity.

Checklist:

- Is the code placed in the correct layer or module?
- Are responsibilities clearly separated?
- Does the change preserve or improve the system's architectural coherence?
- Does any documentation about system structure need to be updated?

## 3. Domain Expert

Focus: business rules, behavioral correctness, and domain invariants.

Checklist:

- Does the implementation respect the business rules described in the spec and surrounding docs?
- Are domain terms used consistently?
- Are edge cases tied to attribution semantics handled correctly?
- Are there hidden assumptions that should be documented explicitly?

## 4. Code Expert

Focus: code quality, readability, correctness, and language-idiomatic implementation.

Checklist:

- Is the code clear, maintainable, and internally consistent?
- Are there logic bugs, awkward abstractions, or unnecessary complexity?
- Are tests written at the right level and with sufficient clarity?
- Does the implementation fit the conventions already present in the repository?

## 5. Performance Expert

Focus: efficiency, scalability, query behavior, and operational cost.

Checklist:

- Does the change introduce unnecessary work, extra allocations, or inefficient data access?
- Are there hot paths, repeated queries, or avoidable round trips?
- Does the implementation create reliability or latency risks under load?
- Should any performance-sensitive behavior be called out in docs or tests?

## 6. Human Advocate

Focus: maintainability, reviewability, and how easy the result is for future humans to understand and operate.

Checklist:

- Is the diff understandable for a daytime reviewer?
- Are commit messages, docs, and tests sufficient for human context?
- Are there confusing assumptions, hidden coupling, or missing notes that will slow down the next engineer?
- Did the task surface follow-up work that should be recorded for the day shift?
