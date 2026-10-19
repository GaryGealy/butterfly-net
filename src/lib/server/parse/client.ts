import Anthropic from '@anthropic-ai/sdk';
import { dev } from '$app/env';
import { fakeParseClient } from './fake-client';

/** The real Claude client, the e2e fake (dev + FAKE_CLAUDE=1), or null when no key is set. */
export function getParseClient(platformKey?: string): Anthropic | null {
	if (dev && process.env.FAKE_CLAUDE === '1') return fakeParseClient();
	const apiKey = platformKey || process.env.ANTHROPIC_API_KEY;
	return apiKey ? new Anthropic({ apiKey }) : null;
}
