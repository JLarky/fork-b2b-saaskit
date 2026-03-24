import { apiProcedure, publicProcedure } from '../trpc';

let i = 0;

export const helloRouter = {
	hello: apiProcedure.handler(async ({ context }) => {
		const res = await context.userPromise;
		if (res.kind === 'ok') {
			return `Oh, so cool, you are already signed in! ${res.user.userId}`;
		}

		return 'Something from the server';
	}),
	getCount: publicProcedure.handler(async () => {
		return i;
	}),
	increment: publicProcedure.handler(async () => {
		return ++i;
	}),
};
