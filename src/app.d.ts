// See https://svelte.dev/docs/kit/types#app.d.ts
import type { User } from '$lib/db/schema';

declare global {
	namespace App {
		interface Error {}
		interface Locals {
			user?: User;
		}
		interface PageData {}
		interface PageState {}
		interface Platform {}
	}
}

export {};
