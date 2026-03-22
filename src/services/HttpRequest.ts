import { Context } from 'effect';

export interface RequestContext {
	req: Request;
	resHeaders: Headers;
}

// Per-request: provided by the route handler for each incoming request.
export class HttpRequest extends Context.Tag('HttpRequest')<HttpRequest, RequestContext>() {}
