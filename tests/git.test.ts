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
});
