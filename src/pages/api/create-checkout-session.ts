import type { APIRoute } from 'astro';
import { Layer } from 'effect';

import { createCheckoutSessionHandler } from '../../handlers/api/createCheckoutSession';
import { runApiHandler } from '../../handlers/api/shared';
import { AuthLive } from '../../services/Auth';
import { PaymentsLive } from '../../services/Payments';

export const prerender = false;

const checkoutSessionLive = Layer.mergeAll(AuthLive, PaymentsLive);

export const POST: APIRoute = ({ request }) =>
	runApiHandler(createCheckoutSessionHandler, request, checkoutSessionLive);
