import { describe, it, expect } from 'vitest';
import { renderTemplate, unknownPlaceholders, TEMPLATE_PLACEHOLDERS } from './templating';

const vars = {
	name: 'Jon Miller',
	nickname: 'jonEbird',
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
