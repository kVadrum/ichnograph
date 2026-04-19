import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { detectEntrypoints } from '../src/detect/entrypoints.js';
import { makeFixture, type Fixture } from './helpers.js';

describe('detectEntrypoints', () => {
  let fx: Fixture;

  beforeEach(() => {
    fx = makeFixture();
  });

  afterEach(() => {
    fx.cleanup();
  });

  it('returns null when nothing is detectable', () => {
    expect(detectEntrypoints(fx.path)).toBeNull();
  });

  it('surfaces package.json scripts', () => {
    fx.write(
      'package.json',
      JSON.stringify({
        name: 'x',
        scripts: { build: 'tsc', test: 'vitest run', custom: 'node ./x.js' },
      }),
    );
    const res = detectEntrypoints(fx.path);
    expect(res?.entries.map((e) => e.name).sort()).toEqual(['build', 'custom', 'test']);
    const build = res?.entries.find((e) => e.name === 'build');
    expect(build?.invoke).toBe('npm run build');
    expect(build?.command).toBe('tsc');
    expect(build?.source).toBe('package.json');
  });

  it('orders priority names first, then alphabetical', () => {
    fx.write(
      'package.json',
      JSON.stringify({
        scripts: { zebra: 'z', build: 'b', dev: 'd', alpha: 'a', test: 't' },
      }),
    );
    const res = detectEntrypoints(fx.path);
    expect(res?.entries.map((e) => e.name)).toEqual(['dev', 'build', 'test', 'alpha', 'zebra']);
  });

  it('parses Makefile targets', () => {
    fx.write(
      'Makefile',
      [
        '.PHONY: test',
        '',
        'build:',
        '\ttsc',
        '',
        'test: build',
        '\tvitest run',
        '',
        '# comment',
        'clean:',
        '\trm -rf dist',
      ].join('\n'),
    );
    const res = detectEntrypoints(fx.path);
    const names = res?.entries.map((e) => e.name).sort();
    expect(names).toEqual(['build', 'clean', 'test']);
    expect(res?.entries.find((e) => e.name === 'build')?.invoke).toBe('make build');
    expect(res?.entries.find((e) => e.name === 'build')?.source).toBe('Makefile');
  });

  it('ignores Makefile variable assignments (KEY := value)', () => {
    fx.write('Makefile', ['CC := gcc', 'build:', '\t$(CC) foo.c'].join('\n'));
    const res = detectEntrypoints(fx.path);
    expect(res?.entries.map((e) => e.name)).toEqual(['build']);
  });

  it('parses justfile recipes', () => {
    fx.write('justfile', ['default:', '\techo hi', '', 'lint:', '\teslint .'].join('\n'));
    const res = detectEntrypoints(fx.path);
    expect(res?.entries.find((e) => e.name === 'lint')?.invoke).toBe('just lint');
    expect(res?.entries.find((e) => e.name === 'lint')?.source).toBe('justfile');
  });

  it('truncates past the display limit', () => {
    const scripts: Record<string, string> = {};
    for (let i = 0; i < 12; i++) scripts[`cmd${i}`] = 'x';
    fx.write('package.json', JSON.stringify({ scripts }));
    const res = detectEntrypoints(fx.path);
    expect(res?.entries).toHaveLength(8);
    expect(res?.truncated).toBe(true);
  });

  it('tolerates invalid package.json', () => {
    fx.write('package.json', '{ this is not json');
    expect(detectEntrypoints(fx.path)).toBeNull();
  });

  it('merges sources when both package.json and Makefile exist', () => {
    fx.write('package.json', JSON.stringify({ scripts: { dev: 'tsx src/cli.ts' } }));
    fx.write('Makefile', 'release:\n\techo ship');
    const res = detectEntrypoints(fx.path);
    const names = res?.entries.map((e) => e.name);
    expect(names).toContain('dev');
    expect(names).toContain('release');
  });
});
