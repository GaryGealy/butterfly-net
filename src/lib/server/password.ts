const ITERATIONS = 100_000; // the maximum Workers' Web Crypto supports
const SALT_BYTES = 16;
const KEY_BITS = 256;
const PREFIX = 'pbkdf2v1:';

const toHex = (bytes: Uint8Array) =>
	Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex: string) =>
	new Uint8Array((hex.match(/.{2}/g) ?? []).map((byte) => parseInt(byte, 16)));

async function derive(
	password: string,
	salt: Uint8Array<ArrayBuffer>,
	iterations: number
): Promise<Uint8Array> {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(password),
		'PBKDF2',
		false,
		['deriveBits']
	);
	const bits = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
		key,
		KEY_BITS
	);
	return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
	const hash = await derive(password, salt, ITERATIONS);
	return `${PREFIX}${ITERATIONS}:${toHex(salt)}:${toHex(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	if (!stored.startsWith(PREFIX)) return false;
	const parts = stored.slice(PREFIX.length).split(':');
	if (parts.length !== 3) return false;
	const [iterations, saltHex, hashHex] = parts;
	const expected = fromHex(hashHex);
	const actual = await derive(password, fromHex(saltHex), Number(iterations));

	// Constant-time comparison
	if (actual.length !== expected.length) return false;
	let diff = 0;
	for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
	return diff === 0;
}
