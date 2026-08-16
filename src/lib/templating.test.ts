import { describe, it, expect } from 'vitest';
import {
	renderTemplate,
	renderMessageHtml,
	unknownPlaceholders,
	TEMPLATE_PLACEHOLDERS
} from './templating';

const vars = {
	name: 'Jon Miller',
	nickname: 'jonEbird',
	opponent: 'Ball State',
	game_url: 'https://buckeyepredictions.com/games/204?groupId=16',
	site_url: 'https://buckeyepredictions.com'
};

describe('renderTemplate', () => {
	it('substitutes each supported placeholder', () => {
		expect(renderTemplate('Hi {name} ("{nickname}")', vars)).toBe('Hi Jon Miller ("jonEbird")');
		expect(renderTemplate('Pick here: {game_url}', vars)).toBe(
			'Pick here: https://buckeyepredictions.com/games/204?groupId=16'
		);
		expect(renderTemplate('{site_url}', vars)).toBe('https://buckeyepredictions.com');
	});

	it('substitutes repeated placeholders', () => {
		expect(renderTemplate('{name} {name}', vars)).toBe('Jon Miller Jon Miller');
	});

	it('leaves unknown placeholders untouched so typos stay visible', () => {
		expect(renderTemplate('Hi {nickmame}', vars)).toBe('Hi {nickmame}');
	});

	it('leaves text with no placeholders alone', () => {
		expect(renderTemplate('Game day is Saturday.', vars)).toBe('Game day is Saturday.');
	});

	it('escapes HTML in substituted values by default', () => {
		const risky = { ...vars, nickname: '<script>alert(1)</script>' };
		const out = renderTemplate('Hi {nickname}', risky);
		expect(out).not.toContain('<script>');
		expect(out).toBe('Hi &lt;script&gt;alert(1)&lt;/script&gt;');
	});

	it('escapes ampersands in URLs for the HTML body', () => {
		expect(renderTemplate('{game_url}', vars, { escape: true })).toContain('groupId=16');
	});

	it('can skip escaping for the plain-text body', () => {
		const risky = { ...vars, nickname: 'A & B' };
		expect(renderTemplate('{nickname}', risky, { escape: false })).toBe('A & B');
		expect(renderTemplate('{nickname}', risky, { escape: true })).toBe('A &amp; B');
	});

	it('handles an empty template', () => {
		expect(renderTemplate('', vars)).toBe('');
	});
});

describe('unknownPlaceholders', () => {
	it('reports only unsupported placeholders', () => {
		expect(unknownPlaceholders('Hi {name}, see {game_url}')).toEqual([]);
		expect(unknownPlaceholders('Hi {nickmame} and {bogus}')).toEqual(['nickmame', 'bogus']);
	});

	it('deduplicates repeats', () => {
		expect(unknownPlaceholders('{oops} {oops}')).toEqual(['oops']);
	});

	it('recognises every documented placeholder', () => {
		const all = TEMPLATE_PLACEHOLDERS.map((p) => `{${p.key}}`).join(' ');
		expect(unknownPlaceholders(all)).toEqual([]);
	});
});

describe('renderMessageHtml', () => {
	it('makes a blank line start a new paragraph', () => {
		const html = renderMessageHtml('First para.\n\nSecond para.', vars);
		expect(html.match(/<p /g)).toHaveLength(2);
		expect(html).toContain('First para.');
		expect(html).toContain('Second para.');
	});

	it('treats a single newline as a line break within one paragraph', () => {
		const html = renderMessageHtml('Line one\nLine two', vars);
		expect(html.match(/<p /g)).toHaveLength(1);
		expect(html).toContain('Line one<br>Line two');
	});

	it('preserves leading indentation', () => {
		const html = renderMessageHtml('    Indented start.', vars);
		expect(html).toContain('&nbsp;&nbsp;&nbsp;&nbsp;Indented start.');
	});

	it('emphasises name and nickname', () => {
		expect(renderMessageHtml('Hello {nickname},', vars)).toContain('<strong>jonEbird</strong>');
		expect(renderMessageHtml('Hi {name}', vars)).toContain('<strong>Jon Miller</strong>');
	});

	it('links the url placeholders', () => {
		const html = renderMessageHtml('Pick here: {game_url}', vars);
		expect(html).toContain(`<a href="${vars.game_url}"`);
		expect(html).toContain('>' + vars.game_url + '</a>');
	});

	it('auto-links a bare URL the admin typed', () => {
		const html = renderMessageHtml('See https://buckeyepredictions.com for details', vars);
		expect(html).toContain('<a href="https://buckeyepredictions.com"');
		expect(html).not.toContain('<a href="https://buckeyepredictions.com for');
	});

	it('does not double-wrap a substituted URL', () => {
		const html = renderMessageHtml('{site_url}', vars);
		expect(html.match(/<a /g)).toHaveLength(1);
	});

	it('escapes HTML the admin typed', () => {
		const html = renderMessageHtml('5 < 6 & <script>alert(1)</script>', vars);
		expect(html).not.toContain('<script>');
		expect(html).toContain('&lt;script&gt;');
		expect(html).toContain('5 &lt; 6 &amp;');
	});

	it('collapses runs of blank lines rather than emitting empty paragraphs', () => {
		const html = renderMessageHtml('A\n\n\n\nB', vars);
		expect(html.match(/<p /g)).toHaveLength(2);
	});

	it('returns nothing for an empty message', () => {
		expect(renderMessageHtml('', vars)).toBe('');
		expect(renderMessageHtml('   \n  \n', vars)).toBe('');
	});

	it('leaves unknown placeholders visible', () => {
		expect(renderMessageHtml('Hi {nickmame}', vars)).toContain('{nickmame}');
	});
});

