# Phase 2 Implementation Plan: Migrate Standalone API Routes

## Objective

Migrate `pages/api/fogbender.ts` and `pages/api/create-checkout-session.ts` to
use Effect services (Auth, HttpRequest, Payments). Each route currently creates
its own `initBaseAuth()` inline — after migration, they share the `Auth` service.

Business logic is extracted to `src/handlers/` for testability; page files
become thin wrappers that provide layers and run the effect.

## Current state

Both routes follow the same pattern:

1. Create their own `initBaseAuth()` per request (duplicated from `src/lib/propelauth.ts`)
2. Extract Authorization header from request
3. Validate token + org access via PropelAuth
4. Perform route-specific work (JWT signing / Stripe checkout)
5. Wrap errors with `handleError()` from `@propelauth/node`

## Target state

### Handler files (`src/handlers/`)

Each handler is a pure Effect program requiring services from the context:

```ts
// src/handlers/fogbender.ts
export const fogbenderHandler: Effect<Response, Unauthorized | Forbidden, Auth | HttpRequest>;
```

```ts
// src/handlers/checkout.ts
export const checkoutHandler: Effect<
	Response,
	Unauthorized | Forbidden | NotFound,
	Auth | HttpRequest | Payments
>;
```

### Page files (`src/pages/api/`)

Thin wrappers that provide layers and run the effect:

```ts
export const POST: APIRoute = async ({ request }) =>
	Effect.runPromise(
		fogbenderHandler.pipe(
			Effect.provide(
				Layer.mergeAll(
					AuthLive,
					Layer.succeed(HttpRequest, { req: request, resHeaders: new Headers() })
				)
			),
			Effect.catchAll((e) => Effect.succeed(new Response(e.message, { status: 500 })))
		)
	);
```

## Files changed

| File                                       | Action                                |
| ------------------------------------------ | ------------------------------------- |
| `src/handlers/fogbender.ts`                | new — Effect handler                  |
| `src/handlers/checkout.ts`                 | new — Effect handler                  |
| `src/handlers/fogbender.test.ts`           | new — tests with mock Auth            |
| `src/handlers/checkout.test.ts`            | new — tests with mock Auth + Payments |
| `src/pages/api/fogbender.ts`               | update — thin wrapper                 |
| `src/pages/api/create-checkout-session.ts` | update — thin wrapper                 |

## Error handling strategy

| Condition                                 | Error type          | HTTP status |
| ----------------------------------------- | ------------------- | ----------- |
| Missing Authorization header              | `Unauthorized`      | 401         |
| Token validation fails                    | `Unauthorized`      | 401         |
| Org access denied                         | `Forbidden`         | 403         |
| Missing config (Fogbender secret, Stripe) | `NotFound`          | 404         |
| Unexpected errors                         | defects (catch-all) | 500         |

Typed errors are caught with `Effect.catchTags` in the page wrapper and mapped
to Response objects. Unexpected defects fall through to a catch-all handler.

## Testing plan

### fogbender handler

1. Happy path: valid token + org → returns Fogbender JWT response
2. Missing Authorization header → Unauthorized
3. Missing orgId in body → Unauthorized
4. Token validation fails → Unauthorized/Forbidden
5. Missing FOGBENDER_SECRET → NotFound

### checkout handler

1. Happy path: valid token + org + configured Stripe → returns checkout URL
2. Missing Authorization header → Unauthorized
3. Payments not configured (null) → NotFound
4. Missing orgId → Unauthorized
5. Token validation fails → Unauthorized/Forbidden

Tests use `Layer.succeed` mocks for Auth, HttpRequest, and Payments.

## Non-goals

- No tRPC changes
- No changes to any router files
- No new services (Fogbender secret is accessed via `serverEnv` directly)
