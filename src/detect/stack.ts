import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type StackHit = {
  language: string;
  manifest: string;
  name: string | null;
  version: string | null;
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

const PHP_FRAMEWORK_MAP: Array<[string, string]> = [
  ['laravel/framework', 'Laravel'],
  ['symfony/framework-bundle', 'Symfony'],
  ['symfony/symfony', 'Symfony'],
  ['cakephp/cakephp', 'CakePHP'],
  ['yiisoft/yii2', 'Yii'],
  ['codeigniter4/framework', 'CodeIgniter'],
  ['slim/slim', 'Slim'],
  ['laminas/laminas-mvc', 'Laminas'],
  ['drupal/core', 'Drupal'],
  ['statamic/cms', 'Statamic'],
  ['filament/filament', 'Filament'],
  ['livewire/livewire', 'Livewire'],
  ['inertiajs/inertia-laravel', 'Inertia'],
  ['phpunit/phpunit', 'PHPUnit'],
  ['pestphp/pest', 'Pest'],
];

function detectPhpFrameworks(pkg: Record<string, unknown>): string[] {
  const deps: Record<string, unknown> = {
    ...((pkg.require as Record<string, unknown>) ?? {}),
    ...((pkg['require-dev'] as Record<string, unknown>) ?? {}),
  };
  const hits: string[] = [];
  for (const [dep, label] of PHP_FRAMEWORK_MAP) {
    if (dep in deps && !hits.includes(label)) hits.push(label);
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

// Minimal TOML reader: handles single-line `key = "value"` only. Does NOT
// handle multiline strings, arrays-of-tables, or inline tables. Sufficient
// for the name/version fields we care about; upgrade to a real parser if
// we start reading structured TOML.
function extractTomlField(text: string, section: string, field: string): string | null {
  const sectionRe = new RegExp(`\\[${section.replace('.', '\\.')}\\]([\\s\\S]*?)(\\n\\[|$)`, 'i');
  const match = text.match(sectionRe);
  if (!match || match[1] === undefined) return null;
  const fieldRe = new RegExp(`^\\s*${field}\\s*=\\s*["']([^"']+)["']`, 'm');
  const f = match[1].match(fieldRe);
  return f?.[1] ?? null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
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
        name: stringOrNull(pkg.name),
        version: stringOrNull(pkg.version),
        frameworks: detectJsFrameworks(pkg),
      });
    }
  }

  const pyprojectPath = join(root, 'pyproject.toml');
  if (existsSync(pyprojectPath)) {
    const text = readTextSafe(pyprojectPath) ?? '';
    hits.push({
      language: 'Python',
      manifest: 'pyproject.toml',
      name:
        extractTomlField(text, 'project', 'name') ??
        extractTomlField(text, 'tool.poetry', 'name'),
      version:
        extractTomlField(text, 'project', 'version') ??
        extractTomlField(text, 'tool.poetry', 'version'),
      frameworks: detectPyFrameworks(text),
    });
  } else if (existsSync(join(root, 'requirements.txt'))) {
    const text = readTextSafe(join(root, 'requirements.txt')) ?? '';
    hits.push({
      language: 'Python',
      manifest: 'requirements.txt',
      name: null,
      version: null,
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
      name: m?.[1] ?? null,
      version: null,
      frameworks: [],
    });
  }

  const denoJsonExists = existsSync(join(root, 'deno.json'));
  const denoJsoncExists = existsSync(join(root, 'deno.jsonc'));
  if (denoJsonExists || denoJsoncExists) {
    // Prefer deno.json over deno.jsonc when both exist (Deno itself does too).
    // readJsonSafe handles standard JSON; deno.jsonc with C-style comments
    // returns null and we fall back to nulls for name/version rather than
    // pulling in a JSONC parser for a degraded surface.
    const manifest = denoJsonExists ? 'deno.json' : 'deno.jsonc';
    const cfg = readJsonSafe(join(root, manifest));
    hits.push({
      language: 'Deno',
      manifest,
      name: stringOrNull(cfg?.name),
      version: stringOrNull(cfg?.version),
      frameworks: [],
    });
  }

  if (existsSync(join(root, 'gleam.toml'))) {
    const text = readTextSafe(join(root, 'gleam.toml')) ?? '';
    // Limit version lookup to the top-of-file region (before the first
    // [section] header) so a `version = "..."` line under a subtable like
    // [dependencies.foo] can't masquerade as the package's own version.
    // Name was already top-of-file by convention, but apply the same scope
    // for consistency.
    const topLevel = text.split(/^\[/m)[0] ?? text;
    hits.push({
      language: 'Gleam',
      manifest: 'gleam.toml',
      name: topLevel.match(/^\s*name\s*=\s*"([^"]+)"/m)?.[1] ?? null,
      version: topLevel.match(/^\s*version\s*=\s*"([^"]+)"/m)?.[1] ?? null,
      frameworks: [],
    });
  }

  if (existsSync(join(root, 'mix.exs'))) {
    hits.push({
      language: 'Elixir',
      manifest: 'mix.exs',
      name: null,
      version: null,
      frameworks: [],
    });
  }

  if (existsSync(join(root, 'Gemfile'))) {
    hits.push({
      language: 'Ruby',
      manifest: 'Gemfile',
      name: null,
      version: null,
      frameworks: [],
    });
  }

  if (existsSync(join(root, 'composer.json'))) {
    const pkg = readJsonSafe(join(root, 'composer.json'));
    hits.push({
      language: 'PHP',
      manifest: 'composer.json',
      name: stringOrNull(pkg?.name),
      version: stringOrNull(pkg?.version),
      frameworks: pkg ? detectPhpFrameworks(pkg) : [],
    });
  }

  if (existsSync(join(root, 'pubspec.yaml'))) {
    const text = readTextSafe(join(root, 'pubspec.yaml')) ?? '';
    // Top-level keys only (no leading whitespace) so nested `version:` under
    // dependencies isn't misread as the package's own version. The value may
    // be quoted ("1.0.0") or bare (1.0.0), and Flutter apps commonly append
    // a build suffix (1.0.0+1) which is preserved verbatim.
    const versionMatch = text.match(/^version:\s*['"]?([^'"\s#]+)['"]?/m);
    hits.push({
      language: 'Dart',
      manifest: 'pubspec.yaml',
      name: text.match(/^name:\s*(\S+)/m)?.[1] ?? null,
      version: versionMatch?.[1] ?? null,
      frameworks: /flutter:/m.test(text) ? ['Flutter'] : [],
    });
  }

  return hits;
}
