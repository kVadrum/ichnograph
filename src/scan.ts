import { detectEntrypoints } from './detect/entrypoints.js';
import { detectGit } from './detect/git.js';
import { detectNotes } from './detect/notes.js';
import { detectReadme } from './detect/readme.js';
import { detectStack } from './detect/stack.js';
import { buildTree } from './detect/tree.js';
import { SCHEMA_VERSION, type Report } from './types.js';

export type ScanOptions = {
  depth?: number;
  commits?: number;
};

export function scan(target: string, opts: ScanOptions = {}): Report {
  return {
    schemaVersion: SCHEMA_VERSION,
    target,
    readme: detectReadme(target),
    stacks: detectStack(target),
    entrypoints: detectEntrypoints(target),
    git: detectGit(target, opts.commits),
    notes: detectNotes(target),
    tree: buildTree(target, { depth: opts.depth }),
  };
}
