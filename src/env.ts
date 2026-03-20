import { ENV } from 'varlock/env';

export type ServerEnv = {
	DATABASE_URL: string;
	PROPELAUTH_API_KEY: string;
	PROPELAUTH_VERIFIER_KEY: string;
	FOGBENDER_SECRET?: string;
	OPENAI_API_KEY?: string;
	STRIPE_SECRET_KEY?: string;
	STRIPE_PRICE_ID?: string;
	PUBLIC_AUTH_URL: string;
	PUBLIC_FOGBENDER_WIDGET_ID?: string;
	PUBLIC_POSTHOG_KEY?: string;
	DEBUG_OG?: boolean | string;
	VERCEL_ENV?: string;
};

const runtimeEnv = import.meta.env || process.env;

export const shouldSkipEnvValidation =
	!!runtimeEnv.SKIP_ENV_VALIDATION &&
	runtimeEnv.SKIP_ENV_VALIDATION !== 'false' &&
	runtimeEnv.SKIP_ENV_VALIDATION !== '0';

type PickByPrefix<T, TPrefix extends string> = {
	[TKey in keyof T as TKey extends `${TPrefix}${string}` ? TKey : never]: T[TKey];
};

export const serverEnv = (shouldSkipEnvValidation ? runtimeEnv : ENV) as ServerEnv;

export type ClientEnv = PickByPrefix<ServerEnv, 'PUBLIC_'>;
