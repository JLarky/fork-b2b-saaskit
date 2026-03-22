# Phase 1 Implementation Plan: Add Effect, Define Services

## Objective

Introduce Effect into the project and define service interfaces, live layers,
and typed errors. No behavioral change — tRPC procedures continue working
unchanged. The new services exist alongside the current singletons and will be
wired in during Phase 2+.

## Scope

### 1. Project configuration

- `yarn add effect @effect/platform` (done)
- `yarn add -D @effect/language-service` (done)
- Add `@effect/language-service` plugin to `tsconfig.json`

### 2. Typed errors (`src/errors.ts`)

Four error classes using `Data.TaggedError`:

| Class          | Fields                      | Maps to tRPC code   |
| -------------- | --------------------------- | ------------------- |
| `Unauthorized` | `message`                   | `UNAUTHORIZED`      |
| `Forbidden`    | `message`                   | `FORBIDDEN`         |
| `NotFound`     | `message`                   | `NOT_FOUND`         |
| `RateLimited`  | `message`, `resetsAt: Date` | `TOO_MANY_REQUESTS` |

### 3. Service definitions (`src/services/`)

Each service file exports:

- A `Context.Tag` class
- An interface describing the service shape
- A `*Live` layer using real implementations
- (Where applicable) a `*Test` factory for test layers

#### `Database.ts`

- Tag: `Database`
- Shape: `PostgresJsDatabase` (re-export from drizzle-orm)
- Live: `drizzle(postgres(process.env.DATABASE_URL!))`
- Test: accepts a mock drizzle instance

#### `Auth.ts`

- Tag: `Auth`
- Shape: `AuthClient` — subset of PropelAuth `BaseAuthClient`:
  - `validateAccessTokenAndGetUser`
  - `validateAccessTokenAndGetUserWithOrgInfo`
  - `fetchBatchUserMetadataByUserIds`
- Live: `initBaseAuth({...process.env})`
- Test: factory accepting a user map

#### `Payments.ts`

- Tag: `Payments`
- Shape: `PaymentsClient | null` (null when unconfigured)
  - `stripe: Stripe`
  - `priceId: string`
- Live: reads `STRIPE_SECRET_KEY` and `STRIPE_PRICE_ID`
- Test: `Layer.succeed(Payments, null)`

#### `Analytics.ts`

- Tag: `Analytics`
- Shape: `AnalyticsClient`
  - `trackEvent(distinctId, event, properties?) => Effect<void>`
- Live: PostHog implementation
- Test: no-op implementation

#### `HttpRequest.ts`

- Tag: `HttpRequest`
- Shape: `RequestContext` = `{ req: Request; resHeaders: Headers }`
- No live layer (provided per-request)

### 4. Test layers (`src/services/test-layers.ts`)

Central file exporting convenient test-layer factories for use in Vitest.

### 5. Tests (`src/services/*.test.ts`)

Tests verify:

- Service tags are valid Effect Context tags
- Live layers can be constructed (using env-stub patterns)
- Error classes are tagged correctly and carry expected fields
- Test layer factories produce usable layers

### 6. Documentation updates

- Update `docs/tech.md` to document the new `src/services/` directory
- Update `docs/specs/effect-migration.md` Phase 1 status

## Files changed

| File                            | Action                         |
| ------------------------------- | ------------------------------ |
| `package.json`                  | deps added (already done)      |
| `yarn.lock`                     | updated (already done)         |
| `tsconfig.json`                 | add language-service plugin    |
| `src/errors.ts`                 | new — typed error classes      |
| `src/services/Database.ts`      | new — Database service         |
| `src/services/Auth.ts`          | new — Auth service             |
| `src/services/Payments.ts`      | new — Payments service         |
| `src/services/Analytics.ts`     | new — Analytics service        |
| `src/services/HttpRequest.ts`   | new — HttpRequest context      |
| `src/services/index.ts`         | new — barrel export            |
| `src/services/errors.test.ts`   | new — error class tests        |
| `src/services/services.test.ts` | new — service definition tests |
| `docs/tech.md`                  | update — document services dir |

## Non-goals (Phase 1)

- No tRPC procedure changes
- No behavior changes
- No Session/AuthenticatedUser/OrgAccess layers yet (those belong in Phase 2+
  when we start wiring services into actual procedures)
- No removal of existing singletons
