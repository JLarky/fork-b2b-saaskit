import type { APIRoute } from 'astro';

import { fogbenderHandler } from '../../handlers/api/fogbender';
import { runApiHandler } from '../../handlers/api/shared';
import { AuthLive } from '../../services/Auth';

export const prerender = false;

const fogbenderLive = AuthLive;

export const POST: APIRoute = ({ request }) =>
	runApiHandler(fogbenderHandler, request, fogbenderLive);
