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
