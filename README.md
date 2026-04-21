# ichnograph

One-screen orientation for any codebase.

An ichnograph is the plan of a building drawn from directly above — the
footprint view. Vitruvius named it in *De Architectura* as one of the
three architectural drawings, alongside the elevation and the
perspective. This one draws the footprint of a repository. Run
`ichnograph` in any directory and get a single-screen report: README
excerpt, stack, runnable commands, surfaced notes (STATE, TODO,
CHANGELOG, specs, ADRs), git state with branch and what you were in the
middle of, and a structure tree. No config. No runtime dependencies.
Designed as the first thing you run in an unfamiliar repo — or your
own, a month later.

## Install

```bash
npm install -g ichnograph
ichnograph --help
```

Or run it ad-hoc without installing:

```bash
npx ichnograph
```

Requires Node.js 20 or newer.

## Example

```text
ichnograph
/home/you/projects/ichnograph

readme
──────
ichnograph

One-screen orientation for any codebase.

stack
─────
TypeScript   ichnograph@0.4.0 · Vitest

commands
────────
npm run dev             tsx src/cli.ts
npm run start           node dist/cli.js
npm run build           tsc
npm run test            vitest run
npm run test:watch      vitest

notes
─────
CHANGELOG.md  Changelog

git
───
branch: dev · 2 modified · 1 untracked

a6ed1d9  12 seconds ago  entrypoints: detect pyproject.toml scripts
0a3dc8c  5 minutes ago   v0.3.3: expand npm keywords for discoverability
2dfc644  6 minutes ago   v0.3.2: surface copyright notice on npm page

in progress:
  src/detect/entrypoints.ts
  tests/entrypoints.test.ts

structure
─────────
├── src/
│   ├── detect/
│   │   ├── entrypoints.ts
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

## Usage

```bash
ichnograph                       # report on cwd
ichnograph ./path/to/repo        # report on a specific path
ichnograph --depth 3             # show deeper structure
ichnograph --commits 10          # show more recent commits
ichnograph --json                # structured output (automation-friendly)
ichnograph --no-color            # plain text, for pipes/logs
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
- **Commands** — `package.json` `scripts`, `pyproject.toml`
  `[project.scripts]` (PEP 621) and `[tool.poetry.scripts]`,
  `Cargo.toml` `[[bin]]` tables, `Makefile` targets, `justfile`
  recipes. Ranked with likely entry points (`dev`, `start`, `build`,
  `test`, …) first, then alphabetical.
- **README** — title + first paragraph, YAML frontmatter-aware.
- **Notes** — `STATE`, `TODO`, `ROADMAP`, `CHANGELOG`, `SPEC`,
  numbered specs (`0X-*.md`), `ARCHITECTURE`, `CONTRIBUTING`,
  `SECURITY`, `CODE_OF_CONDUCT`, `CLAUDE.md`, `AGENTS.md`, `adrs/`,
  `docs/`.
- **Git** — branch, working-tree status (staged/modified/untracked),
  recent commits, and either the files you're in the middle of editing
  or — on a clean tree — the files touched by the last commit. Works
  on empty repos (branch-only) and repos with a detached HEAD.
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
  "entrypoints": {
    "entries": [
      { "name": "dev", "source": "package.json", "invoke": "npm run dev", "command": "tsx src/cli.ts" }
    ],
    "truncated": false
  } | null,
  "git": {
    "branch": "dev" | null,
    "commits": [{ "hash": "a1b2c3d", "relTime": "5 minutes ago", "subject": "…" }],
    "status": { "staged": 0, "modified": 2, "untracked": 1 } | null,
    "changed": { "source": "working" | "last-commit", "files": ["…"], "truncated": false } | null
  } | null,
  "notes": [{ "name": "STATE.md", "kind": "file" | "dir", "summary": "…" | null }],
  "tree": { "lines": ["├── src/", …], "truncated": false } | null
}
```

Rules for consumers:
- Optional fields are always present as an explicit `null`, never
  absent. Consumers can tell "missing" from "unknown."
- `schemaVersion: 1` is frozen as of v0.2. Future additive fields will
  not bump `schemaVersion`; breaking changes will.

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
git clone https://github.com/kVadrum/ichnograph.git
cd ichnograph
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

v0.4.0 — stable public surface, published on
[npm](https://www.npmjs.com/package/ichnograph). Text output and
`--json` schema won't break without a major version bump. See
[CHANGELOG.md](./CHANGELOG.md).

## License

MIT — see [LICENSE](LICENSE).

Copyright (c) 2026 KeMeK Network
