# Top 10 priorities

1. Add automated tests for the critical business paths.
   - Start with tRPC caller tests for auth/org guards, prompt access rules, settings flows, and survey submission.
   - Add a small number of end-to-end smoke tests for login, prompt CRUD, and settings.

2. Harden public write endpoints against abuse.
   - Add rate limiting, bot protection, and/or anti-spam controls for `surveys.postSurvey`.
   - Review every `publicProcedure` mutation and public API route with the same lens.

3. Remove or isolate demo-only server code from the main app surface.
   - Move `helloRouter` demo procedures behind a demo-only flag, a demo route group, or delete them entirely.

4. Improve production observability.
   - Add structured logging and error reporting around tRPC handlers, auth sync, Stripe flows, Fogbender token issuance, and OpenAI requests.

5. Introduce clearer routing conventions for `/app`.
   - Document the Astro route entrypoint + React Router ownership model.
   - Reduce duplicated route knowledge where possible.

6. Re-enable high-value ESLint safety rules incrementally.
   - Prioritize `no-floating-promises`, `no-unused-vars`, and selected `no-unsafe-*` rules.
   - Fix violations in small batches instead of one giant cleanup.

7. Simplify the frontend runtime mix.
   - Replace the Solid-powered setup accordion with Astro/React/native browser behavior unless Solid is going to be a first-class part of the stack.

8. Fix the known tRPC hydration/provider rough edge.
   - Resolve the `src/components/trpc.tsx` TODO around dehydrated state handling and verify SSR hydration behavior carefully.

9. Make migration and database operations safer.
   - Reduce the risk of hand-edit mistakes around RLS setup.
   - Consider clearer separation between generated Drizzle artifacts and manually maintained DB code/docs.

10. Refresh CI and dependency hygiene.
    - Align local/CI Node expectations more explicitly.
    - Upgrade older GitHub Actions versions.
    - Audit direct vs transitive dependencies and keep production-critical packages explicit.
