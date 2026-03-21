import { dehydrate, QueryClient } from '@tanstack/react-query';
import type { AstroGlobal } from 'astro';
import { Effect, Layer, pipe } from 'effect';
import superjson from 'superjson';

import { RequestCtx } from './context';
import { type ApiError, errorToCode, errorToHttpStatus } from './errors';
import { ApiLayer, AuthLayer, orgLayer } from './middleware';
import { authSync } from './procedures/auth';
import { getCount, hello, increment } from './procedures/hello';
import {
	createPrompt,
	deletePrompt,
	getDefaultKey,
	getPrompt,
	getPrompts,
	getPublicPrompts,
	likePrompt,
	runPrompt,
	updatePrompt,
} from './procedures/prompts';
import { createKey, deleteKey, getKeys, getSubscriptions, stripeConfigured } from './procedures/settings';
import { getPublic, postSurvey } from './procedures/surveys';

type ProcedureType = 'query' | 'mutation';

interface ProcedureDef {
	type: ProcedureType;
	middleware: 'public' | 'api' | 'auth' | 'org';
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	handler: (input: any) => Effect.Effect<any, any, any>;
}

function buildHandler(
	def: ProcedureDef,
	input: unknown,
	requestCtx: { req: Request; resHeaders: Headers }
) {
	const requestLayer = Layer.succeed(RequestCtx, requestCtx);

	if (def.middleware === 'public') {
		return def.handler(input) as Effect.Effect<unknown, unknown, never>;
	}

	if (def.middleware === 'api') {
		const layers = pipe(ApiLayer, Layer.provide(requestLayer));
		return Effect.provide(def.handler(input), layers) as Effect.Effect<unknown, unknown, never>;
	}

	if (def.middleware === 'auth') {
		const apiLayer = pipe(ApiLayer, Layer.provide(requestLayer));
		const authLayer = pipe(AuthLayer, Layer.provide(apiLayer));
		const layers = Layer.merge(apiLayer, authLayer);
		return Effect.provide(def.handler(input), layers) as Effect.Effect<unknown, unknown, never>;
	}

	// 'org'
	const apiLayer = pipe(ApiLayer, Layer.provide(requestLayer));
	const authLayer = pipe(AuthLayer, Layer.provide(apiLayer));
	const orgLyr = pipe(orgLayer(input as Record<string, unknown>), Layer.provide(authLayer), Layer.provide(apiLayer));
	const layers = Layer.merge(Layer.merge(apiLayer, authLayer), orgLyr);
	return Effect.provide(def.handler(input), layers) as Effect.Effect<unknown, unknown, never>;
}

const procedures: Record<string, ProcedureDef> = {
	'hello.hello': {
		type: 'query',
		middleware: 'api',
		handler: () => hello,
	},
	'hello.getCount': {
		type: 'query',
		middleware: 'public',
		handler: () => getCount,
	},
	'hello.increment': {
		type: 'mutation',
		middleware: 'public',
		handler: () => increment,
	},
	'auth.authSync': {
		type: 'mutation',
		middleware: 'api',
		handler: (input) => authSync(input),
	},
	'prompts.getPrompt': {
		type: 'query',
		middleware: 'api',
		handler: (input) => getPrompt(input),
	},
	'prompts.getPrompts': {
		type: 'query',
		middleware: 'org',
		handler: () => getPrompts,
	},
	'prompts.getPublicPrompts': {
		type: 'query',
		middleware: 'public',
		handler: () => getPublicPrompts,
	},
	'prompts.updatePrompt': {
		type: 'mutation',
		middleware: 'org',
		handler: (input) => updatePrompt(input),
	},
	'prompts.createPrompt': {
		type: 'mutation',
		middleware: 'org',
		handler: (input) => createPrompt(input),
	},
	'prompts.deletePrompt': {
		type: 'mutation',
		middleware: 'auth',
		handler: (input) => deletePrompt(input),
	},
	'prompts.runPrompt': {
		type: 'mutation',
		middleware: 'org',
		handler: (input) => runPrompt(input),
	},
	'prompts.getDefaultKey': {
		type: 'query',
		middleware: 'auth',
		handler: () => getDefaultKey,
	},
	'prompts.likePrompt': {
		type: 'mutation',
		middleware: 'auth',
		handler: (input) => likePrompt(input),
	},
	'settings.stripeConfigured': {
		type: 'query',
		middleware: 'org',
		handler: () => stripeConfigured,
	},
	'settings.getSubscriptions': {
		type: 'query',
		middleware: 'org',
		handler: () => getSubscriptions,
	},
	'settings.getKeys': {
		type: 'query',
		middleware: 'org',
		handler: () => getKeys,
	},
	'settings.createKey': {
		type: 'mutation',
		middleware: 'org',
		handler: (input) => createKey(input),
	},
	'settings.deleteKey': {
		type: 'mutation',
		middleware: 'auth',
		handler: (input) => deleteKey(input),
	},
	'surveys.getPublic': {
		type: 'query',
		middleware: 'public',
		handler: () => getPublic,
	},
	'surveys.postSurvey': {
		type: 'mutation',
		middleware: 'public',
		handler: (input) => postSurvey(input),
	},
};

