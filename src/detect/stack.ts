import { existsSync, readdirSync, readFileSync } from 'node:fs';
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

function findGemspec(root: string): string | null {
  try {
    for (const entry of readdirSync(root)) {
      if (entry.endsWith('.gemspec')) return entry;
    }
  } catch {
    // unreadable root — caller falls back to other detectors
  }
  return null;
}

function findCabalFile(root: string): string | null {
  try {
    // Cabal expects exactly one *.cabal at the package root; if there are
    // somehow several, alphabetical is a deterministic tie-break.
    const cabals = readdirSync(root).filter((e) => e.endsWith('.cabal')).sort();
    return cabals[0] ?? null;
  } catch {
    return null;
  }
}

function findRubyVersionConstant(root: string): string | null {
  const libDir = join(root, 'lib');
  if (!existsSync(libDir)) return null;
  const candidates: string[] = [join(libDir, 'version.rb')];
  try {
    for (const entry of readdirSync(libDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        candidates.push(join(libDir, entry.name, 'version.rb'));
      }
    }
  } catch {
    // unreadable lib/ — fall through with whatever candidates we have
  }
  for (const path of candidates) {
    const text = readTextSafe(path);
    if (!text) continue;
    // Anchor at line start so a commented-out `# VERSION = "old"` is skipped
    // and FROZEN_STRING_LITERAL pragmas higher in the file don't interfere.
    const match = text.match(/^\s*VERSION\s*=\s*["']([^"']+)["']/m);
    if (match?.[1]) return match[1];
  }
  return null;
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
    const text = readTextSafe(join(root, 'mix.exs')) ?? '';
    // mix.exs is Elixir code; the project keyword list inside `def project do
    // ... end` carries the metadata we want. Scope name/version lookups to
    // that block so child-app specs (e.g. inside an umbrella's deps list)
    // can't shadow the host project's values. The non-greedy `end` match
    // assumes the body has no nested do/end — typical for a project
    // function that returns a literal keyword list.
    const projectBlock = text.match(/def\s+project\s*(?:\(\s*\))?\s*do\b([\s\S]*?)\n\s*end\b/);
    const scope = projectBlock?.[1] ?? '';
    const appMatch = scope.match(/\bapp:\s*:([A-Za-z_][A-Za-z0-9_]*[?!]?)/);
    const versionLiteral = scope.match(/\bversion:\s*"([^"]+)"/)?.[1];
    // `version: @ver` referencing a module attribute is the canonical pattern
    // for Hex packages — resolve it from the module-level `@ver "..."` line.
    let version: string | null = versionLiteral ?? null;
    if (version === null) {
      const attrRef = scope.match(/\bversion:\s*@([A-Za-z_][A-Za-z0-9_]*)/)?.[1];
      if (attrRef) {
        const attrRe = new RegExp(`@${attrRef}\\s+"([^"]+)"`);
        version = text.match(attrRe)?.[1] ?? null;
      }
    }
    hits.push({
      language: 'Elixir',
      manifest: 'mix.exs',
      name: appMatch?.[1] ?? null,
      version,
      frameworks: [],
    });
  }

  const gemspecName = findGemspec(root);
  if (gemspecName || existsSync(join(root, 'Gemfile'))) {
    // Prefer .gemspec when present — it carries the gem's own name and version,
    // while Gemfile only lists dependencies. The gemspec is also the artifact
    // RubyGems publishes from, so its values are the canonical identity.
    let name: string | null = null;
    let version: string | null = null;
    if (gemspecName) {
      const text = readTextSafe(join(root, gemspecName)) ?? '';
      name = text.match(/^\s*\w+\.name\s*=\s*["']([^"']+)["']/m)?.[1] ?? null;
      version = text.match(/^\s*\w+\.version\s*=\s*["']([^"']+)["']/m)?.[1] ?? null;
      if (version === null) {
        // Canonical Bundler-scaffolded gemspecs reference a VERSION constant
        // (`spec.version = MyGem::VERSION`) defined in lib/<gem>/version.rb.
        // Resolve through to the literal so published gems surface their
        // real version instead of nothing.
        const constRef = text.match(/^\s*\w+\.version\s*=\s*[A-Z]\w*(?:::\w+)*\s*$/m);
        if (constRef) version = findRubyVersionConstant(root);
      }
    }
    hits.push({
      language: 'Ruby',
      manifest: gemspecName ?? 'Gemfile',
      name,
      version,
      frameworks: [],
    });
  }

  // JuliaProject.toml takes precedence over Project.toml when both exist
  // (Julia loads it first; the prefix exists to avoid conflicts with other
  // ecosystems that also use a bare `Project.toml`).
  const juliaProjectExists = existsSync(join(root, 'JuliaProject.toml'));
  const projectTomlExists = existsSync(join(root, 'Project.toml'));
  if (juliaProjectExists || projectTomlExists) {
    const manifest = juliaProjectExists ? 'JuliaProject.toml' : 'Project.toml';
    const text = readTextSafe(join(root, manifest)) ?? '';
    // Limit lookup to the top-of-file region (before the first [section]
    // header) so a `version = "..."` under [compat] or [deps] can't be
    // misread as the package's own version. Name is top-of-file by
    // convention; apply the same scope for consistency.
    const topLevel = text.split(/^\[/m)[0] ?? text;
    hits.push({
      language: 'Julia',
      manifest,
      name: topLevel.match(/^\s*name\s*=\s*"([^"]+)"/m)?.[1] ?? null,
      version: topLevel.match(/^\s*version\s*=\s*"([^"]+)"/m)?.[1] ?? null,
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

  const cabalName = findCabalFile(root);
  if (cabalName) {
    const text = readTextSafe(join(root, cabalName)) ?? '';
    // Cabal fields are case-insensitive and line-oriented at column 0. Values
    // run to the end of the line; for name/version they're a bare token so a
    // simple `\S+` capture is sufficient. Continuation lines (indented) are
    // unused for these scalar fields in practice.
    const nameMatch = text.match(/^name\s*:\s*(\S+)/im);
    const versionMatch = text.match(/^version\s*:\s*(\S+)/im);
    hits.push({
      language: 'Haskell',
      manifest: cabalName,
      name: nameMatch?.[1] ?? null,
      version: versionMatch?.[1] ?? null,
      frameworks: [],
    });
  }

  if (existsSync(join(root, 'shard.yml'))) {
    const text = readTextSafe(join(root, 'shard.yml')) ?? '';
    // shard.yml is YAML; the canonical fields are top-level `name:` and
    // `version:`. Anchor both at column 0 so a nested `version:` under
    // `dependencies:` (Crystal's git/path/version source spec form) can't
    // masquerade as the shard's own version. Quotes are stripped and a
    // trailing `#` comment terminates the value cleanly — same shape as the
    // pubspec.yaml lookup.
    const nameMatch = text.match(/^name:\s*['"]?([^'"\s#]+)['"]?/m);
    const versionMatch = text.match(/^version:\s*['"]?([^'"\s#]+)['"]?/m);
    hits.push({
      language: 'Crystal',
      manifest: 'shard.yml',
      name: nameMatch?.[1] ?? null,
      version: versionMatch?.[1] ?? null,
      frameworks: [],
    });
  }

  if (existsSync(join(root, 'build.zig.zon'))) {
    const text = readTextSafe(join(root, 'build.zig.zon')) ?? '';
    // ZON (Zig Object Notation). Zig 0.14+ writes name as an enum literal
    // (`.name = .my_pkg`); earlier releases used a quoted string
    // (`.name = "my_pkg"`). Accept both. Version is always a quoted string.
    // The `.minimum_zig_version` field doesn't collide with `.version`
    // because its leading-dot form is `.minimum_zig_version`, not
    // `.version` — no substring match risk.
    const nameLiteral = text.match(/\.name\s*=\s*\.([A-Za-z_][A-Za-z0-9_]*)/)?.[1];
    const nameString = text.match(/\.name\s*=\s*"([^"]+)"/)?.[1];
    const versionMatch = text.match(/\.version\s*=\s*"([^"]+)"/);
    hits.push({
      language: 'Zig',
      manifest: 'build.zig.zon',
      name: nameLiteral ?? nameString ?? null,
      version: versionMatch?.[1] ?? null,
      frameworks: [],
    });
  }

  if (existsSync(join(root, 'pubspec.yaml'))) {
    const text = readTextSafe(join(root, 'pubspec.yaml')) ?? '';
    // Top-level keys only (no leading whitespace) so nested `version:` under
    // dependencies isn't misread as the package's own version. The value may
    // be quoted ("1.0.0") or bare (1.0.0), and Flutter apps commonly append
    // a build suffix (1.0.0+1) which is preserved verbatim.
    const versionMatch = text.match(/^version:\s*['"]?([^'"\s#]+)['"]?/m);
    // Name supports the same optional-quote form as version so a quoted
    // `name: "my_pkg"` doesn't surface with literal quotes; trailing `#`
    // comments are terminated cleanly the same way.
    const nameMatch = text.match(/^name:\s*['"]?([^'"\s#]+)['"]?/m);
    hits.push({
      language: 'Dart',
      manifest: 'pubspec.yaml',
      name: nameMatch?.[1] ?? null,
      version: versionMatch?.[1] ?? null,
      frameworks: /flutter:/m.test(text) ? ['Flutter'] : [],
    });
  }

  return hits;
}
