# Effect Migration Spec

## Goal

Replace tRPC and ad-hoc DI patterns (`unthunk`, module-level singletons) with Effect,
gaining compile-time dependency tracking, typed errors, and testability via service layers.

## Current Architecture

### External services (module-level singletons)

| Service        | File                              | Initialization                        |
| -------------- | --------------------------------- | ------------------------------------- |
| Database       | `src/db/db.ts`                    | `drizzle(postgres(env.DATABASE_URL))` |
| PropelAuth     | `src/lib/propelauth.ts`           | `initBaseAuth({...env})`              |
| Stripe         | `src/lib/stripe.ts`               | `new Stripe(apiKey, ...)`             |
| PostHog        | `src/lib/posthog.ts`              | `new PostHog(env.PUBLIC_POSTHOG_KEY)` |
| OpenAI (fetch) | `src/lib/trpc/routers/prompts.ts` | Raw `fetch` to OpenAI API             |

### tRPC middleware chain

```
publicProcedure
  └─ apiProcedure        (requires req/resHeaders, adds lazy parsedCookies/accessToken/userOrgId/userPromise via unthunk)
       └─ authProcedure  (awaits userPromise, adds user)
            └─ orgProcedure (validates org membership, adds requiredOrgId)
```

### Routers

| Router   | File                  | Procedures | Dependencies                                    |
| -------- | --------------------- | ---------- | ----------------------------------------------- |
| hello    | `routers/hello.ts`    | 3          | (none)                                          |
| auth     | `routers/auth.ts`     | 1          | propelauth                                      |
| surveys  | `routers/surveys.ts`  | 2          | db                                              |
| settings | `routers/settings.ts` | 4          | db, stripe                                      |
| prompts  | `routers/prompts.ts`  | 9          | db, propelauth, stripe, posthog, openai (fetch) |

### Non-tRPC API routes

| Route                                  | Dependencies                |
| -------------------------------------- | --------------------------- |
| `pages/api/fogbender.ts`               | propelauth (inline)         |
| `pages/api/create-checkout-session.ts` | propelauth (inline), stripe |

Both of these create their own `initBaseAuth()` instance inline rather than using the shared singleton.

## Effect Service Definitions

Repo note: in this Astro app, live layers should wrap the existing validated env and singletons
instead of reading raw `process.env` directly in multiple places. Prefer `serverEnv`,
`src/lib/propelauth.ts`, `src/db/db.ts`, and `src/lib/stripe.ts` so the migration does not
reintroduce duplicate client initialization.

### Core services

```ts
// src/services/Database.ts
import { Context, Effect, Layer } from 'effect';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

export class Database extends Context.Tag('Database')<Database, PostgresJsDatabase>() {}

export const DatabaseLive = Layer.sync(Database, () =>
	drizzle(postgres(process.env.DATABASE_URL!))
);

export const DatabaseTest = (mock: PostgresJsDatabase) => Layer.succeed(Database, mock);
```

```ts
// src/services/Auth.ts
import { Context, Layer } from 'effect';
import { initBaseAuth, type BaseAuthClient } from '@propelauth/node';

// Expose only the methods we actually use
export interface AuthClient {
	validateAccessTokenAndGetUser: BaseAuthClient['validateAccessTokenAndGetUser'];
	validateAccessTokenAndGetUserWithOrgInfo: BaseAuthClient['validateAccessTokenAndGetUserWithOrgInfo'];
	fetchBatchUserMetadataByUserIds: BaseAuthClient['fetchBatchUserMetadataByUserIds'];
}

export class Auth extends Context.Tag('Auth')<Auth, AuthClient>() {}

export const AuthLive = Layer.sync(Auth, () =>
	initBaseAuth({
		authUrl: process.env.PUBLIC_AUTH_URL!,
		apiKey: process.env.PROPELAUTH_API_KEY!,
		manualTokenVerificationMetadata: {
			verifierKey: process.env.PROPELAUTH_VERIFIER_KEY!,
			issuer: process.env.PUBLIC_AUTH_URL!,
		},
	})
);
```

