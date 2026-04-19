# glance

One-screen orientation for any codebase.

Run `glance` in a repo (or point it at one) and get a single-screen
report: README excerpt, stack, surfaced note files (STATE, TODO,
CHANGELOG, specs, ADRs), recent commits, and a structure tree. No
config. No runtime dependencies. Designed as the first thing you run
in an unfamiliar repo — or your own, a month later.

## Example

```text
glance
/home/you/projects/glance

readme
──────
glance

One-screen orientation for any codebase.

stack
─────
TypeScript   glance@0.1.9 · Vitest

notes
─────
CLAUDE.md  glance — project notes (local only)

git
───
branch: dev

ccb3f9c  7 seconds ago   v0.1.8: vitest suite covering detectors
49be503  3 minutes ago   v0.1.7: CLI flags --depth, --commits, --json
0c79bf9  4 minutes ago   v0.1.6: zero-dep ANSI colors

structure
─────────
├── src/
│   ├── detect/
│   │   ├── git.ts
│   │   ├── notes.ts
│   │   ├── readme.ts
│   │   ├── stack.ts
│   │   └── tree.ts
│   ├── cli.ts
│   ├── color.ts
│   ├── render.ts
│   ├── scan.ts
│   └── types.ts
├── README.md
├── package.json
└── tsconfig.json
```

## Install

Not yet published to npm. For now, clone and build:

```bash
git clone <repo-url> glance
cd glance
npm install
npm run build
node dist/cli.js --help
```

Or link it globally during development:

```bash
npm link
glance --help
```

## Usage

```bash
glance                       # report on cwd
glance ./path/to/repo        # report on a specific path
glance --depth 3             # show deeper structure
glance --commits 10          # show more recent commits
glance --json                # structured output (automation-friendly)
glance --no-color            # plain text, for pipes/logs
```

### Options

| Flag | Description |
|---|---|
| `-h`, `--help` | Show help |
| `-v`, `--version` | Show version |
| `-d`, `--depth <n>` | Tree depth (default `2`) |
| `--commits <n>` | Recent commits to show (default `5`) |
| `--json` | Emit JSON report instead of formatted text |
| `--no-color` | Disable ANSI colors (`NO_COLOR` env also respected) |

## What it detects

- **Stack** — package.json, pyproject.toml, Cargo.toml, go.mod,
  deno.json, gleam.toml, mix.exs, Gemfile, composer.json, pubspec.yaml.
  Framework hints (Svelte/SvelteKit, Next.js, Nuxt, React, Vue, Astro,
  Vite/Vitest, Express, Hono, Fastify, Django, FastAPI, Flask, Claude
  SDK, OpenAI SDK, and more).
- **README** — title + first paragraph, frontmatter-aware.
- **Notes** — STATE, TODO, ROADMAP, CHANGELOG, SPEC, numbered specs
  (`0X-*.md`), ARCHITECTURE, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT,
  CLAUDE.md, AGENTS.md, `adrs/`, `docs/`.
- **Git** — current branch + recent commits (via `git log`, short hash
  + relative time + subject).
- **Structure** — depth-limited tree with sensible ignores
  (`node_modules`, `.git`, `dist`, `.venv`, `target`, `.next`, etc.).

Each detector is independent and degrades gracefully — missing git,
missing README, unknown stack all just mean the section is omitted.

## Design

- **Zero runtime dependencies.** Ships as a single compiled entry.
- **Fast.** Straight fs walks, no globs, no AST parsing. Completes in
  milliseconds for typical repos.
- **Honest scope.** One screen, read-only, no config files, no
  plugins.

## Development

```bash
npm install
npm run build     # tsc → dist/
npm test          # vitest run
npm run test:watch
npm run dev       # tsx src/cli.ts (no build step)
```

## Status

v0.1.x series — API surface is the CLI output and the `--json` shape.
Neither is stable yet; wait for v0.2 before scripting against them.

## License

MIT — see [LICENSE](LICENSE).
