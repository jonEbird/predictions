/**
 * Placeholder substitution for admin-composed messages.
 *
 * Admins write one message with {name}-style placeholders and each recipient gets
 * their own rendered copy. Values are HTML-escaped by default because they come
 * from user records — a nickname containing "<" would otherwise break the email.
 */

export type TemplateVars = {
	name: string;
	nickname: string;
	game_url: string;
	site_url: string;
};

/** The placeholders an admin can use, for the compose-form help text. */
export const TEMPLATE_PLACEHOLDERS: Array<{ key: keyof TemplateVars; describes: string }> = [
	{ key: 'name', describes: 'full name' },
	{ key: 'nickname', describes: 'nick name or fallback to first name' },
	{ key: 'game_url', describes: 'upcoming, next game' },
	{ key: 'site_url', describes: "this site's domain" }
];

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/**
 * Replace {placeholder} tokens in `template`.
 *
 * Unknown placeholders are left untouched rather than blanked, so a typo like
 * {nickmame} is visible in the preview instead of silently vanishing.
 */
export function renderTemplate(
	template: string,
	vars: TemplateVars,
	options: { escape?: boolean } = {}
): string {
	const escape = options.escape ?? true;
	return template.replace(/\{(\w+)\}/g, (match, key: string) => {
		if (!(key in vars)) return match;
		const value = vars[key as keyof TemplateVars] ?? '';
		return escape ? escapeHtml(value) : value;
	});
}

/** Placeholders present in a template that aren't ones we substitute. */
export function unknownPlaceholders(template: string): string[] {
	const known = new Set(TEMPLATE_PLACEHOLDERS.map((p) => p.key as string));
	const found = new Set<string>();
	for (const [, key] of template.matchAll(/\{(\w+)\}/g)) {
		if (!known.has(key)) found.add(key);
	}
	return [...found];
}
