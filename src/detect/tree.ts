import { lstatSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { TreeSection } from '../types.js';

const DEFAULT_IGNORES = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '.svelte-kit',
  '.turbo',
  '.cache',
  '.vite',
  'coverage',
  '.venv',
  'venv',
  '__pycache__',
  '.pytest_cache',
  'target',
  '.DS_Store',
  '.idea',
  '.vscode',
]);

export type TreeOptions = {
  depth?: number;
  ignore?: Set<string>;
  maxEntriesPerDir?: number;
};

type Entry = { name: string; isDir: boolean };

function listDir(dir: string, ignore: Set<string>): Entry[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  const entries: Entry[] = [];
  for (const name of names) {
    if (ignore.has(name)) continue;
    try {
      const st = lstatSync(join(dir, name));
      if (st.isSymbolicLink()) continue;
      entries.push({ name, isDir: st.isDirectory() });
    } catch {
      // unreadable entry — skip
    }
  }
  entries.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return entries;
}

export function buildTree(root: string, opts: TreeOptions = {}): TreeSection {
  const depth = opts.depth ?? 2;
  const ignore = opts.ignore ?? DEFAULT_IGNORES;
  const maxPerDir = opts.maxEntriesPerDir ?? 40;

  const lines: string[] = [];
  let truncated = false;

  const walk = (dir: string, prefix: string, remaining: number) => {
    if (remaining < 0) return;
    const entries = listDir(dir, ignore);
    const shown = entries.slice(0, maxPerDir);
    if (entries.length > maxPerDir) truncated = true;

    shown.forEach((entry, i) => {
      const last = i === shown.length - 1 && entries.length <= maxPerDir;
      const connector = last ? '└── ' : '├── ';
      const marker = entry.isDir ? '/' : '';
      lines.push(`${prefix}${connector}${entry.name}${marker}`);
      if (entry.isDir && remaining > 0) {
        const nextPrefix = prefix + (last ? '    ' : '│   ');
        walk(join(dir, entry.name), nextPrefix, remaining - 1);
      }
    });

    if (entries.length > maxPerDir) {
      lines.push(`${prefix}└── … (${entries.length - maxPerDir} more)`);
    }
  };

  walk(root, '', depth);
  return { root: basename(root) || root, lines, truncated };
}
