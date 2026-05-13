import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { detectNotes } from '../src/detect/notes.js';
import { makeFixture, type Fixture } from './helpers.js';

describe('detectNotes', () => {
  let fx: Fixture;

  beforeEach(() => {
    fx = makeFixture();
  });

  afterEach(() => {
    fx.cleanup();
  });

  it('returns empty for a bare directory', () => {
    expect(detectNotes(fx.path)).toEqual([]);
  });

  it('picks up STATE/TODO/CHANGELOG and orders by priority', () => {
    fx.write('STATE.md', '# State\n\nCurrent status');
    fx.write('CHANGELOG.md', '# Changelog\n\n## Unreleased');
    fx.write('TODO.md', '# Todo\n\nThings to do');

    const notes = detectNotes(fx.path);
    const names = notes.map((n) => n.name);
    expect(names).toEqual(['STATE.md', 'TODO.md', 'CHANGELOG.md']);
  });

  it('extracts first heading as summary', () => {
    fx.write('STATE.md', '# Tuesday snapshot\n\nmore stuff');
    const notes = detectNotes(fx.path);
    expect(notes[0]?.summary).toBe('Tuesday snapshot');
  });

  it('strips inline markdown from the summary', () => {
    fx.write('STATE.md', '# **Status**: `active` and [green](https://x)');
    const notes = detectNotes(fx.path);
    expect(notes[0]?.summary).toBe('Status: active and green');
  });

  it('strips single-underscore italic without touching intraword underscores', () => {
    fx.write('STATE.md', '# _draft_ status for CODE_OF_CONDUCT review');
    const notes = detectNotes(fx.path);
    expect(notes[0]?.summary).toBe('draft status for CODE_OF_CONDUCT review');
  });

  it('strips strikethrough (~~text~~)', () => {
    fx.write('STATE.md', '# ~~old plan~~ new plan in motion');
    const notes = detectNotes(fx.path);
    expect(notes[0]?.summary).toBe('old plan new plan in motion');
  });

  it('strips image syntax without leaving a stray !', () => {
    fx.write('STATE.md', '# ![CI](https://x/badge.svg) Status active');
    const notes = detectNotes(fx.path);
    expect(notes[0]?.summary).toBe('CI Status active');
  });

  it('drops empty-alt images entirely', () => {
    fx.write('STATE.md', '# ![](https://x/logo.png) Real status');
    const notes = detectNotes(fx.path);
    expect(notes[0]?.summary).toBe('Real status');
  });

  it('strips reference-style links and images', () => {
    fx.write(
      'STATE.md',
      '# ![CI][ci-badge] [Project][1] is shipping',
    );
    const notes = detectNotes(fx.path);
    expect(notes[0]?.summary).toBe('CI Project is shipping');
  });

  it('leaves bare bracketed shortcuts alone', () => {
    fx.write('STATE.md', '# [draft] notes pending review');
    const notes = detectNotes(fx.path);
    expect(notes[0]?.summary).toBe('[draft] notes pending review');
  });

  it('strips autolink angle brackets around URLs and emails', () => {
    fx.write(
      'STATE.md',
      '# See <https://example.com> or email <ops@example.com> for help',
    );
    const notes = detectNotes(fx.path);
    expect(notes[0]?.summary).toBe(
      'See https://example.com or email ops@example.com for help',
    );
  });

  it('leaves bare angle-bracketed words alone (not autolinks)', () => {
    fx.write('STATE.md', '# Replace <name> with the project identifier');
    const notes = detectNotes(fx.path);
    expect(notes[0]?.summary).toBe('Replace <name> with the project identifier');
  });

  it('strips common inline HTML tags but keeps wrapped content', () => {
    fx.write(
      'STATE.md',
      '# Status: <b>active</b> since <a href="https://x">v1.0</a>',
    );
    const notes = detectNotes(fx.path);
    expect(notes[0]?.summary).toBe('Status: active since v1.0');
  });

  it('leaves non-HTML angle-bracketed placeholders alone', () => {
    fx.write('STATE.md', '# Set <your-token> in <name>.env to enable');
    const notes = detectNotes(fx.path);
    expect(notes[0]?.summary).toBe('Set <your-token> in <name>.env to enable');
  });

  it('strips GFM footnote references but leaves definitions alone', () => {
    fx.write('STATE.md', '# Status active[^1] since v1.0\n');
    const notes = detectNotes(fx.path);
    expect(notes[0]?.summary).toBe('Status active since v1.0');
  });

  it('keeps a footnote definition line intact (colon after label)', () => {
    fx.write('STATE.md', '[^1]: This is the footnote definition body\n');
    const notes = detectNotes(fx.path);
    expect(notes[0]?.summary).toBe(
      '[^1]: This is the footnote definition body',
    );
  });

  it('strips inline HTML comments without leaving extra spaces', () => {
    fx.write('STATE.md', '# Status <!-- TODO: refresh --> active');
    const notes = detectNotes(fx.path);
    expect(notes[0]?.summary).toBe('Status active');
  });

  it('digs past a leading HTML comment line to the next real heading', () => {
    fx.write(
      'STATE.md',
      '<!-- canonical: ~/dev/ai/prompts/foo.md -->\n# Real status\n',
    );
    const notes = detectNotes(fx.path);
    expect(notes[0]?.summary).toBe('Real status');
  });

  it('digs past a leading multi-line HTML comment block', () => {
    fx.write(
      'STATE.md',
      '<!--\n  Copyright (c) 2026 KeMeK Network\n  All rights reserved.\n-->\n# Real status\n',
    );
    const notes = detectNotes(fx.path);
    expect(notes[0]?.summary).toBe('Real status');
  });

  it('skips fenced code blocks when extracting summary', () => {
    fx.write(
      'STATE.md',
      '```ts\nconst x = 1;\n```\n\nReal status line follows the example',
    );
    const notes = detectNotes(fx.path);
    expect(notes[0]?.summary).toBe('Real status line follows the example');
  });

  it('handles tilde-fenced code blocks too', () => {
    fx.write('STATE.md', '~~~\nfoo\n~~~\n\nActual summary');
    const notes = detectNotes(fx.path);
    expect(notes[0]?.summary).toBe('Actual summary');
  });

  it('strips list marker and GFM task checkbox from a leading bullet', () => {
    fx.write('TODO.md', '- [ ] Wire up the auth flow\n- [x] Done thing\n');
    const notes = detectNotes(fx.path);
    expect(notes[0]?.summary).toBe('Wire up the auth flow');
  });

  it('strips a plain list marker (no checkbox) from a leading bullet', () => {
    fx.write('STATE.md', '- branch: dev shipping Tuesday\n- next: review\n');
    const notes = detectNotes(fx.path);
    expect(notes[0]?.summary).toBe('branch: dev shipping Tuesday');
  });

  it('strips asterisk and plus list markers', () => {
    fx.write('STATE.md', '* feature complete\n');
    fx.write('TODO.md', '+ ship the patch\n');
    const notes = detectNotes(fx.path);
    expect(notes.find((n) => n.name === 'STATE.md')?.summary).toBe('feature complete');
    expect(notes.find((n) => n.name === 'TODO.md')?.summary).toBe('ship the patch');
  });

  it('strips ordered-list markers', () => {
    fx.write('TODO.md', '1. First task on the list\n2. second\n');
    const notes = detectNotes(fx.path);
    expect(notes[0]?.summary).toBe('First task on the list');
  });

  it('handles a checked task with capital X', () => {
    fx.write('TODO.md', '- [X] Already shipped this one\n');
    const notes = detectNotes(fx.path);
    expect(notes[0]?.summary).toBe('Already shipped this one');
  });

  it('leaves bracketed shortcuts after a list marker alone', () => {
    fx.write('STATE.md', '- [draft] notes pending review\n');
    const notes = detectNotes(fx.path);
    expect(notes[0]?.summary).toBe('[draft] notes pending review');
  });

  it('strips an optional closing # sequence from ATX headings', () => {
    fx.write('STATE.md', '## Status ##\n\nbody');
    const notes = detectNotes(fx.path);
    expect(notes[0]?.summary).toBe('Status');
  });

  it('keeps trailing # literal when not preceded by whitespace', () => {
    fx.write('STATE.md', '# foo#\n');
    const notes = detectNotes(fx.path);
    expect(notes[0]?.summary).toBe('foo#');
  });

  it('strips a longer closing # run with trailing whitespace', () => {
    fx.write('STATE.md', '### Build pipeline ###   \n');
    const notes = detectNotes(fx.path);
    expect(notes[0]?.summary).toBe('Build pipeline');
  });

  it('strips a leading blockquote marker', () => {
    fx.write('STATE.md', '> Status: active and shipping\n');
    const notes = detectNotes(fx.path);
    expect(notes[0]?.summary).toBe('Status: active and shipping');
  });

  it('strips a blockquote marker with no following space (>foo)', () => {
    fx.write('STATE.md', '>foo bar baz\n');
    const notes = detectNotes(fx.path);
    expect(notes[0]?.summary).toBe('foo bar baz');
  });

  it('strips nested blockquote markers (>>)', () => {
    fx.write('STATE.md', '>> deeply quoted summary text\n');
    const notes = detectNotes(fx.path);
    expect(notes[0]?.summary).toBe('deeply quoted summary text');
  });

  it('strips inline markdown inside a blockquote body', () => {
    fx.write('STATE.md', '> **Status**: `active`\n');
    const notes = detectNotes(fx.path);
    expect(notes[0]?.summary).toBe('Status: active');
  });

  it('does not treat a hyphen with no trailing space as a list marker', () => {
    fx.write('STATE.md', '-not-a-list because no space follows\n');
    const notes = detectNotes(fx.path);
    expect(notes[0]?.summary).toBe('-not-a-list because no space follows');
  });

  it('decodes named HTML entities (&amp; &quot; &apos;)', () => {
    fx.write('STATE.md', '# AT&amp;T and &quot;Don&apos;t Panic&quot;\n');
    const notes = detectNotes(fx.path);
    expect(notes[0]?.summary).toBe('AT&T and "Don\'t Panic"');
  });

  it('decodes decimal and hex numeric HTML entities', () => {
    fx.write('STATE.md', '# Don&#39;t panic &#x2014; carry on\n');
    const notes = detectNotes(fx.path);
    expect(notes[0]?.summary).toBe("Don't panic — carry on");
  });

  it('leaves unknown named entities literal', () => {
    fx.write('STATE.md', '# Use &foo; as a sentinel value\n');
    const notes = detectNotes(fx.path);
    expect(notes[0]?.summary).toBe('Use &foo; as a sentinel value');
  });

  it('decodes &nbsp; to a regular space and trims', () => {
    fx.write('STATE.md', '# &nbsp;Status active&nbsp;\n');
    const notes = detectNotes(fx.path);
    expect(notes[0]?.summary).toBe('Status active');
  });

  it('decodes entities AFTER tag-strip so &lt;b&gt; survives as literal', () => {
    fx.write('STATE.md', '# Use &lt;b&gt;bold&lt;/b&gt; in the prompt\n');
    const notes = detectNotes(fx.path);
    expect(notes[0]?.summary).toBe('Use <b>bold</b> in the prompt');
  });

  it('decodes &amp; once and leaves &amp;lt; as &lt;', () => {
    fx.write('STATE.md', '# Escaped: &amp;lt; literal\n');
    const notes = detectNotes(fx.path);
    expect(notes[0]?.summary).toBe('Escaped: &lt; literal');
  });

  it('rejects surrogate-range numeric entities', () => {
    fx.write('STATE.md', '# Invalid &#xD800; codepoint stays literal\n');
    const notes = detectNotes(fx.path);
    expect(notes[0]?.summary).toBe('Invalid &#xD800; codepoint stays literal');
  });

  it('matches numbered spec files', () => {
    fx.write('00-overview.md', '# Overview');
    fx.write('01-architecture.md', '# Architecture');
    const notes = detectNotes(fx.path);
    const names = notes.map((n) => n.name);
    expect(names).toContain('00-overview.md');
    expect(names).toContain('01-architecture.md');
  });

  it('surfaces adrs/ directory with entry count', () => {
    fx.write('adrs/0001-something.md', 'x');
    fx.write('adrs/0002-other.md', 'x');
    const notes = detectNotes(fx.path);
    const adr = notes.find((n) => n.name === 'adrs/');
    expect(adr).toBeDefined();
    expect(adr?.kind).toBe('dir');
    expect(adr?.summary).toBe('(2 entries)');
  });
});
