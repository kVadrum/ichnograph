import type { GitSection } from './detect/git.js';
import type { ReadmeSection } from './detect/readme.js';
import type { StackHit } from './detect/stack.js';

export type TreeSection = {
  root: string;
  lines: string[];
  truncated: boolean;
};

export type Report = {
  target: string;
  readme: ReadmeSection | null;
  stacks: StackHit[];
  git: GitSection | null;
  tree: TreeSection | null;
};
