import type { EntrypointsSection } from './detect/entrypoints.js';
import type { GitSection } from './detect/git.js';
import type { NoteHit } from './detect/notes.js';
import type { ReadmeSection } from './detect/readme.js';
import type { StackHit } from './detect/stack.js';

export const SCHEMA_VERSION = 1;

export type TreeSection = {
  lines: string[];
  truncated: boolean;
};

export type Report = {
  schemaVersion: typeof SCHEMA_VERSION;
  target: string;
  readme: ReadmeSection | null;
  stacks: StackHit[];
  entrypoints: EntrypointsSection | null;
  git: GitSection | null;
  notes: NoteHit[];
  tree: TreeSection | null;
};
