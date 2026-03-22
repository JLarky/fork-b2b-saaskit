import { Data } from 'effect';

export class Unauthorized extends Data.TaggedError('Unauthorized')<{
	message: string;
}> {}

export class Forbidden extends Data.TaggedError('Forbidden')<{
	message: string;
}> {}

export class NotFound extends Data.TaggedError('NotFound')<{
	message: string;
}> {}

export class RateLimited extends Data.TaggedError('RateLimited')<{
	message: string;
	resetsAt: Date;
}> {}
