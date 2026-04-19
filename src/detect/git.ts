import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export type GitCommit = {
  hash: string;
  relTime: string;
  subject: string;
};

export type GitSection = {
  branch: string | null;
  commits: GitCommit[];
};

function runGit(cwd: string, args: string[]): string | null {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (res.status !== 0) return null;
  return res.stdout;
}

export function detectGit(root: string, count = 5): GitSection | null {
  if (!existsSync(join(root, '.git'))) return null;

  const branchRaw = runGit(root, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const branch = branchRaw ? branchRaw.trim() : null;

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
      const [hash, relTime, subject] = line.split('\x1f');
      if (hash && relTime && subject !== undefined) {
        commits.push({ hash, relTime, subject });
      }
    }
  }

  return { branch, commits };
}
