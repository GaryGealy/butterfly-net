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
