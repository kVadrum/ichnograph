import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type EntrypointSource = 'package.json' | 'Makefile' | 'justfile';

export type Entrypoint = {
  name: string;
  source: EntrypointSource;
  // How a user runs it from the shell, e.g. "npm run dev" or "make test".
  invoke: string;
  // Raw command body if cheaply knowable (package.json scripts); null for
  // Makefile/justfile where the body may span multiple lines with logic.
  command: string | null;
};

export type EntrypointsSection = {
  entries: Entrypoint[];
  truncated: boolean;
};

const DISPLAY_LIMIT = 8;

// Likely "run the thing" verbs, in rough priority order. Ordering matters —
// `dev` should outrank `test` on the assumption that a stranger landing in a
// repo wants to boot it before they want to verify it.
const PRIORITY_NAMES = [
  'dev',
  'start',
  'run',
  'serve',
  'watch',
  'build',
  'bundle',
  'test',
  'test:watch',
  'check',
  'typecheck',
  'lint',
  'format',
];

function priorityRank(name: string): number {
  const i = PRIORITY_NAMES.indexOf(name);
  return i === -1 ? PRIORITY_NAMES.length : i;
}

function compareEntrypoints(a: Entrypoint, b: Entrypoint): number {
  const ra = priorityRank(a.name);
  const rb = priorityRank(b.name);
  if (ra !== rb) return ra - rb;
  return a.name.localeCompare(b.name);
}

function readPackageScripts(root: string): Entrypoint[] {
  const path = join(root, 'package.json');
  if (!existsSync(path)) return [];
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== 'object') return [];
  const scripts = (parsed as { scripts?: unknown }).scripts;
  if (!scripts || typeof scripts !== 'object') return [];

  const out: Entrypoint[] = [];
  for (const [name, body] of Object.entries(scripts as Record<string, unknown>)) {
    if (typeof body !== 'string') continue;
    out.push({
      name,
      source: 'package.json',
      invoke: `npm run ${name}`,
      command: body,
    });
  }
  return out;
}

// Parse Makefile/justfile target names. Both share a line-oriented `name:`
// recipe header. We don't run anything or expand variables — just surface
// target names so a reader knows what can be invoked.
function readMakeLikeTargets(
  path: string,
  source: EntrypointSource,
  runner: string,
): Entrypoint[] {
  if (!existsSync(path)) return [];
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return [];
  }

  const out: Entrypoint[] = [];
  const seen = new Set<string>();
  for (const line of raw.split('\n')) {
    // A recipe header looks like "target:" or "target: dep1 dep2". Skip
    // indented lines (those are recipe bodies) and directives like `.PHONY:`.
    if (line.startsWith('\t') || line.startsWith(' ')) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_.\/-]*)\s*:(?!=)/.exec(line);
    if (!match) continue;
    const name = match[1];
    if (!name || name.startsWith('.')) continue; // skip .PHONY, .SUFFIXES, etc.
    if (seen.has(name)) continue;
    seen.add(name);
    out.push({
      name,
      source,
      invoke: `${runner} ${name}`,
      command: null,
    });
  }
  return out;
}

export function detectEntrypoints(root: string): EntrypointsSection | null {
  const all: Entrypoint[] = [
    ...readPackageScripts(root),
    ...readMakeLikeTargets(join(root, 'Makefile'), 'Makefile', 'make'),
    ...readMakeLikeTargets(join(root, 'justfile'), 'justfile', 'just'),
  ];
  if (all.length === 0) return null;

  all.sort(compareEntrypoints);
  const entries = all.slice(0, DISPLAY_LIMIT);
  return { entries, truncated: all.length > DISPLAY_LIMIT };
}
