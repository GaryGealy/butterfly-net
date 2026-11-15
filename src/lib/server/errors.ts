export class NotFoundError extends Error {
	constructor(what: string) {
		super(`${what} not found`);
		this.name = 'NotFoundError';
	}
}

export class PileNotEmptyError extends Error {
	cardCount: number;
	constructor(cardCount: number) {
		super(`Pile still has ${cardCount} card(s)`);
		this.name = 'PileNotEmptyError';
		this.cardCount = cardCount;
	}
}

export class DuplicatePileError extends Error {
	constructor(name: string) {
		super(`A pile named "${name}" already exists`);
		this.name = 'DuplicatePileError';
	}
}

export class LastPileError extends Error {
	constructor() {
		super('You need at least one pile');
		this.name = 'LastPileError';
	}
}

/**
 * Runs a write that depends on rows read earlier. A foreign-key failure means another request
 * deleted one of them in between, so it surfaces as NotFoundError rather than a 500.
 */
export async function notFoundIfGone<T>(write: Promise<T>, what: string): Promise<T> {
	try {
		return await write;
	} catch (e) {
		for (let err: unknown = e; err instanceof Error; err = err.cause) {
			if (err.message.includes('FOREIGN KEY constraint failed')) throw new NotFoundError(what);
		}
		throw e;
	}
}
