import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type StackHit = {
  language: string;
  manifest: string;
  name?: string;
  version?: string;
  frameworks: string[];
};

function readJsonSafe(path: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function readTextSafe(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

const JS_FRAMEWORK_MAP: Array<[string, string]> = [
  ['@sveltejs/kit', 'SvelteKit'],
  ['svelte', 'Svelte'],
  ['next', 'Next.js'],
  ['nuxt', 'Nuxt'],
  ['@angular/core', 'Angular'],
  ['react', 'React'],
  ['vue', 'Vue'],
  ['astro', 'Astro'],
  ['solid-js', 'SolidJS'],
  ['qwik', 'Qwik'],
  ['vite', 'Vite'],
  ['vitest', 'Vitest'],
  ['jest', 'Jest'],
  ['express', 'Express'],
  ['fastify', 'Fastify'],
  ['hono', 'Hono'],
  ['electron', 'Electron'],
  ['tauri', 'Tauri'],
  ['@anthropic-ai/sdk', 'Claude SDK'],
  ['openai', 'OpenAI SDK'],
];

function detectJsFrameworks(pkg: Record<string, unknown>): string[] {
  const deps: Record<string, unknown> = {
    ...((pkg.dependencies as Record<string, unknown>) ?? {}),
    ...((pkg.devDependencies as Record<string, unknown>) ?? {}),
    ...((pkg.peerDependencies as Record<string, unknown>) ?? {}),
  };
  const hits: string[] = [];
  for (const [dep, label] of JS_FRAMEWORK_MAP) {
    if (dep in deps) hits.push(label);
  }
  return hits;
}

function detectPyFrameworks(text: string): string[] {
  const hits: string[] = [];
  const hay = text.toLowerCase();
  const map: Array<[RegExp, string]> = [
    [/\bdjango\b/, 'Django'],
    [/\bfastapi\b/, 'FastAPI'],
    [/\bflask\b/, 'Flask'],
    [/\bstarlette\b/, 'Starlette'],
    [/\bpytest\b/, 'pytest'],
    [/\bpydantic\b/, 'Pydantic'],
    [/\banthropic\b/, 'Claude SDK'],
    [/\bopenai\b/, 'OpenAI SDK'],
  ];
  for (const [re, label] of map) {
    if (re.test(hay)) hits.push(label);
  }
  return hits;
}

function extractTomlField(text: string, section: string, field: string): string | undefined {
  const sectionRe = new RegExp(`\\[${section.replace('.', '\\.')}\\]([\\s\\S]*?)(\\n\\[|$)`, 'i');
  const match = text.match(sectionRe);
  if (!match || match[1] === undefined) return undefined;
  const fieldRe = new RegExp(`^\\s*${field}\\s*=\\s*["']([^"']+)["']`, 'm');
  const f = match[1].match(fieldRe);
  return f?.[1];
}

export function detectStack(root: string): StackHit[] {
  const hits: StackHit[] = [];

  const pkgPath = join(root, 'package.json');
  if (existsSync(pkgPath)) {
    const pkg = readJsonSafe(pkgPath);
    const hasTs = existsSync(join(root, 'tsconfig.json'));
    if (pkg) {
      hits.push({
        language: hasTs ? 'TypeScript' : 'JavaScript',
        manifest: 'package.json',
        name: typeof pkg.name === 'string' ? pkg.name : undefined,
        version: typeof pkg.version === 'string' ? pkg.version : undefined,
        frameworks: detectJsFrameworks(pkg),
      });
    }
  }

  const pyprojectPath = join(root, 'pyproject.toml');
  if (existsSync(pyprojectPath)) {
    const text = readTextSafe(pyprojectPath) ?? '';
    const name =
      extractTomlField(text, 'project', 'name') ??
      extractTomlField(text, 'tool.poetry', 'name');
    const version =
      extractTomlField(text, 'project', 'version') ??
      extractTomlField(text, 'tool.poetry', 'version');
    hits.push({
      language: 'Python',
      manifest: 'pyproject.toml',
      name,
      version,
      frameworks: detectPyFrameworks(text),
    });
  } else if (existsSync(join(root, 'requirements.txt'))) {
    const text = readTextSafe(join(root, 'requirements.txt')) ?? '';
    hits.push({
      language: 'Python',
      manifest: 'requirements.txt',
      frameworks: detectPyFrameworks(text),
    });
  }

  const cargoPath = join(root, 'Cargo.toml');
  if (existsSync(cargoPath)) {
    const text = readTextSafe(cargoPath) ?? '';
    hits.push({
      language: 'Rust',
      manifest: 'Cargo.toml',
      name: extractTomlField(text, 'package', 'name'),
      version: extractTomlField(text, 'package', 'version'),
      frameworks: [],
    });
  }

  const goModPath = join(root, 'go.mod');
  if (existsSync(goModPath)) {
    const text = readTextSafe(goModPath) ?? '';
    const m = text.match(/^module\s+(\S+)/m);
    hits.push({
      language: 'Go',
      manifest: 'go.mod',
      name: m?.[1],
      frameworks: [],
    });
  }

  if (existsSync(join(root, 'deno.json')) || existsSync(join(root, 'deno.jsonc'))) {
    hits.push({ language: 'Deno', manifest: 'deno.json', frameworks: [] });
  }

  if (existsSync(join(root, 'gleam.toml'))) {
    const text = readTextSafe(join(root, 'gleam.toml')) ?? '';
    hits.push({
      language: 'Gleam',
      manifest: 'gleam.toml',
      name: text.match(/^\s*name\s*=\s*"([^"]+)"/m)?.[1],
      frameworks: [],
    });
  }

  if (existsSync(join(root, 'mix.exs'))) {
    hits.push({ language: 'Elixir', manifest: 'mix.exs', frameworks: [] });
  }

  if (existsSync(join(root, 'Gemfile'))) {
    hits.push({ language: 'Ruby', manifest: 'Gemfile', frameworks: [] });
  }

  if (existsSync(join(root, 'composer.json'))) {
    const pkg = readJsonSafe(join(root, 'composer.json'));
    hits.push({
      language: 'PHP',
      manifest: 'composer.json',
      name: typeof pkg?.name === 'string' ? pkg.name : undefined,
      frameworks: [],
    });
  }

  if (existsSync(join(root, 'pubspec.yaml'))) {
    const text = readTextSafe(join(root, 'pubspec.yaml')) ?? '';
    hits.push({
      language: 'Dart',
      manifest: 'pubspec.yaml',
      name: text.match(/^name:\s*(\S+)/m)?.[1],
      frameworks: /flutter:/m.test(text) ? ['Flutter'] : [],
    });
  }

  return hits;
}
