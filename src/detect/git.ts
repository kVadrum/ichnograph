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

  return { branch, commits };
}
