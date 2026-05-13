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

  it('skips a leading fenced code block to find the description', () => {
    fx.write(
      'README.md',
      `# My Tool

\`\`\`sh
$ npx mytool
\`\`\`

A tool that does X.
`,
    );
    const r = detectReadme(fx.path);
    expect(r?.title).toBe('My Tool');
    expect(r?.summary).toBe('A tool that does X.');
  });

  it('strips an optional closing # sequence from the H1 title', () => {
    fx.write('README.md', '# My Tool #\n\nA tool that does X.\n');
    const r = detectReadme(fx.path);
    expect(r?.title).toBe('My Tool');
    expect(r?.summary).toBe('A tool that does X.');
  });

  it('keeps a trailing # in the title literal when no whitespace separates it', () => {
    fx.write('README.md', '# foo#\n\nDescription.\n');
    const r = detectReadme(fx.path);
    expect(r?.title).toBe('foo#');
  });

  it('skips tilde-fenced code blocks too', () => {
    fx.write(
      'README.md',
      `# My Tool

~~~
example
~~~

Real description here.
`,
    );
    const r = detectReadme(fx.path);
    expect(r?.summary).toBe('Real description here.');
  });

  it('returns null summary when only a fenced block follows the title', () => {
    fx.write(
      'README.md',
      `# Title

\`\`\`
example
\`\`\`
`,
    );
    const r = detectReadme(fx.path);
    expect(r?.title).toBe('Title');
    expect(r?.summary).toBeNull();
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

  it('strips single-underscore italic without touching intraword underscores', () => {
    fx.write(
      'README.md',
      `# Tool

A _draft_ tool for the CODE_OF_CONDUCT pipeline.
`,
    );
    const r = detectReadme(fx.path);
    expect(r?.summary).toBe('A draft tool for the CODE_OF_CONDUCT pipeline.');
  });

  it('strips strikethrough (~~text~~)', () => {
    fx.write(
      'README.md',
      `# Tool

A ~~deprecated~~ revived tool for the pipeline.
`,
    );
    const r = detectReadme(fx.path);
    expect(r?.summary).toBe('A deprecated revived tool for the pipeline.');
  });

  it('strips image syntax without leaving a stray !', () => {
    fx.write(
      'README.md',
      `# Tool

![CI](https://example.com/badge.svg) A tool that does X.
`,
    );
    const r = detectReadme(fx.path);
    expect(r?.summary).toBe('CI A tool that does X.');
  });

  it('drops empty-alt images entirely', () => {
    fx.write(
      'README.md',
      `# Tool

![](https://example.com/logo.png) Real description.
`,
    );
    const r = detectReadme(fx.path);
    expect(r?.summary).toBe('Real description.');
  });

  it('strips reference-style links and images', () => {
    fx.write(
      'README.md',
      `# Tool

[![CI][ci-badge]][ci-url] A [great tool][project] for the job.

[ci-badge]: https://example.com/badge.svg
[ci-url]: https://example.com/ci
[project]: https://example.com
`,
    );
    const r = detectReadme(fx.path);
    expect(r?.summary).toBe('CI A great tool for the job.');
  });

  it('leaves bare bracketed shortcuts alone', () => {
    fx.write(
      'README.md',
      `# Tool

A [draft] writeup of the design.
`,
    );
    const r = detectReadme(fx.path);
    expect(r?.summary).toBe('A [draft] writeup of the design.');
  });

  it('strips autolink angle brackets around URLs and emails', () => {
    fx.write(
      'README.md',
      `# Tool

Visit <https://example.com> or email <ops@example.com> for support.
`,
    );
    const r = detectReadme(fx.path);
    expect(r?.summary).toBe(
      'Visit https://example.com or email ops@example.com for support.',
    );
  });

  it('strips GFM footnote references from the summary', () => {
    fx.write(
      'README.md',
      `# Tool

A small tool[^1] for orienting in repos[^api-note].
`,
    );
    const r = detectReadme(fx.path);
    expect(r?.summary).toBe('A small tool for orienting in repos.');
  });

  it('strips inline HTML comments from the summary', () => {
    fx.write(
      'README.md',
      `# Tool

A real <!-- TODO: rewrite --> description of the tool.
`,
    );
    const r = detectReadme(fx.path);
    expect(r?.summary).toBe('A real description of the tool.');
  });

  it('strips a multi-line HTML comment that spans paragraph lines', () => {
    fx.write(
      'README.md',
      `# Tool

A real <!-- comment that
keeps going across lines --> description.
`,
    );
    const r = detectReadme(fx.path);
    expect(r?.summary).toBe('A real description.');
  });

  it('digs past a leading multi-line HTML comment block before the title', () => {
    fx.write(
      'README.md',
      `<!--
  Copyright (c) 2026 KeMeK Network
  All rights reserved.
-->
# My Tool

Real description here.
`,
    );
    const r = detectReadme(fx.path);
    expect(r?.title).toBe('My Tool');
    expect(r?.summary).toBe('Real description here.');
  });

  it('digs past a multi-line HTML comment block sitting between title and paragraph', () => {
    fx.write(
      'README.md',
      `# My Tool

<!--
  TOC
  - Section 1
  - Section 2
-->

Real description here.
`,
    );
    const r = detectReadme(fx.path);
    expect(r?.title).toBe('My Tool');
    expect(r?.summary).toBe('Real description here.');
  });

  it('leaves bare angle-bracketed words alone (not autolinks)', () => {
    fx.write(
      'README.md',
      `# Tool

Replace <name> with the project identifier in your config.
`,
    );
    const r = detectReadme(fx.path);
    expect(r?.summary).toBe(
      'Replace <name> with the project identifier in your config.',
    );
  });

  it('strips common inline HTML tags but keeps wrapped content', () => {
    fx.write(
      'README.md',
      `# Tool

A <a href="https://example.com">tool</a> for <b>fast</b> repo orientation.
`,
    );
    const r = detectReadme(fx.path);
    expect(r?.summary).toBe(
      'A tool for fast repo orientation.',
    );
  });

  it('strips a centered HTML title and surfaces wrapped prose', () => {
    fx.write(
      'README.md',
      `<p align="center"><b>Tool</b></p>

A short description that follows.
`,
    );
    const r = detectReadme(fx.path);
    expect(r?.title).toBe('Tool');
    expect(r?.summary).toBe('A short description that follows.');
  });

  it('leaves non-HTML angle-bracketed placeholders alone', () => {
    fx.write(
      'README.md',
      `# Tool

Configure <your-token> and pass <unknown-flag> on the command line.
`,
    );
    const r = detectReadme(fx.path);
    expect(r?.summary).toBe(
      'Configure <your-token> and pass <unknown-flag> on the command line.',
    );
  });

  it('strips a leading blockquote marker from the summary paragraph', () => {
    fx.write(
      'README.md',
      `# Tool

> A small CLI for orienting in repos.
`,
    );
    const r = detectReadme(fx.path);
    expect(r?.summary).toBe('A small CLI for orienting in repos.');
  });

  it('joins multi-line blockquote summary, stripping the marker per line', () => {
    fx.write(
      'README.md',
      `# Tool

> A small CLI for orienting in repos.
> Designed for one-screen output.
`,
    );
    const r = detectReadme(fx.path);
    expect(r?.summary).toBe(
      'A small CLI for orienting in repos. Designed for one-screen output.',
    );
  });

  it('strips nested blockquote markers (>>)', () => {
    fx.write(
      'README.md',
      `# Tool

>> Deeply quoted description text.
`,
    );
    const r = detectReadme(fx.path);
    expect(r?.summary).toBe('Deeply quoted description text.');
  });

  it('handles a blockquote with no space after > (>foo)', () => {
    fx.write(
      'README.md',
      `# Tool

>tightly packed quote line.
`,
    );
    const r = detectReadme(fx.path);
    expect(r?.summary).toBe('tightly packed quote line.');
  });

  it('decodes named HTML entities in title and summary', () => {
    fx.write(
      'README.md',
      `# AT&amp;T Toolkit

A &quot;batteries-included&quot; CLI for Don&apos;t-repeat-yourself work.
`,
    );
    const r = detectReadme(fx.path);
    expect(r?.title).toBe('AT&T Toolkit');
    expect(r?.summary).toBe(
      'A "batteries-included" CLI for Don\'t-repeat-yourself work.',
    );
  });

  it('decodes decimal and hex numeric HTML entities', () => {
    fx.write(
      'README.md',
      `# Don&#39;t Panic

A guide &#x2014; in 42 chapters.
`,
    );
    const r = detectReadme(fx.path);
    expect(r?.title).toBe("Don't Panic");
    expect(r?.summary).toBe('A guide — in 42 chapters.');
  });

  it('leaves unknown named entities literal', () => {
    fx.write('README.md', '# Tool\n\nUse &foo; as a sentinel.\n');
    const r = detectReadme(fx.path);
    expect(r?.summary).toBe('Use &foo; as a sentinel.');
  });

  it('decodes entities AFTER tag-strip so &lt;b&gt; survives as literal', () => {
    fx.write(
      'README.md',
      `# Tool

Wrap with &lt;b&gt;bold&lt;/b&gt; to emphasize.
`,
    );
    const r = detectReadme(fx.path);
    expect(r?.summary).toBe('Wrap with <b>bold</b> to emphasize.');
  });

  it('decodes &amp; once and leaves &amp;lt; as &lt;', () => {
    fx.write('README.md', '# Tool\n\nEscaped: &amp;lt; literal.\n');
    const r = detectReadme(fx.path);
    expect(r?.summary).toBe('Escaped: &lt; literal.');
  });

  it('decodes &nbsp; to a regular space and trims summary boundaries', () => {
    fx.write('README.md', '# Tool\n\n&nbsp;Padded summary text&nbsp;\n');
    const r = detectReadme(fx.path);
    expect(r?.summary).toBe('Padded summary text');
  });
});