```ts
// src/services/Payments.ts
import { Context, Layer } from 'effect';
import Stripe from 'stripe';

export interface PaymentsClient {
	stripe: Stripe;
	priceId: string;
}

export class Payments extends Context.Tag('Payments')<
	Payments,
	PaymentsClient | null // null when Stripe is not configured
>() {}

export const PaymentsLive = Layer.sync(Payments, () => {
	const apiKey = process.env.STRIPE_SECRET_KEY;
	const priceId = process.env.STRIPE_PRICE_ID;
	if (!apiKey || !priceId) return null;
	return {
		stripe: new Stripe(apiKey, { apiVersion: '2022-11-15', typescript: true }),
		priceId,
	};
});
```

```ts
// src/services/Analytics.ts
import { Context, Layer } from 'effect';

export interface AnalyticsClient {
	trackEvent(distinctId: string, event: string, properties?: Record<string, unknown>): Effect<void>;
}

export class Analytics extends Context.Tag('Analytics')<Analytics, AnalyticsClient>() {}

// PostHog implementation for live
// No-op implementation for test
```

```ts
// src/services/HttpRequest.ts
import { Context } from 'effect';

export interface RequestContext {
	request: Request;
	resHeaders: Headers;
}

export class HttpRequest extends Context.Tag('HttpRequest')<HttpRequest, RequestContext>() {}
```

## Typed Errors

Replace string-based `TRPCError` codes with discriminated unions:

```ts
// src/errors.ts
import { Data } from 'effect';

export class Unauthorized extends Data.TaggedError('Unauthorized')<{
	message: string;
}> {}

export class Forbidden extends Data.TaggedError('Forbidden')<{
	message: string;
}> {}

export class NotFound extends Data.TaggedError('NotFound')<{
	message: string;
}> {}

export class RateLimited extends Data.TaggedError('RateLimited')<{
	message: string;
	resetsAt: Date;
}> {}
```

## Replacing the tRPC Middleware Chain

The current `unthunk`-based lazy context in `apiProcedure` maps naturally to Effect:

```ts
// src/services/Session.ts — replaces the unthunk block in apiProcedure
import { Context, Effect, Layer } from 'effect';
import { parse } from 'cookie';
import { Auth } from './Auth';
import { HttpRequest } from './HttpRequest';

export interface SessionData {
	parsedCookies: Record<string, string>;
	accessToken: string | undefined;
	userOrgId: string | undefined;
	user: Effect<User, Unauthorized>; // lazy — only runs when consumed
}

export class Session extends Context.Tag('Session')<Session, SessionData>() {}

// Layer that derives Session from HttpRequest + Auth
export const SessionFromRequest = Layer.effect(
	Session,
	Effect.gen(function* () {
		const { request } = yield* HttpRequest;
		const auth = yield* Auth;
		const parsedCookies = parse(request.headers.get('cookie') || '');
		// ... derive accessToken, userOrgId from cookies
		// user is a lazy Effect, not eagerly awaited
		const user = Effect.tryPromise({
			try: () => auth.validateAccessTokenAndGetUser('Bearer ' + accessToken),
			catch: () => new Unauthorized({ message: 'Could not validate access token.' }),
		});
		return { parsedCookies, accessToken, userOrgId, user };
	})
);
```

The `authProcedure` and `orgProcedure` layers become:

```ts
// AuthenticatedUser — replaces authProcedure middleware
export class AuthenticatedUser extends Context.Tag('AuthenticatedUser')<
	AuthenticatedUser,
	User
>() {}

export const AuthenticatedUserFromSession = Layer.effect(
	AuthenticatedUser,
	Effect.gen(function* () {
		const session = yield* Session;
		return yield* session.user; // Unauthorized error propagates automatically
	})
);

// OrgAccess — replaces orgProcedure middleware
export class OrgAccess extends Context.Tag('OrgAccess')<OrgAccess, { orgId: string }>() {}
```

## Migration Plan

### Phase 0: Setup Effect in the project

