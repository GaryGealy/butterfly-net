import Anthropic from '@anthropic-ai/sdk';
import { dev } from '$app/env';
import { fakeParseClient } from './fake-client';

/**
 * The real Claude client, the e2e fake (dev + FAKE_CLAUDE=1), or null when no key is set.
 * The key comes from the Worker env (`cloudflare:workers`): the Worker secret in production,
 * `.dev.vars` under `vite dev`.
 */
export function getParseClient(apiKey: string | undefined): Anthropic | null {
	if (dev && process.env.FAKE_CLAUDE === '1') return fakeParseClient();
	return apiKey ? new Anthropic({ apiKey }) : null;
}
