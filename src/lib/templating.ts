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
	opponent: string;
	game_url: string;
	site_url: string;
};

/** Placeholders whose value is a URL, so `{key|label}` renders as a link. */
const LINKABLE = new Set<keyof TemplateVars>(['game_url', 'site_url']);

/** The placeholders an admin can use, for the compose-form help text. */
export const TEMPLATE_PLACEHOLDERS: Array<{ key: keyof TemplateVars; describes: string }> = [
	{ key: 'name', describes: 'full name' },
	{ key: 'nickname', describes: 'nick name or fallback to first name' },
	{ key: 'opponent', describes: "next game's opponent" },
	{ key: 'game_url', describes: 'upcoming, next game' },
	{ key: 'site_url', describes: "this site's domain" }
];

/** Matches `{key}` with no label. */
const SIMPLE = /\{(\w+)\}/g;
/** Matches `{key|label}`. The label excludes braces, so inner placeholders must
 * already have been substituted -- see the two passes below. */
const LABELLED = /\{(\w+)\|([^{}]*)\}/g;

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
	const out = (value: string) => (escape ? escapeHtml(value) : value);

	// Two passes so `{game_url|pick against {opponent}}` works: simple
	// placeholders resolve first, leaving the label brace-free to match below.
	const text = template.replace(SIMPLE, (match, key: string) => {
		if (!(key in vars)) return match;
		return out(vars[key as keyof TemplateVars] ?? '');
	});

	// A labelled URL can't be an anchor in plain text, so show both.
	return text.replace(LABELLED, (match, key: string, label: string) => {
		if (!(key in vars)) return match;
		const value = out(vars[key as keyof TemplateVars] ?? '');
		return LINKABLE.has(key as keyof TemplateVars) ? `${label} (${value})` : value;
	});
}

/** Placeholders present in a template that aren't ones we substitute. */
export function unknownPlaceholders(template: string): string[] {
	const known = new Set(TEMPLATE_PLACEHOLDERS.map((p) => p.key as string));
	const found = new Set<string>();
	for (const [, key] of template.matchAll(/\{(\w+)(?:\|[^{}]*)?\}/g)) {
		if (!known.has(key)) found.add(key);
	}
	return [...found];
}

/**
 * Wrap a bare URL in an anchor. The URL is already HTML-escaped.
 *
 * The colour is inline rather than only in the stylesheet because many mail
 * clients strip <style> blocks -- and because an inline style outranks a client's
 * default a:visited rule, so a link the reader has already followed stays blue
 * instead of turning purple.
 */
function link(url: string, label = url): string {
	return `<a href="${url}" style="color:#1d4ed8;text-decoration:underline;">${label}</a>`;
}

/**
 * Render an admin-composed message as the HTML body of an email.
 *
 * The message is plain text the admin typed, so it is escaped first and all
 * markup below is ours. Formatting rules, in order:
 *   - a blank line starts a new paragraph; a single newline is a line break
 *   - leading spaces are preserved, so an indented first line still indents
 *   - {name} / {nickname} are emphasised, so the personalisation reads as such
 *   - {game_url} / {site_url} and any bare URL become clickable links
 *   - {game_url|label} links with `label` as the anchor text, and the label may
 *     itself contain placeholders, e.g. {game_url|pick against {opponent}}
 */
export function renderMessageHtml(template: string, vars: TemplateVars): string {
	// Escaping first is safe for placeholders: {}, | and word characters are
	// untouched, and it means every tag below is ours.
	let text = escapeHtml(template);

	// Auto-link URLs the admin typed before placeholders are substituted, so the
	// substituted URLs aren't matched twice.
	text = text.replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)\]}]/g, (url) => link(url));

	// Pass 1: simple placeholders. Runs first so a label's inner placeholders
	// resolve before the labelled pass needs a brace-free label.
	text = text.replace(SIMPLE, (match, key: string) => {
		if (!(key in vars)) return match;
		const value = escapeHtml(vars[key as keyof TemplateVars] ?? '');
		if (key === 'name' || key === 'nickname') return `<strong>${value}</strong>`;
		if (LINKABLE.has(key as keyof TemplateVars)) return link(value);
		return value;
	});

	// Pass 2: labelled links. The label is already escaped from the step above.
	text = text.replace(LABELLED, (match, key: string, label: string) => {
		if (!(key in vars)) return match;
		const value = escapeHtml(vars[key as keyof TemplateVars] ?? '');
		if (!LINKABLE.has(key as keyof TemplateVars)) return value;
		return link(value, label);
	});

	const paragraphs = text
		.split(/\n\s*\n/)
		.map((block) => block.replace(/\n+$/, ''))
		.filter((block) => block.trim() !== '');

	return paragraphs
		.map((block) => {
			// Preserve the indent of each line; HTML would otherwise collapse it.
			const lines = block.split('\n').map((line) => {
				const indent = line.match(/^[ \t]*/)?.[0] ?? '';
				const spaces = indent.replace(/\t/g, '    ').length;
				return '&nbsp;'.repeat(spaces) + line.slice(indent.length);
			});
			return `<p style="margin:0 0 1em;">${lines.join('<br>')}</p>`;
		})
		.join('\n');
}
