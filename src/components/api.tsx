import {
	type DehydratedState,
	Hydrate,
	QueryClient,
	useMutation,
	useQuery,
	useQueryClient,
} from '@tanstack/react-query';
import { useState } from 'react';
import superjson from 'superjson';

import { QueryProvider } from './client';

// Error type that matches the shape components expect (compatible with tRPC error shape)
/* oxlint-disable react/only-export-components */
export class ApiError extends Error {
	data?: {
		code?: string;
		zodError?: unknown;
	};

	constructor(info: { message: string; code?: string; zodError?: unknown }) {
		super(info.message);
		this.name = 'ApiError';
		this.data = { code: info.code, zodError: info.zodError };
	}
}

async function rpcFetch<T>(procedure: string, method: 'GET' | 'POST', input?: unknown): Promise<T> {
	let response: Response;
	if (method === 'GET') {
		const url = new URL(`/api/rpc/${procedure}`, window.location.origin);
		if (input !== undefined && input !== null) {
			url.searchParams.set('input', JSON.stringify(input));
		}
		response = await fetch(url.toString());
	} else {
		response = await fetch(`/api/rpc/${procedure}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: input !== undefined ? JSON.stringify(input) : undefined,
		});
	}
	const json = await response.json();
	if (json.error) {
		throw new ApiError({
			message: json.error.message || 'Unknown error',
			code: json.error.code,
			zodError: json.error.zodError,
		});
	}
	return superjson.deserialize(json.result) as T;
}

function createQueryProcedure<TInput, TOutput>(procedure: string) {
	const queryKeyFn = (input?: TInput) =>
		input !== undefined ? [procedure, input] : [procedure];

	return {
		useQuery(
			input: TInput,
			opts?: {
				enabled?: boolean;
				staleTime?: number;
				retry?: boolean | number | ((failureCount: number, error: ApiError) => boolean);
			}
		) {
			return useQuery<TOutput, ApiError>(
				[procedure, input],
				() => rpcFetch<TOutput>(procedure, 'GET', input),
				opts as never
			);
		},
		queryKey: queryKeyFn,
	};
}

function createMutationProcedure<TInput, TOutput>(procedure: string) {
	return {
		useMutation(opts?: {
			onSuccess?: (data: TOutput, variables: TInput, context: unknown) => void;
			onError?: (error: ApiError, variables: TInput, context: unknown) => void;
			onSettled?: (
				data: TOutput | undefined,
				error: ApiError | null,
				variables: TInput,
				context: unknown
			) => void;
			onMutate?: (variables: TInput) => unknown;
		}) {
			return useMutation<TOutput, ApiError, TInput>(
				(input: TInput) => rpcFetch<TOutput>(procedure, 'POST', input),
				opts as never
			);
		},
	};
}

// Type aliases for procedure outputs (inferred from server handlers)
// These keep the same shape as what tRPC inferred
type GetPromptOutput = {
	canEdit: boolean;
	likes: number;
	myLike: boolean;
	prompt: {
		promptId: string;
		userId: string;
		orgId: string;
		privacyLevel: string;
		title: string;
		description: string;
		createdAt: Date;
		updatedAt: Date;
		template: { role: 'user' | 'assistant' | 'system'; content: string }[];
		tags: string[];
	};
	author: { name?: string; email?: string } | undefined;
	shareUrl: string;
	publicUrl: string;
};

type GetPromptsItem = {
	promptId: string;
	userId: string;
	title: string;
	isPublic: boolean;
	_meta: { user: { name?: string; email?: string } | undefined };
};

type GetPublicPromptsItem = {
	promptId: string;
	title: string;
	isPublic: boolean;
};

type KeyItem = {
	keyId: number;
	keyType: string;
	createdAt: Date;
	lastUsedAt: Date | null;
	keyPublic: string;
	isShared: boolean;
};

type SubscriptionItem = {
	email: string;
	active: boolean;
	cancelAtEpochSec?: number;
	portalUrl?: string;
};

type SurveyItem = {
	id: number;
	rating: number;
	comments: string | null;
	createdAt: Date;
};

type DefaultKeyOutput =
	| { isSet: true; canUse: boolean; requestsRemaining: number; resetsAt: Date }
	| { isSet: false };

type RunPromptOutput = { message: string } | { error: string };

export const api = {
	hello: {
		hello: createQueryProcedure<void, string>('hello.hello'),
		getCount: createQueryProcedure<void, number>('hello.getCount'),
		increment: createMutationProcedure<void, number>('hello.increment'),
	},
	auth: {
		authSync: createMutationProcedure<
			{ isLoggedIn: boolean; accessToken?: string; orgId: string },
			string
		>('auth.authSync'),
	},
	prompts: {
		getPrompt: createQueryProcedure<{ promptId: string }, GetPromptOutput>('prompts.getPrompt'),
		getPrompts: createQueryProcedure<{ orgId?: string } | Record<string, never>, GetPromptsItem[]>(
			'prompts.getPrompts'
		),
		getPublicPrompts: createQueryProcedure<void, GetPublicPromptsItem[]>('prompts.getPublicPrompts'),
		updatePrompt: createMutationProcedure<
			{
				promptId: string;
				title?: string;
				description?: string;
				tags: string[];
				template: { role: string; content: string }[];
				privacyLevel: string;
				orgId?: string;
			},
			string
		>('prompts.updatePrompt'),
		createPrompt: createMutationProcedure<
			{
				title?: string;
				description?: string;
				tags: string[];
				template: { role: string; content: string }[];
				privacyLevel: string;
				orgId?: string;
			},
			string
		>('prompts.createPrompt'),
		deletePrompt: createMutationProcedure<{ promptId: string }, { promptId: string }>(
			'prompts.deletePrompt'
		),
		runPrompt: createMutationProcedure<
			{ messages: { role: string; content: string }[]; orgId?: string },
			RunPromptOutput
		>('prompts.runPrompt'),
		getDefaultKey: createQueryProcedure<void, DefaultKeyOutput>('prompts.getDefaultKey'),
		likePrompt: createMutationProcedure<
			{ promptId: string; unlike?: boolean },
			{ promptId: string; unlike?: boolean }
		>('prompts.likePrompt'),
	},
	settings: {
		stripeConfigured: createQueryProcedure<{ orgId?: string } | Record<string, never>, boolean>(
			'settings.stripeConfigured'
		),
		getSubscriptions: createQueryProcedure<
			{ orgId?: string } | Record<string, never>,
			SubscriptionItem[]
		>('settings.getSubscriptions'),
		getKeys: createQueryProcedure<{ orgId?: string } | Record<string, never>, KeyItem[]>(
			'settings.getKeys'
		),
		createKey: createMutationProcedure<
			{ keySecret: string; keyType: 'gpt-3' | 'gpt-4'; orgId?: string },
			number
		>('settings.createKey'),
		deleteKey: createMutationProcedure<{ keyId: number }, { keyId: number }>(
			'settings.deleteKey'
		),
	},
	surveys: {
		getPublic: createQueryProcedure<void, SurveyItem[]>('surveys.getPublic'),
		postSurvey: createMutationProcedure<
			{ rating: number | string; is_public?: 'on'; comments?: string },
			number
		>('surveys.postSurvey'),
	},
};

// Utilities hook (replacement for trpc.useContext())
export function useApiUtils() {
	const queryClient = useQueryClient();

	function createProcUtils<TInput, TOutput>(procedure: string) {
		return {
			invalidate: (input?: TInput) => queryClient.invalidateQueries([procedure, input]),
			setData: (input: TInput, updater: TOutput | ((old: TOutput | undefined) => TOutput | undefined)) => {
				if (typeof updater === 'function') {
					queryClient.setQueryData([procedure, input], updater as never);
				} else {
					queryClient.setQueryData([procedure, input], updater);
				}
			},
			getData: (input?: TInput) => queryClient.getQueryData<TOutput>([procedure, input]),
			cancel: (input?: TInput) => queryClient.cancelQueries([procedure, input]),
			ensureData: (input: TInput) =>
				queryClient.ensureQueryData({
					queryKey: [procedure, input],
					queryFn: () => rpcFetch<TOutput>(procedure, 'GET', input),
				}),
		};
	}

	return {
		prompts: {
			getPrompt: createProcUtils<{ promptId: string }, GetPromptOutput>('prompts.getPrompt'),
			getPrompts: createProcUtils<Record<string, never>, GetPromptsItem[]>('prompts.getPrompts'),
		},
		settings: {
			getKeys: createProcUtils<Record<string, never>, KeyItem[]>('settings.getKeys'),
		},
	};
}

export type ApiUtils = ReturnType<typeof useApiUtils>;

// Re-export output types for use in components
export type { GetPromptOutput };

// Provider component
export function ApiProvider({
	children,
	dehydratedState,
}: {
	children: React.ReactNode;
	dehydratedState?: DehydratedState;
}) {
	const [queryClient] = useState(() => new QueryClient());
	const state = dehydratedState ? superjson.deserialize(dehydratedState as never) : undefined;
	return (
		<QueryProvider queryClient={queryClient}>
			<Hydrate state={state}>{children}</Hydrate>
		</QueryProvider>
	);
}
