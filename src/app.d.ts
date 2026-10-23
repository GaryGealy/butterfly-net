// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Db } from '$lib/server/db';
import type { SessionUser } from '$lib/server/auth';

declare global {
	// The single source of truth for the Worker's bindings, read via `import { env } from
	// 'cloudflare:workers'`. `wrangler types` runs with --include-env=false, so it never
	// generates (or bakes .dev.vars secrets into) this interface.
	namespace Cloudflare {
		interface Env {
			DB: D1Database;
			/** Worker secret in production; `.dev.vars` locally. Unset means no Claude. */
			ANTHROPIC_API_KEY?: string;
		}
	}

	namespace App {
		interface Locals {
			user: SessionUser | null;
			db: Db;
		}

		// interface Error {}
		// interface PageData {}
		// interface PageState {}
	}
}

export {};
