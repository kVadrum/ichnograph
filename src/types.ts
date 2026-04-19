import type { StackHit } from './detect/stack.js';

export type TreeSection = {
  root: string;
  lines: string[];
  truncated: boolean;
};

export type Report = {
  target: string;
  stacks: StackHit[];
  tree: TreeSection | null;
};
