// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Db } from '$lib/server/db';
import type { SessionUser } from '$lib/server/auth';

declare global {
	// Merges with the (currently empty) Env generated in worker-configuration.d.ts
	interface Env {
		DB: D1Database;
		ANTHROPIC_API_KEY: string;
	}

	namespace App {
		interface Locals {
			user: SessionUser | null;
			db: Db;
		}
		interface Platform {
			env: Env;
			ctx: ExecutionContext;
			caches: CacheStorage;
			cf?: IncomingRequestCfProperties;
		}

		// interface Error {}
		// interface PageData {}
		// interface PageState {}
	}
}

export {};
