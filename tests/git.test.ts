import { spawnSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { detectGit } from '../src/detect/git.js';
import { makeFixture, type Fixture } from './helpers.js';

function git(cwd: string, args: string[]): void {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (res.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${res.stderr}`);
  }
}

function initRepo(path: string): void {
  git(path, ['init', '-q', '-b', 'main']);
  git(path, ['config', 'user.email', 'test@example.com']);
  git(path, ['config', 'user.name', 'test']);
  git(path, ['config', 'commit.gpgsign', 'false']);
}

describe('detectGit', () => {
  let fx: Fixture;

  beforeEach(() => {
    fx = makeFixture();
  });

  afterEach(() => {
    fx.cleanup();
  });

  it('returns null for a non-git directory', () => {
    expect(detectGit(fx.path)).toBeNull();
  });

  it('returns branch name and empty commits for an empty repo', () => {
    initRepo(fx.path);
    const result = detectGit(fx.path);
    expect(result).not.toBeNull();
    expect(result?.branch).toBe('main');
    expect(result?.commits).toEqual([]);
  });

  it('returns recent commits in newest-first order', () => {
    initRepo(fx.path);
    fx.write('a.txt', '1');
    git(fx.path, ['add', '-A']);
    git(fx.path, ['commit', '-q', '-m', 'first']);
    fx.write('a.txt', '2');
    git(fx.path, ['add', '-A']);
    git(fx.path, ['commit', '-q', '-m', 'second']);

    const result = detectGit(fx.path, 5);
    expect(result?.commits).toHaveLength(2);
    expect(result?.commits[0]?.subject).toBe('second');
    expect(result?.commits[1]?.subject).toBe('first');
    expect(result?.commits[0]?.hash).toMatch(/^[0-9a-f]+$/);
  });

  it('honors count parameter', () => {
    initRepo(fx.path);
    for (let i = 0; i < 4; i++) {
      fx.write('a.txt', String(i));
      git(fx.path, ['add', '-A']);
      git(fx.path, ['commit', '-q', '-m', `c${i}`]);
    }
    const result = detectGit(fx.path, 2);
    expect(result?.commits).toHaveLength(2);
  });

  it('preserves commit subjects that contain the field separator', () => {
    initRepo(fx.path);
    fx.write('a.txt', '1');
    git(fx.path, ['add', '-A']);
    git(fx.path, ['commit', '-q', '-m', 'weird \x1f subject']);

    const result = detectGit(fx.path);
    expect(result?.commits[0]?.subject).toBe('weird \x1f subject');
  });

  it('reports zero status counts on a clean tree', () => {
    initRepo(fx.path);
    fx.write('a.txt', '1');
    git(fx.path, ['add', '-A']);
    git(fx.path, ['commit', '-q', '-m', 'init']);

    const result = detectGit(fx.path);
    expect(result?.status).toEqual({ staged: 0, modified: 0, untracked: 0 });
  });

  it('counts staged, modified, and untracked paths separately', () => {
    initRepo(fx.path);
    fx.write('committed.txt', 'original');
    git(fx.path, ['add', '-A']);
    git(fx.path, ['commit', '-q', '-m', 'init']);

    fx.write('committed.txt', 'changed'); // modified (unstaged)
    fx.write('staged-new.txt', 'new');
    git(fx.path, ['add', 'staged-new.txt']); // staged
    fx.write('brand-new.txt', 'untracked'); // untracked

    const result = detectGit(fx.path);
    expect(result?.status).toEqual({ staged: 1, modified: 1, untracked: 1 });
  });

  it('surfaces working-tree changes with source=working', () => {
    initRepo(fx.path);
    fx.write('a.txt', 'v1');
    git(fx.path, ['add', '-A']);
    git(fx.path, ['commit', '-q', '-m', 'init']);
    fx.write('a.txt', 'v2');
    fx.write('b.txt', 'new');

    const result = detectGit(fx.path);
    expect(result?.changed?.source).toBe('working');
    expect(result?.changed?.files).toEqual(expect.arrayContaining(['a.txt', 'b.txt']));
    expect(result?.changed?.truncated).toBe(false);
  });

  it('falls back to last-commit files on a clean tree', () => {
    initRepo(fx.path);
    fx.write('x.txt', '1');
    fx.write('y.txt', '1');
    git(fx.path, ['add', '-A']);
    git(fx.path, ['commit', '-q', '-m', 'init']);

    const result = detectGit(fx.path);
    expect(result?.changed?.source).toBe('last-commit');
    expect(result?.changed?.files.sort()).toEqual(['x.txt', 'y.txt']);
  });

  it('truncates changed-files list beyond the limit', () => {
    initRepo(fx.path);
    for (let i = 0; i < 7; i++) fx.write(`f${i}.txt`, 'x');

    const result = detectGit(fx.path);
    expect(result?.changed?.source).toBe('working');
    expect(result?.changed?.files).toHaveLength(5);
    expect(result?.changed?.truncated).toBe(true);
  });

  it('returns null changed on an empty repo', () => {
    initRepo(fx.path);
    const result = detectGit(fx.path);
    expect(result?.status).toEqual({ staged: 0, modified: 0, untracked: 0 });
    expect(result?.changed).toBeNull();
  });
});
