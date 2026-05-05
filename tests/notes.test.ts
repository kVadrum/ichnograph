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
