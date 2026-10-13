import type { User } from '@propelauth/node';
import type { z } from 'zod';
import { ZodError } from 'zod';

/**
 * One operation, defined once: a description, a Zod schema, and `run`.
 * The app's tRPC procedures and the `/mcp` tools both call `run`.
 *
 * This is the small slice of Builder.io's Agent-Native `defineAction` that
 * fits this kit. `@agent-native/core` itself is not a dependency — it expects
 * React 19, Nitro, and Better Auth.
 */
export type ActionContext = {
	/** Signed-in user. Public reads may omit it. */
	user: User | undefined;
	/** Active organization. Org-scoped actions require it. */
	orgId: string | undefined;
	/** Origin used for share links, without a trailing path. */
	origin: string;
};

export type ActionErrorCode = 'BAD_REQUEST' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND';

export class ActionError extends Error {
	readonly code: ActionErrorCode;

	constructor(code: ActionErrorCode, message: string) {
		super(message);
		this.name = 'ActionError';
		this.code = code;
	}
}

export type Action<TSchema extends z.ZodObject<z.ZodRawShape>, TResult> = {
	name: string;
	description: string;
	schema: TSchema;
	readOnly: boolean;
	run: (input: unknown, ctx: ActionContext) => Promise<TResult>;
};

const ACTION_NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export function defineAction<TSchema extends z.ZodObject<z.ZodRawShape>, TResult>(options: {
	name: string;
	description: string;
	schema: TSchema;
	/** Reads do not create or modify prompts. MCP advertises this as readOnlyHint. */
	readOnly?: boolean;
	run: (input: z.infer<TSchema>, ctx: ActionContext) => Promise<TResult>;
}): Action<TSchema, TResult> {
	if (!ACTION_NAME.test(options.name)) {
		throw new Error(`Action name "${options.name}" must be kebab-case.`);
	}
	if (!options.description.trim()) {
		throw new Error(`Action "${options.name}" needs a description.`);
	}

	return {
		name: options.name,
		description: options.description,
		schema: options.schema,
		readOnly: options.readOnly ?? false,
		async run(input, ctx) {
			const parsed = options.schema.parse(input === undefined ? {} : input);
			return options.run(parsed, ctx);
		},
	};
}

export function actionErrorMessage(error: unknown): string | undefined {
	if (error instanceof ActionError) return error.message;
	if (error instanceof ZodError) {
		return error.issues
			.map((issue) => `${issue.path.join('.') || 'input'}: ${issue.message}`)
			.join('; ');
	}
	return undefined;
}
