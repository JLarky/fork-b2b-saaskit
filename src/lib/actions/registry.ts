import type { z } from 'zod';

import { createPrompt } from './create-prompt';
import type { Action, ActionContext } from './define-action';
import { getPrompt } from './get-prompt';
import { listPrompts } from './list-prompts';

export type AnyAction = Action<z.ZodObject<z.ZodRawShape>, unknown>;

/** Prompt operations exposed to both tRPC and `/mcp`. */
export const actions = [listPrompts, getPrompt, createPrompt] as const;

const seen = new Set<string>();
for (const action of actions) {
	if (seen.has(action.name)) {
		throw new Error(`Duplicate action name "${action.name}".`);
	}
	seen.add(action.name);
}

export function actionContext(args: {
	user: ActionContext['user'];
	orgId: string | undefined;
	requestUrl: string;
}): ActionContext {
	return {
		user: args.user,
		orgId: args.orgId,
		origin: new URL(args.requestUrl).origin,
	};
}