Follow the instructions in [https://www.effect.solutions/project-setup](https://www.effect.solutions/project-setup) to set up the project.

### Phase 1: Add Effect, define services (no behavior change)

1. `yarn add effect @effect/platform`
2. Create `src/services/` directory with service definitions above
3. Create `src/errors.ts` with typed error classes
4. Create live `Layer` implementations for each service
5. Write tests for existing pure functions using Effect test layers

Repo note: keep new Vitest coverage under `src/**/*.test.ts` so it matches the current test include
pattern documented in `docs/tech.md`.

**Deliverable:** Services exist. In the first standalone-route slice they can be wired directly
into migrated API handlers, while the remaining tRPC procedures still use the legacy path.

### Phase 2: Migrate standalone API routes

Migrate `pages/api/fogbender.ts` and `pages/api/create-checkout-session.ts` first — they
are self-contained, already create their own `initBaseAuth` inline, and don't use tRPC at all.

Before:

```ts
// pages/api/fogbender.ts
export const POST: APIRoute = async ({ request }) => {
  const propelauth = initBaseAuth({...})
  try {
    // ... business logic with propelauth
    return new Response(JSON.stringify(data), { status: 200 })
  } catch (e) {
    const err = handleError(e, ...)
    return new Response(err.message, { status: err.status })
  }
}
```

After:

```ts
// pages/api/fogbender.ts
const handler = Effect.gen(function* () {
	const auth = yield* Auth;
	const { request } = yield* HttpRequest;
	// ... same logic, but auth comes from the service
}).pipe(
	Effect.catchTags({
		Unauthorized: (e) => Effect.succeed(new Response(e.message, { status: 401 })),
		Forbidden: (e) => Effect.succeed(new Response(e.message, { status: 403 })),
	})
);

export const POST: APIRoute = async ({ request }) => {
	return Effect.runPromise(
		handler.pipe(
			Effect.provideLayer(
				Layer.mergeAll(AuthLive, Layer.succeed(HttpRequest, { request, resHeaders: new Headers() }))
			)
		)
	);
};
```

Implementation note for this repo: keep the Astro route file as a thin wrapper, place the
Effect program in an importable handler module under `src/handlers/api/`, and use a shared route
adapter (for example `runApiHandler`) so tests can provide mock layers directly while production
routes provide live layers. Preserve the existing plain-text HTTP error contract by mapping Effect
failures through `handleError(..., { returnDetailedErrorToUser: false })` until the API contract is
intentionally revised.

**Deliverable:** Two API routes use Effect services. First real tests can mock `Auth`.

### Phase 3: Migrate pure-ish routers (surveys, hello)

These have minimal dependencies (just `db`). Convert them to plain Effect functions
that are called from thin tRPC procedure wrappers:

```ts
// src/handlers/surveys.ts
export const getPublicSurveys = Effect.gen(function* () {
  const db = yield* Database
  return yield* Effect.tryPromise(() =>
    db.select({...}).from(surveys).where(eq(surveys.isPublic, true)).orderBy(desc(surveys.id))
  )
})
```

```ts
// routers/surveys.ts — thin tRPC wrapper (temporary, removed in Phase 5)
import { getPublicSurveys } from '../../handlers/surveys';

export const surveysRouter = createTRPCRouter({
	getPublic: publicProcedure.query(() =>
		Effect.runPromise(getPublicSurveys.pipe(Effect.provide(LiveLayer)))
	),
});
```

**Deliverable:** Business logic is in Effect, tRPC is just a thin HTTP adapter.

### Phase 4: Migrate complex routers (auth, settings, prompts)

These have the most dependencies and the most value from typed errors.

Key transformations:

- `prompts.ts` `resolvePropelAuthUsers` → uses `Auth` service instead of singleton
- `prompts.ts` `rateLimitUpsert` → uses `Database` service, returns `Effect<number, RateLimited>`
- `prompts.ts` `runPrompt` → uses `Database`, `Payments`, new `OpenAI` service
- `auth.ts` `authSync` → uses `Auth` service, `HttpRequest` for cookie setting
- `settings.ts` → uses `Database`, `Payments` services

**Deliverable:** All business logic in Effect handlers. `unthunk` dependency removed.

### Phase 5: Replace tRPC with Effect HTTP

Replace the tRPC router + React Query client with `@effect/platform` HTTP:

```ts
// src/api/router.ts
import { HttpRouter, HttpServerResponse } from '@effect/platform';

const router = HttpRouter.empty.pipe(
	HttpRouter.get('/api/surveys', getSurveysHandler),
	HttpRouter.post('/api/surveys', postSurveyHandler)
	// ...
);
```

Client-side options:

- **Option A:** Use `@effect/platform` `HttpClient` with a thin typed wrapper
- **Option B:** Keep React Query, call Effect HTTP endpoints with plain `fetch` + shared type definitions
- **Option C (recommended for incremental migration):** Use React Query with a custom hook that calls the Effect API, sharing input/output schemas via `@effect/schema`

**Deliverable:** tRPC removed. `@trpc/client`, `@trpc/server`, `@trpc/react-query` uninstalled.

## Dependency Removal

After full migration, these packages can be removed:

| Package             | Replaced by                                      |
| ------------------- | ------------------------------------------------ |
| `@trpc/client`      | `@effect/platform` HttpClient or plain fetch     |
| `@trpc/server`      | `@effect/platform` HttpRouter                    |
| `@trpc/react-query` | React Query + typed fetch, or `@effect/platform` |
| `unthunk`           | Effect's native laziness (`Effect.gen`, `Layer`) |
| `superjson`         | `@effect/schema` handles serialization           |

Packages that stay: `drizzle-orm`, `stripe`, `@propelauth/node`, `zod` (or migrate to `@effect/schema`), `react`, `astro`, `@tanstack/react-query`.

## Testing Strategy

The whole point. Every service gets a test layer:

```ts
// test/layers.ts
import { Layer } from 'effect';

export const TestDatabase = (queries: Record<string, unknown[]>) =>
	Layer.succeed(Database, mockDrizzle(queries));

export const TestAuth = (users: Record<string, User>) =>
	Layer.succeed(Auth, {
		validateAccessTokenAndGetUser: async (token) => {
			const user = users[token.replace('Bearer ', '')];
			if (!user) throw new Error('invalid');
			return user;
		},
		validateAccessTokenAndGetUserWithOrgInfo: async () => {
			throw new Error('not implemented');
		},
		fetchBatchUserMetadataByUserIds: async (ids) =>
			Object.fromEntries(ids.map((id) => [id, users[id]]).filter(([, u]) => u)),
	});

export const TestPayments = Layer.succeed(Payments, null);
export const TestAnalytics = Layer.succeed(Analytics, { trackEvent: () => Effect.void });
```

Example test:

```ts
import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { getPublicSurveys } from '../src/handlers/surveys';

describe('getPublicSurveys', () => {
	it('returns only public surveys', async () => {
		const result = await Effect.runPromise(
			getPublicSurveys.pipe(
				Effect.provide(
					TestDatabase({
						surveys: [{ id: 1, rating: 5, isPublic: true, comments: 'great' }],
					})
				)
			)
		);
		expect(result).toHaveLength(1);
	});
});
```

## Risks and Mitigations

| Risk                                                      | Mitigation                                                              |
| --------------------------------------------------------- | ----------------------------------------------------------------------- |
| Team unfamiliarity with Effect                            | Phase 1-2 are low-risk; the team learns incrementally                   |
| React Query integration gap after removing tRPC           | Keep React Query, just change the transport layer (Option C in Phase 5) |
| Drizzle + Effect interop friction                         | Wrap Drizzle calls in `Effect.tryPromise`; don't try to replace Drizzle |
| Large diff in Phase 5 (tRPC removal)                      | Can stay at Phase 4 indefinitely — tRPC as thin adapter is fine         |
| `@effect/platform` HTTP is less mature than tRPC adapters | Phase 5 is optional; evaluate maturity when you get there               |

## Open Questions

1. **Schema library:** Migrate from Zod to `@effect/schema`? Pros: tighter Effect integration, dual encode/decode. Cons: Zod is everywhere, more to rewrite.
2. **Client-side Effect:** Should React components use Effect, or keep it server-only? Recommendation: server-only to start.
3. **Phase 5 necessity:** The biggest testability wins come from Phases 1-4. Removing tRPC (Phase 5) is about consistency, not testability. It can be deferred indefinitely.
