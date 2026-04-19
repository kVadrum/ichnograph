import { detectGit } from './detect/git.js';
import { detectReadme } from './detect/readme.js';
import { detectStack } from './detect/stack.js';
import { buildTree } from './detect/tree.js';
import type { Report } from './types.js';

export type ScanOptions = {
  depth?: number;
  commits?: number;
};

export function scan(target: string, opts: ScanOptions = {}): Report {
  return {
    target,
    readme: detectReadme(target),
    stacks: detectStack(target),
    git: detectGit(target, opts.commits),
    tree: buildTree(target, { depth: opts.depth }),
  };
}