describe('labelled links and {opponent}', () => {
	it('substitutes {opponent}', () => {
		expect(renderTemplate('Beat {opponent}!', vars, { escape: false })).toBe('Beat Ball State!');
		expect(renderMessageHtml('Beat {opponent}!', vars)).toContain('Beat Ball State!');
	});

	it('renders {game_url|label} as an anchor with the label as text', () => {
		const html = renderMessageHtml('{game_url|Put your picks in!}', vars);
		expect(html).toContain(`<a href="${vars.game_url}"`);
		expect(html).toContain('>Put your picks in!</a>');
		expect(html).not.toContain(vars.game_url + '</a>');
	});

	it('supports a nested placeholder inside the label', () => {
		const html = renderMessageHtml('{game_url|pick against {opponent}}', vars);
		expect(html).toContain(`<a href="${vars.game_url}"`);
		expect(html).toContain('>pick against Ball State</a>');
		expect(html).not.toContain('{opponent}');
	});

	it('emits exactly one anchor for a labelled link', () => {
		const html = renderMessageHtml('{game_url|click here}', vars);
		expect(html.match(/<a /g)).toHaveLength(1);
	});

	it('works for {site_url|label} too', () => {
		const html = renderMessageHtml('{site_url|the site}', vars);
		expect(html).toContain(`<a href="${vars.site_url}"`);
		expect(html).toContain('>the site</a>');
	});

	it('renders a labelled link as "label (url)" in plain text', () => {
		expect(renderTemplate('{game_url|Put your picks in!}', vars, { escape: false })).toBe(
			`Put your picks in! (${vars.game_url})`
		);
	});

	it('resolves nesting in plain text as well', () => {
		expect(renderTemplate('{game_url|beat {opponent}}', vars, { escape: false })).toBe(
			`beat Ball State (${vars.game_url})`
		);
	});

	it('ignores a label on a non-URL placeholder and uses the value', () => {
		expect(renderMessageHtml('{name|ignored}', vars)).toContain('Jon Miller');
		expect(renderMessageHtml('{name|ignored}', vars)).not.toContain('ignored');
	});

	it('leaves an unknown labelled placeholder visible', () => {
		expect(renderMessageHtml('{bogus|some text}', vars)).toContain('{bogus|some text}');
		expect(unknownPlaceholders('{bogus|some text}')).toEqual(['bogus']);
	});

	it('does not report a known labelled placeholder as unknown', () => {
		expect(unknownPlaceholders('{game_url|pick against {opponent}}')).toEqual([]);
	});

	it('escapes HTML in a label', () => {
		const html = renderMessageHtml('{game_url|<b>bold</b>}', vars);
		expect(html).not.toContain('<b>bold</b>');
		expect(html).toContain('&lt;b&gt;bold&lt;/b&gt;');
	});

	it('handles two labelled links in one message', () => {
		const html = renderMessageHtml('{game_url|picks} and {site_url|home}', vars);
		expect(html.match(/<a /g)).toHaveLength(2);
		expect(html).toContain('>picks</a>');
		expect(html).toContain('>home</a>');
	});
});

describe('link styling', () => {
	it('renders links blue and underlined, inline', () => {
		for (const source of ['{game_url}', '{game_url|picks}', 'https://buckeyepredictions.com']) {
			const html = renderMessageHtml(source, vars);
			expect(html, source).toContain('color:#1d4ed8');
			expect(html, source).toContain('text-decoration:underline');
		}
	});

	it('no longer uses the old red link colour', () => {
		expect(renderMessageHtml('{game_url|picks}', vars)).not.toContain('#bb0000');
	});
});

describe('subject templating', () => {
	it('substitutes placeholders in a subject line', () => {
		expect(renderTemplate('Test email {name}', vars, { escape: false })).toBe(
			'Test email Jon Miller'
		);
	});

	it('resolves {opponent} in a subject', () => {
		expect(renderTemplate('{opponent} week!', vars, { escape: false })).toBe('Ball State week!');
	});
});
