import { Context } from 'effect';

export interface RequestContext {
	req: Request;
	resHeaders: Headers;
}

export class HttpRequest extends Context.Tag('HttpRequest')<HttpRequest, RequestContext>() {}
