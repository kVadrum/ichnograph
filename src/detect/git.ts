import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export type GitCommit = {
  hash: string;
  relTime: string;
  subject: string;
};

export type GitStatusCounts = {
  staged: number;
  modified: number;
  untracked: number;
};

export type GitChangedFiles = {
  // 'working' — uncommitted changes, i.e. what you were in the middle of.
  // 'last-commit' — files touched by HEAD, shown as a fallback on a clean
  // tree so the signal remains useful on a fresh checkout.
  source: 'working' | 'last-commit';
  files: string[];
  truncated: boolean;
};

export type GitSection = {
  branch: string | null;
  commits: GitCommit[];
  status: GitStatusCounts | null;
  changed: GitChangedFiles | null;
};

const CHANGED_LIMIT = 5;

function runGit(cwd: string, args: string[]): string | null {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (res.status !== 0) return null;
  return res.stdout;
}

type StatusEntry = { xy: string; path: string };

// Parse `git status --porcelain=v1 -z`. Format: each entry starts with a
// 2-character XY status code and a space, then the path. Rename (R) and copy
// (C) entries in column X are followed by an extra null-delimited old-path
// field — skip it so counts don't double up.
function parsePorcelainZ(raw: string): StatusEntry[] {
  const parts = raw.split('\0');
  const out: StatusEntry[] = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (!p) continue;
    const xy = p.slice(0, 2);
    const path = p.slice(3);
    out.push({ xy, path });
    if (xy[0] === 'R' || xy[0] === 'C') i++;
  }
  return out;
}

function classify(entries: StatusEntry[]): GitStatusCounts {
  let staged = 0;
  let modified = 0;
  let untracked = 0;
  for (const e of entries) {
    if (e.xy === '??') {
      untracked++;
      continue;
    }
    if (e.xy[0] !== ' ' && e.xy[0] !== '?') staged++;
    if (e.xy[1] !== ' ' && e.xy[1] !== '?') modified++;
  }
  return { staged, modified, untracked };
}

export function detectGit(root: string, count = 5): GitSection | null {
  if (!existsSync(join(root, '.git'))) return null;

  // symbolic-ref resolves the branch name even on an empty repo (no commits
  // yet). Fallback to rev-parse for detached HEAD, where symbolic-ref fails.
  const symRaw = runGit(root, ['symbolic-ref', '--short', 'HEAD']);
  const refRaw = symRaw ?? runGit(root, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const branch = refRaw ? refRaw.trim() : null;

  // %x1f is ASCII unit separator (0x1f). Using it as a field delimiter avoids
  // collisions with spaces in %ar ("2 minutes ago") or arbitrary text in %s.
  const logRaw = runGit(root, [
    'log',
    '-n',
    String(count),
    '--pretty=format:%h%x1f%ar%x1f%s',
  ]);
  const commits: GitCommit[] = [];
  if (logRaw) {
    for (const line of logRaw.split('\n')) {
      if (!line) continue;
      const i1 = line.indexOf('\x1f');
      if (i1 < 0) continue;
      const i2 = line.indexOf('\x1f', i1 + 1);
      if (i2 < 0) continue;
      commits.push({
        hash: line.slice(0, i1),
        relTime: line.slice(i1 + 1, i2),
        subject: line.slice(i2 + 1),
      });
    }
  }

  const statusRaw = runGit(root, ['status', '--porcelain=v1', '-z']);
  const entries = statusRaw !== null ? parsePorcelainZ(statusRaw) : null;
  const status = entries ? classify(entries) : null;

  let changed: GitChangedFiles | null = null;
  if (entries && entries.length > 0) {
    changed = {
      source: 'working',
      files: entries.slice(0, CHANGED_LIMIT).map((e) => e.path),
      truncated: entries.length > CHANGED_LIMIT,
    };
  } else if (commits.length > 0) {
    // --root makes diff-tree emit files against an empty tree for the root
    // commit; without it the very first commit diffs against a non-existent
    // parent and yields no output.
    const lastRaw = runGit(root, [
      'diff-tree',
      '--root',
      '--no-commit-id',
      '--name-only',
      '-r',
      '-z',
      'HEAD',
    ]);
    if (lastRaw) {
      const files = lastRaw.split('\0').filter(Boolean);
      changed = {
        source: 'last-commit',
        files: files.slice(0, CHANGED_LIMIT),
        truncated: files.length > CHANGED_LIMIT,
      };
    }
  }

  return { branch, commits, status, changed };
}
