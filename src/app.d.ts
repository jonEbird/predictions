// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {
		interface Error {}
		interface Locals {
			user?: {
				id: number;
				name: string;
				email: string;
				nickname: string | null;
			};
		}
		interface PageData {}
		interface PageState {}
		interface Platform {}
	}
}

export {};
