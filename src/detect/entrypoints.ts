import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type EntrypointSource =
  | 'package.json'
  | 'Makefile'
  | 'justfile'
  | 'pyproject.toml'
  | 'Cargo.toml';

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

  // justfile recipes can carry parameters between the name and the trailing
  // colon — `build target='debug':`, `bench *args:`. Makefile targets never
  // have inline parameter syntax, so we keep its header regex strict to
  // avoid mis-matching assignment lines like `KEY = "x:y"`.
  const headerRe =
    source === 'justfile'
      ? /^([A-Za-z_][A-Za-z0-9_.\/-]*)(?:[ \t]+[^\n]*?)?[ \t]*:(?!=)/
      : /^([A-Za-z_][A-Za-z0-9_.\/-]*)\s*:(?!=)/;
  const out: Entrypoint[] = [];
  const seen = new Set<string>();
  for (const line of raw.split('\n')) {
    // A recipe header looks like "target:" or "target: dep1 dep2". Skip
    // indented lines (those are recipe bodies) and directives like `.PHONY:`.
    if (line.startsWith('\t') || line.startsWith(' ')) continue;
    const match = headerRe.exec(line);
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

// Extract raw key = "value" pairs from a specific TOML section. The minimal
// parser tolerates comments and blank lines but does NOT handle multiline
// strings, inline tables, or array values — console-script tables are flat
// `name = "module:fn"` entries, which is all we need here.
function readTomlScriptSection(
  text: string,
  section: string,
): Array<[string, string]> {
  const header = `[${section}]`;
  const headerIdx = text.indexOf(header);
  if (headerIdx === -1) return [];
  const afterHeader = text.slice(headerIdx + header.length);
  // Body runs until the next section header at the start of a line.
  const nextSection = afterHeader.search(/\n\[/);
  const body = nextSection === -1 ? afterHeader : afterHeader.slice(0, nextSection);

  const out: Array<[string, string]> = [];
  for (const rawLine of body.split('\n')) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const kv = /^([A-Za-z_][\w.-]*)\s*=\s*["']([^"']+)["']\s*$/.exec(line);
    if (!kv || kv[1] === undefined || kv[2] === undefined) continue;
    out.push([kv[1], kv[2]]);
  }
  return out;
}

function readPyprojectScripts(root: string): Entrypoint[] {
  const path = join(root, 'pyproject.toml');
  if (!existsSync(path)) return [];
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return [];
  }

  const out: Entrypoint[] = [];
  const seen = new Set<string>();
  // PEP 621 scripts install as console commands on PATH, so the plain name
  // is the invocation after `pip install .`.
  for (const [name, command] of readTomlScriptSection(raw, 'project.scripts')) {
    if (seen.has(name)) continue;
    seen.add(name);
    out.push({ name, source: 'pyproject.toml', invoke: name, command });
  }
  // Poetry-managed scripts are conventionally run via `poetry run <name>`
  // during development, before any install step.
  for (const [name, command] of readTomlScriptSection(raw, 'tool.poetry.scripts')) {
    if (seen.has(name)) continue;
    seen.add(name);
    out.push({ name, source: 'pyproject.toml', invoke: `poetry run ${name}`, command });
  }
  return out;
}

// Cargo `[[bin]]` is an array-of-tables: each occurrence of the `[[bin]]`
// header starts a new table entry. We slice each entry's body up to the
// next section header and pull out `name`. Implicit bins (src/main.rs,
// src/bin/*.rs) aren't surfaced — that would require walking the tree
// and assuming the crate name.
function readCargoBins(root: string): Entrypoint[] {
  const path = join(root, 'Cargo.toml');
  if (!existsSync(path)) return [];
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return [];
  }

  const out: Entrypoint[] = [];
  const seen = new Set<string>();
  // Allow TOML-legal trailing whitespace or `# comment` after the header.
  const headerRe = /(^|\n)\[\[bin\]\][ \t]*(?:#[^\n]*)?(?:\r?\n|$)/g;
  let match: RegExpExecArray | null;
  while ((match = headerRe.exec(raw)) !== null) {
    const bodyStart = match.index + match[0].length;
    const rest = raw.slice(bodyStart);
    const nextSection = rest.search(/\n\[/);
    const body = nextSection === -1 ? rest : rest.slice(0, nextSection);
    let name: string | null = null;
    for (const rawLine of body.split('\n')) {
      const line = rawLine.replace(/#.*$/, '').trim();
      if (!line) continue;
      const kv = /^name\s*=\s*["']([^"']+)["']\s*$/.exec(line);
      if (kv && kv[1]) {
        name = kv[1];
        break;
      }
    }
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push({
      name,
      source: 'Cargo.toml',
      invoke: `cargo run --bin ${name}`,
      command: null,
    });
  }
  return out;
}

export function detectEntrypoints(root: string): EntrypointsSection | null {
  const all: Entrypoint[] = [
    ...readPackageScripts(root),
    ...readPyprojectScripts(root),
    ...readCargoBins(root),
    ...readMakeLikeTargets(join(root, 'Makefile'), 'Makefile', 'make'),
    ...readMakeLikeTargets(join(root, 'justfile'), 'justfile', 'just'),
  ];
  if (all.length === 0) return null;

  all.sort(compareEntrypoints);
  const entries = all.slice(0, DISPLAY_LIMIT);
  return { entries, truncated: all.length > DISPLAY_LIMIT };
}
