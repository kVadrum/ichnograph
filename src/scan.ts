import { buildTree } from './detect/tree.js';
import type { Report } from './types.js';

export type ScanOptions = {
  depth?: number;
};

export function scan(target: string, opts: ScanOptions = {}): Report {
  return {
    target,
    tree: buildTree(target, { depth: opts.depth }),
  };
}
