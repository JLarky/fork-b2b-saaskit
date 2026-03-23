# Night Shift Agent Loop

0. Prep: clean the working tree by analyzing any uncommitted work and doing the right thing with it, such as stashing or committing. Also run the entire current test suite and fix any failures encountered.
1. Pick a task from bugs first, or if bugs are complete, a feature that has a completed spec.
2. Load the spec, then analyze it.
3. Load relevant docs, then look at relevant code.
4. Develop a testing plan. This is absolutely critical.
5. Write extensive tests for the task, then run them, expecting failures.
6. Develop an extensive plan of its own. The human does not need to read this.
7. Run sub-agents as critical reviewers based on the 6 personas detailed in `.docs/workflow/REVIEW_PERSONAS.md`: Designer, Architect, Domain Expert, Code Expert, Performance Expert, and Human Advocate. Each persona owns a portion of the docs, reviews against its own documentation, and suggests where its own docs need to be adapted.
8. Adapt the plan based on review-agent feedback, and loop to step 7 until all review agents give a green light.
9. Implement the plan, including documentation adjustments. Docs live in the same codebase under `docs/`.
10. Run type checking, linting, compiler checks, other static analysis tools, as many checks as possible, and the relevant tests themselves. Be as strict as possible. See `docs/tech.md` for repository-specific validation commands and tooling guidance.
11. Run the entire test suite to protect against regressions, and fix any new issues.
12. Run the review agents again on the implementation diff, and loop back to step 10 until all review agents give a green light.
13. Add any unrelated TODOs noticed along the way to the TODO doc for human review.
14. Wrap up: write a CHANGELOG entry, then commit with a detailed commit message meant for human context when reviewing the code.
15. If a PR was created or updated during this task, wait for CI to finish and confirm all checks pass. If any check fails, diagnose, fix, push, and re-check until green.
16. Loop back to the beginning at step 1, then select the next task or spec.
17. When completely done, write a report for human review. It should be extremely concise. Details live in commit messages.
18. The Night Shift is done. It goes silent and waits for the next day shift.
