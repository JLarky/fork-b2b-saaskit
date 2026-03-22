import { Data } from 'effect';

export class Unauthorized extends Data.TaggedError('Unauthorized')<{
	readonly message: string;
}> {}

export class Forbidden extends Data.TaggedError('Forbidden')<{
	readonly message: string;
}> {}

export class NotFound extends Data.TaggedError('NotFound')<{
	readonly message: string;
}> {}

export class RateLimited extends Data.TaggedError('RateLimited')<{
	readonly message: string;
	readonly resetsAt: Date;
}> {}
