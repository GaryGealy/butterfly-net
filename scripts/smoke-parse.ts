// Manual, costs a few cents: runs real captures through Claude and prints what it chose.
// Usage: ANTHROPIC_API_KEY=... npx tsx scripts/smoke-parse.ts
import Anthropic from '@anthropic-ai/sdk';
import { PARSE_MODEL, PARSE_TIMEOUT_MS, parseCapture } from '../src/lib/server/parse/parse';

if (!process.env.ANTHROPIC_API_KEY) {
	console.error(
		'ANTHROPIC_API_KEY is not set; every capture would just fall back. Set it and rerun.'
	);
	process.exit(1);
}

const piles = ['house', 'work stuff', 'ideas', 'video games', 'model building'].map((name, i) => ({
	id: String(i),
	name
}));

// Typed-style first, then dictated-style (run-on, filler, no punctuation, a misheard word).
const samples = [
	'fix the squeaky hinge on the back door',
	'get resin and a 0.3mm drill bit for the x-wing',
	'send Q3 numbers to Dana before friday',
	'replace furnace filter',
	'paint the fence: scrape, prime, two coats',
	'order more primer',
	'update my resume',
	'um so I need to call the insurance guy about the roof because I think the storm last week took some shingles off',
	'remind me to finish the water temple before the DLC drops which is I think the end of the month',
	'so I was thinking what if there was an app that turns index cards into a to do list kind of like this one actually',
	'try an oil wash on the AT AT legs and maybe some pigment powder on the feet for dust',
	'ask about the team off site budget like how much we have and whether it covers travel',
	'look into a co op game for game night something four people can play that is not too long',
	'what if the newsletter was audio only you know like a little podcast',
	'plant tomatoes along the south fence and get some cages and fertilizer for them'
];

const client = new Anthropic();
let fallbacks = 0;
for (const text of samples) {
	const started = performance.now();
	const result = await parseCapture(client, text, piles);
	const ms = Math.round(performance.now() - started);
	if (result.source === 'fallback') fallbacks++;
	const pile = result.pile
		? `${result.pile.name}${result.pile.kind === 'new' ? ' (new)' : ''}`
		: '—';
	console.log(
		`${String(ms).padStart(5)}ms  ${result.source.padEnd(8)}  ${pile.padEnd(22)}  ${result.title}`
	);
}
console.log(
	`\n${PARSE_MODEL}: ${fallbacks}/${samples.length} fell back (timeout is ${PARSE_TIMEOUT_MS}ms).`
);
