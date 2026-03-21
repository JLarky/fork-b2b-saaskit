import type { User } from '@propelauth/node';
import { Context } from 'effect';

export class RequestCtx extends Context.Tag('@app/RequestCtx')<
	RequestCtx,
	{
		req: Request;
		resHeaders: Headers;
	}
>() {}

export class ApiCtx extends Context.Tag('@app/ApiCtx')<
	ApiCtx,
	{
		req: Request;
		resHeaders: Headers;
		parsedCookies: Record<string, string>;
		accessToken: string | undefined;
		userOrgId: string | undefined;
		userPromise: () => Promise<
			{ kind: 'ok'; user: User } | { kind: 'error'; error: unknown }
		>;
	}
>() {}

export class AuthCtx extends Context.Tag('@app/AuthCtx')<
	AuthCtx,
	{
		user: User;
	}
>() {}

export class OrgCtx extends Context.Tag('@app/OrgCtx')<
	OrgCtx,
	{
		requiredOrgId: string;
	}
>() {}
