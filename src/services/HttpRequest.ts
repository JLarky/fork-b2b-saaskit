import { Context, Layer } from 'effect';

export interface HttpRequestContext {
	readonly request: Request;
	readonly resHeaders: Headers;
}

export class HttpRequest extends Context.Tag('HttpRequest')<HttpRequest, HttpRequestContext>() {}

export const HttpRequestTest = (context: HttpRequestContext) => Layer.succeed(HttpRequest, context);
