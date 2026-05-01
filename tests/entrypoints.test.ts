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

  it('parses justfile recipes with parameters', () => {
    fx.write(
      'justfile',
      [
        "build target='debug':",
        '\tcargo build --profile {{target}}',
        '',
        'bench *args:',
        '\tcargo bench {{args}}',
        '',
        'deploy env stage:',
        '\techo {{env}} {{stage}}',
        '',
        'set shell := ["bash", "-c"]',
        'alias b := build',
      ].join('\n'),
    );
    const res = detectEntrypoints(fx.path);
    const names = res?.entries.map((e) => e.name).sort();
    expect(names).toEqual(['bench', 'build', 'deploy']);
    expect(res?.entries.find((e) => e.name === 'build')?.invoke).toBe('just build');
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

  it('surfaces pyproject.toml [project.scripts]', () => {
    fx.write(
      'pyproject.toml',
      [
        '[project]',
        'name = "demo"',
        '',
        '[project.scripts]',
        'demo-cli = "demo.cli:main"',
        'demo-worker = "demo.worker:run"',
        '',
        '[tool.black]',
        'line-length = 100',
      ].join('\n'),
    );
    const res = detectEntrypoints(fx.path);
    const names = res?.entries.map((e) => e.name).sort();
    expect(names).toEqual(['demo-cli', 'demo-worker']);
    const cli = res?.entries.find((e) => e.name === 'demo-cli');
    expect(cli?.invoke).toBe('demo-cli');
    expect(cli?.command).toBe('demo.cli:main');
    expect(cli?.source).toBe('pyproject.toml');
  });

  it('surfaces pyproject.toml [tool.poetry.scripts] with poetry run invoke', () => {
    fx.write(
      'pyproject.toml',
      [
        '[tool.poetry]',
        'name = "demo"',
        '',
        '[tool.poetry.scripts]',
        'serve = "demo.server:main"  # inline comment',
      ].join('\n'),
    );
    const res = detectEntrypoints(fx.path);
    const serve = res?.entries.find((e) => e.name === 'serve');
    expect(serve?.invoke).toBe('poetry run serve');
    expect(serve?.command).toBe('demo.server:main');
    expect(serve?.source).toBe('pyproject.toml');
  });

  it('tolerates pyproject.toml with no script sections', () => {
    fx.write('pyproject.toml', '[project]\nname = "demo"\n');
    expect(detectEntrypoints(fx.path)).toBeNull();
  });

  it('surfaces Cargo.toml [[bin]] entries with cargo run invoke', () => {
    fx.write(
      'Cargo.toml',
      [
        '[package]',
        'name = "demo"',
        'version = "0.1.0"',
        '',
        '[[bin]]',
        'name = "demo-cli"',
        'path = "src/bin/cli.rs"',
        '',
        '[[bin]]',
        'name = "demo-worker"  # worker entry',
        'path = "src/bin/worker.rs"',
        '',
        '[dependencies]',
        'serde = "1"',
      ].join('\n'),
    );
    const res = detectEntrypoints(fx.path);
    const names = res?.entries.map((e) => e.name).sort();
    expect(names).toEqual(['demo-cli', 'demo-worker']);
    const cli = res?.entries.find((e) => e.name === 'demo-cli');
    expect(cli?.invoke).toBe('cargo run --bin demo-cli');
    expect(cli?.command).toBeNull();
    expect(cli?.source).toBe('Cargo.toml');
  });

  it('tolerates trailing comments on [[bin]] headers', () => {
    fx.write(
      'Cargo.toml',
      [
        '[package]',
        'name = "demo"',
        '',
        '[[bin]]  # primary cli',
        'name = "demo-cli"',
        '',
        '[[bin]]   ',
        'name = "demo-worker"',
      ].join('\n'),
    );
    const res = detectEntrypoints(fx.path);
    const names = res?.entries.map((e) => e.name).sort();
    expect(names).toEqual(['demo-cli', 'demo-worker']);
  });

  it('tolerates Cargo.toml with no [[bin]] tables', () => {
    fx.write('Cargo.toml', '[package]\nname = "demo"\n\n[dependencies]\n');
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