export async function handleRpc(
	procedure: string,
	input: unknown,
	requestCtx: { req: Request; resHeaders: Headers }
): Promise<Response> {
	const def = procedures[procedure];
	if (!def) {
		return new Response(
			JSON.stringify({ error: { code: 'NOT_FOUND', message: `Procedure ${procedure} not found` } }),
			{ status: 404, headers: { 'content-type': 'application/json' } }
		);
	}

	const effect = buildHandler(def, input, requestCtx);
	try {
		const result = await Effect.runPromise(effect);
		const serialized = superjson.serialize(result);
		return new Response(JSON.stringify({ result: serialized }), {
			status: 200,
			headers: requestCtx.resHeaders,
		});
	} catch (error) {
		if (isApiError(error)) {
			const code = errorToCode(error);
			const httpStatus = errorToHttpStatus(error);
			const body: Record<string, unknown> = { code, message: error.message };
			if ('zodError' in error && error.zodError) {
				body.zodError = error.zodError;
			}
			return new Response(JSON.stringify({ error: body }), {
				status: httpStatus,
				headers: { 'content-type': 'application/json' },
			});
		}
		if (import.meta.env.DEV) {
			console.error('Unhandled error in procedure', procedure, error);
		}
		return new Response(
			JSON.stringify({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' } }),
			{ status: 500, headers: { 'content-type': 'application/json' } }
		);
	}
}

function isApiError(error: unknown): error is ApiError {
	return (
		error !== null &&
		typeof error === 'object' &&
		'_tag' in error &&
		typeof (error as { _tag: string })._tag === 'string'
	);
}

// Server-side caller for direct invocation (SSR)
export async function callProcedure<T = unknown>(
	procedure: string,
	input: unknown,
	requestCtx: { req: Request; resHeaders: Headers }
): Promise<T> {
	const def = procedures[procedure];
	if (!def) {
		throw new Error(`Procedure ${procedure} not found`);
	}
	const effect = buildHandler(def, input, requestCtx);
	return (await Effect.runPromise(effect)) as T;
}

export function createCaller(ctx: { req: Request; resHeaders: Headers }) {
	const call = <T>(procedure: string, input?: unknown) =>
		callProcedure<T>(procedure, input, ctx);

	return {
		hello: {
			hello: () => call<string>('hello.hello'),
			getCount: () => call<number>('hello.getCount'),
			increment: () => call<number>('hello.increment'),
		},
		auth: {
			authSync: (input: unknown) => call<string>('auth.authSync', input),
		},
		prompts: {
			getPrompt: (input: { promptId: string }) => call('prompts.getPrompt', input),
			getPrompts: (input?: { orgId?: string }) => call('prompts.getPrompts', input),
			getPublicPrompts: () => call('prompts.getPublicPrompts'),
			updatePrompt: (input: unknown) => call<string>('prompts.updatePrompt', input),
			createPrompt: (input: unknown) => call<string>('prompts.createPrompt', input),
			deletePrompt: (input: unknown) => call('prompts.deletePrompt', input),
			runPrompt: (input: unknown) => call('prompts.runPrompt', input),
			getDefaultKey: () => call('prompts.getDefaultKey'),
			likePrompt: (input: unknown) => call('prompts.likePrompt', input),
		},
		settings: {
			stripeConfigured: (input?: { orgId?: string }) => call<boolean>('settings.stripeConfigured', input),
			getSubscriptions: (input?: { orgId?: string }) => call('settings.getSubscriptions', input),
			getKeys: (input?: { orgId?: string }) => call('settings.getKeys', input),
			createKey: (input: unknown) => call('settings.createKey', input),
			deleteKey: (input: unknown) => call('settings.deleteKey', input),
		},
		surveys: {
			getPublic: () => call('surveys.getPublic'),
			postSurvey: (input: unknown) => call('surveys.postSurvey', input),
		},
	};
}

export function createHelpers(astro: AstroGlobal) {
	const ctx = { req: astro.request, resHeaders: astro.response.headers };
	const queryClient = new QueryClient();

	const createHelper = (procedure: string) => ({
		fetch: async (input?: unknown) => {
			const result = await callProcedure(procedure, input, ctx);
			queryClient.setQueryData([procedure, input], result);
			return result;
		},
		prefetch: async (input?: unknown) => {
			try {
				const result = await callProcedure(procedure, input, ctx);
				queryClient.setQueryData([procedure, input], result);
			} catch {
				// prefetch errors are silently ignored
			}
		},
	});

	return {
		hello: {
			hello: createHelper('hello.hello'),
		},
		prompts: {
			getPrompt: createHelper('prompts.getPrompt'),
			getPrompts: createHelper('prompts.getPrompts'),
			getPublicPrompts: createHelper('prompts.getPublicPrompts'),
		},
		settings: {
			getKeys: createHelper('settings.getKeys'),
		},
		dehydrate: () => dehydrate(queryClient),
	};
}

export type Helpers = ReturnType<typeof createHelpers>;
