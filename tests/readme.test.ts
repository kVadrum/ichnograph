import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { detectReadme } from '../src/detect/readme.js';
import { makeFixture, type Fixture } from './helpers.js';

describe('detectReadme', () => {
  let fx: Fixture;

  beforeEach(() => {
    fx = makeFixture();
  });

  afterEach(() => {
    fx.cleanup();
  });

  it('returns null when no README exists', () => {
    expect(detectReadme(fx.path)).toBeNull();
  });

  it('extracts H1 title and first paragraph', () => {
    fx.write(
      'README.md',
      `# My Tool

This tool does a thing.
And it keeps going on this line.

## Usage

Blah.
`,
    );
    const r = detectReadme(fx.path);
    expect(r?.title).toBe('My Tool');
    expect(r?.summary).toBe('This tool does a thing. And it keeps going on this line.');
  });

  it('strips frontmatter before parsing', () => {
    fx.write(
      'README.md',
      `---
layout: page
---

# Fronted

Summary here.
`,
    );
    const r = detectReadme(fx.path);
    expect(r?.title).toBe('Fronted');
    expect(r?.summary).toBe('Summary here.');
  });

  it('accepts lowercase readme filenames', () => {
    fx.write('readme.md', '# lowercase\n\nworks too.\n');
    const r = detectReadme(fx.path);
    expect(r?.file).toBe('readme.md');
    expect(r?.title).toBe('lowercase');
  });

  it('handles setext-style H1 (underlined with ===)', () => {
    fx.write(
      'README.md',
      `My Tool
=======

Summary paragraph.
`,
    );
    const r = detectReadme(fx.path);
    expect(r?.title).toBe('My Tool');
    expect(r?.summary).toBe('Summary paragraph.');
  });

  it('handles setext-style H2 (underlined with ---)', () => {
    fx.write(
      'README.md',
      `My Tool
-------

Summary paragraph.
`,
    );
    const r = detectReadme(fx.path);
    expect(r?.title).toBe('My Tool');
    expect(r?.summary).toBe('Summary paragraph.');
  });

  it('strips inline markdown from summary', () => {
    fx.write(
      'README.md',
      `# Link

See [the docs](https://example.com) for **more** info.
`,
    );
    const r = detectReadme(fx.path);
    expect(r?.summary).toBe('See the docs for more info.');
  });
});
