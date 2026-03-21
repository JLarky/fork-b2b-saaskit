import { Data } from 'effect';

export class Unauthorized extends Data.TaggedError('Unauthorized')<{
	message: string;
	cause?: unknown;
}> {}

export class Forbidden extends Data.TaggedError('Forbidden')<{
	message: string;
}> {}

export class NotFound extends Data.TaggedError('NotFound')<{
	message: string;
}> {}

export class BadRequest extends Data.TaggedError('BadRequest')<{
	message: string;
	zodError?: unknown;
}> {}

export class InternalError extends Data.TaggedError('InternalError')<{
	message: string;
}> {}

export class TooManyRequests extends Data.TaggedError('TooManyRequests')<{
	message: string;
}> {}

export type ApiError = Unauthorized | Forbidden | NotFound | BadRequest | InternalError | TooManyRequests;

export function errorToHttpStatus(error: ApiError): number {
	switch (error._tag) {
		case 'Unauthorized':
			return 401;
		case 'Forbidden':
			return 403;
		case 'NotFound':
			return 404;
		case 'BadRequest':
			return 400;
		case 'TooManyRequests':
			return 429;
		case 'InternalError':
			return 500;
	}
}

export function errorToCode(error: ApiError): string {
	switch (error._tag) {
		case 'Unauthorized':
			return 'UNAUTHORIZED';
		case 'Forbidden':
			return 'FORBIDDEN';
		case 'NotFound':
			return 'NOT_FOUND';
		case 'BadRequest':
			return 'BAD_REQUEST';
		case 'TooManyRequests':
			return 'TOO_MANY_REQUESTS';
		case 'InternalError':
			return 'INTERNAL_SERVER_ERROR';
	}
}
