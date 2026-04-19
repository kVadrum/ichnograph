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
TypeScript   glance@0.1.15 · Vitest

notes
─────
CLAUDE.md  glance — project notes (local only)

git
───
branch: dev

a6ed1d9  12 seconds ago  v0.1.14: why-comments for non-obvious decisions
5b19514  2 minutes ago   v0.1.13: error on extra positionals
be852a1  2 minutes ago   v0.1.12: stabilize --json schema

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

- **Stack** — `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`,
  `deno.json`, `gleam.toml`, `mix.exs`, `Gemfile`, `composer.json`,
  `pubspec.yaml`. Framework hints (Svelte/SvelteKit, Next.js, Nuxt,
  React, Vue, Astro, Vite/Vitest, Express, Hono, Fastify, Django,
  FastAPI, Flask, Claude SDK, OpenAI SDK, and more).
- **README** — title + first paragraph, YAML frontmatter-aware.
- **Notes** — `STATE`, `TODO`, `ROADMAP`, `CHANGELOG`, `SPEC`,
  numbered specs (`0X-*.md`), `ARCHITECTURE`, `CONTRIBUTING`,
  `SECURITY`, `CODE_OF_CONDUCT`, `CLAUDE.md`, `AGENTS.md`, `adrs/`,
  `docs/`.
- **Git** — current branch + recent commits via `git log`. Works on
  empty repos (branch-only) and repos with a detached HEAD.
- **Structure** — depth-limited tree with sensible ignores
  (`node_modules`, `.git`, `dist`, `.venv`, `target`, `.next`,
  `.svelte-kit`, `.turbo`, and similar). Skips symlinks.

Each detector is independent and degrades gracefully — missing git,
missing README, unknown stack all just mean the section is omitted.

## JSON output

`--json` emits a structured report. Shape:

```jsonc
{
  "schemaVersion": 1,
  "target": "/abs/path/to/repo",
  "readme": { "file": "README.md", "title": "…", "summary": "…" } | null,
  "stacks": [
    {
      "language": "TypeScript",
      "manifest": "package.json",
      "name": "…" | null,
      "version": "…" | null,
      "frameworks": ["Vitest", …]
    }
  ],
  "git": {
    "branch": "dev" | null,
    "commits": [{ "hash": "a1b2c3d", "relTime": "5 minutes ago", "subject": "…" }]
  } | null,
  "notes": [{ "name": "STATE.md", "kind": "file" | "dir", "summary": "…" | null }],
  "tree": { "lines": ["├── src/", …], "truncated": false } | null
}
```

Rules for consumers:
- Optional fields are always present as an explicit `null`, never
  absent. Consumers can tell "missing" from "unknown."
- `schemaVersion: 1` is **provisional** through the v0.1.x series and
  will be frozen when v0.2 ships. Branch on the version.

## Design

- **Zero runtime dependencies.** Ships as a single compiled entry.
- **Fast.** Straight fs walks, no globs, no AST parsing. Completes in
  milliseconds for typical repos.
- **Honest scope.** One screen, read-only, no config files, no
  plugins.
- **Safe.** Skips symlinks so circular links can't loop and symlinks
  pointing outside the target can't escape. Runs `git` via
  `spawnSync` with fixed args — no shell, no injection surface.

## Development

```bash
npm install
npm run build       # tsc → dist/
npm test            # vitest run
npm run test:watch
npm run dev         # tsx src/cli.ts (no build step)
```

Tests live in `tests/` and use real temporary directories (no
filesystem mocks) — each detector is exercised against fixtures that
match the shapes it'll see in the wild.

## Status

v0.1.x series — API surface (text and `--json`) is not yet stable.
Wait for v0.2 before scripting against it. See [CHANGELOG.md](./CHANGELOG.md).

## License

MIT — see [LICENSE](LICENSE).
