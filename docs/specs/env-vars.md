# Environment Variables

This repo is bit tricky because it needs to work in two contexts:

- prompts with friends example app
- b2b saas kit onboarding app

If we only used it for the first one we could have marked all required env vars required and relied on that for validation. But be because we want smooth onboarding in dev we want you to be able to run `yarn dev` on a clean repo before any of the env vars are set.

So current solution is to make variables optional in varlock but make them required in t3-env. So different parts of the app can use only the part that they need.

## Requirements

1. `yarn dev` starts on a clean repo without Doppler
2. `/setup` is accessible and renders correctly
3. `/app` (and any page that needs DB/auth) shows t3-env's friendly AstroError with the hint pointing to `/setup` — not a cryptic crash from downstream libraries like PropelAuth
4. `doppler run yarn dev` with all env vars set works as before
