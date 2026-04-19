import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildTree } from '../src/detect/tree.js';
import { makeFixture, type Fixture } from './helpers.js';

describe('buildTree', () => {
  let fx: Fixture;

  beforeEach(() => {
    fx = makeFixture();
  });

  afterEach(() => {
    fx.cleanup();
  });

  it('walks directories and sorts dirs before files', () => {
    fx.write('a.txt', '');
    fx.write('z.txt', '');
    fx.mkdir('lib');
    fx.write('lib/index.ts', '');

    const tree = buildTree(fx.path, { depth: 2 });
    const joined = tree.lines.join('\n');
    const libIdx = joined.indexOf('lib/');
    const aIdx = joined.indexOf('a.txt');
    expect(libIdx).toBeGreaterThanOrEqual(0);
    expect(aIdx).toBeGreaterThanOrEqual(0);
    expect(libIdx).toBeLessThan(aIdx);
  });

  it('ignores node_modules, .git, dist by default', () => {
    fx.mkdir('node_modules');
    fx.write('node_modules/foo/package.json', '{}');
    fx.mkdir('.git');
    fx.write('.git/HEAD', '');
    fx.mkdir('dist');
    fx.write('dist/bundle.js', '');
    fx.write('src.ts', '');

    const tree = buildTree(fx.path);
    const joined = tree.lines.join('\n');
    expect(joined).not.toContain('node_modules');
    expect(joined).not.toContain('.git');
    expect(joined).not.toContain('dist');
    expect(joined).toContain('src.ts');
  });

  it('respects depth limit', () => {
    fx.mkdir('a/b/c');
    fx.write('a/b/c/deep.txt', 'deep');

    const shallow = buildTree(fx.path, { depth: 1 });
    expect(shallow.lines.join('\n')).not.toContain('deep.txt');

    const deep = buildTree(fx.path, { depth: 3 });
    expect(deep.lines.join('\n')).toContain('deep.txt');
  });

  it('marks truncation when a directory exceeds maxEntriesPerDir', () => {
    for (let i = 0; i < 10; i++) fx.write(`file-${i}.txt`, '');
    const tree = buildTree(fx.path, { maxEntriesPerDir: 3 });
    expect(tree.truncated).toBe(true);
    expect(tree.lines.some((l) => /more\)/.test(l))).toBe(true);
  });
});
