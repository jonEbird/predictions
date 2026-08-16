// See https://svelte.dev/docs/kit/types#app.d.ts
import type { User } from '$lib/db/schema';

declare global {
	namespace App {
		interface Error {}
		interface Locals {
			user?: User;
			/**
			 * Admin opted into seeing the site as an ordinary member. Hides inline
			 * admin UI only — it is a view preference, not a permission change.
			 */
			viewAsMember?: boolean;
		}
		interface PageData {}
		interface PageState {}
		interface Platform {}
	}
}

export {};
