# Changelog

All notable changes to `glance` follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Nothing in the v0.1.x series is a stable public API. Wait for v0.2 before
scripting against either the text or `--json` output.

## [Unreleased]

### Planned for v0.2
- Freeze `--json` schema at `schemaVersion: 1`.
- Publish under a final name (see npm name research).

## [0.1.17] — 2026-04-19
### Added
- New `commands` section surfaces invokable entry points: `package.json`
  `scripts`, `Makefile` targets, and `justfile` recipes. Ordered by
  likely priority (`dev`, `start`, `build`, `test`, …) then alphabetical.
  Capped at 8 entries with truncation marker.
- JSON schema gains `entrypoints` with `entries` (`name`, `source`,
  `invoke`, `command`) and `truncated`. Provisional v0.1.x schema.

### Not yet covered
- `pyproject.toml` `[project.scripts]` / `[tool.poetry.scripts]` — needs
  TOML parsing beyond the minimal parser used for stack detection.
- `Cargo.toml` `[[bin]]`.

## [0.1.16] — 2026-04-19
### Added
- Git section now reports working-tree status next to the branch
  (`branch: dev · 3 modified · 1 untracked`, or `· clean`).
- Git section shows a short list of in-progress files (working-tree
  changes) or, on a clean tree, files touched by the last commit —
  capped at 5 entries with truncation marker.
- JSON schema gains `git.status` (`staged` / `modified` / `untracked`
  counts) and `git.changed` (`source: 'working' | 'last-commit'`,
  `files`, `truncated`). Still under the provisional v0.1.x schema.

## [0.1.15] — 2026-04-18
### Changed
- README refreshed with current demo output, `schemaVersion` note, and
  documented `--json` stability promise.
- CHANGELOG added.

## [0.1.14] — 2026-04-18
### Changed
- Added "why" comments for the handful of non-obvious decisions:
  symlink skip in the tree walker, two-step branch resolution in git
  detector, `\x1f` unit-separator in `git log` format, minimal-TOML
  limitations, color precedence per `NO_COLOR`/`FORCE_COLOR` specs, and
  why `--json` force-disables ANSI.

## [0.1.13] — 2026-04-18
### Added
- CLI errors on extra positional arguments instead of silently ignoring.
### Fixed
- Tree coloring no longer mis-clips directory names containing spaces.

## [0.1.12] — 2026-04-18
### Changed
- `--json` output stabilized: added top-level `schemaVersion: 1`,
  dropped redundant `tree.root`, normalized all optional string fields
  to explicit `null` (so consumers can distinguish absent from unknown).

## [0.1.11] — 2026-04-18
### Added
- Tests for `git.ts` detector.
### Fixed
- Commit subjects containing the `\x1f` field separator are no longer
  truncated.
- Branch detection now works on empty repositories (no commits yet) via
  `git symbolic-ref`, falling back to `rev-parse` for detached HEAD.

## [0.1.10] — 2026-04-18
### Fixed
- Tree walker now skips symlinks, preventing infinite loops on circular
  links and escape via links pointing outside the target directory.

## [0.1.9] — 2026-04-18
### Changed
- README polished with captured demo output, feature matrix, install
  and development instructions.

## [0.1.8] — 2026-04-18
### Added
- Vitest test suite covering `tree`, `stack`, `readme`, `notes`
  detectors. 19 tests.

## [0.1.7] — 2026-04-18
### Added
- CLI flags: `--depth`, `--commits`, `--json`, `-d` short form.
- Strict argument parsing with non-negative-integer validation.

## [0.1.6] — 2026-04-18
### Added
- Zero-dependency ANSI color output.
- `--no-color` flag and `NO_COLOR` / `FORCE_COLOR` env support.

## [0.1.5] — 2026-04-18
### Added
- Notes section surfaces top-level `STATE`, `TODO`, `ROADMAP`,
  `CHANGELOG`, `SPEC*`, numbered specs (`0X-*.md`), `ARCHITECTURE`,
  `CONTRIBUTING`, `SECURITY`, `CODE_OF_CONDUCT`, `CLAUDE.md`,
  `AGENTS.md`, `adrs/`, `docs/`.

## [0.1.4] — 2026-04-18
### Added
- Git section: current branch and last N commits via `spawnSync` (no
  shell).

## [0.1.3] — 2026-04-18
### Added
- README detector: title + first-paragraph extraction, YAML
  frontmatter-aware, inline markdown stripped.

## [0.1.2] — 2026-04-18
### Added
- Stack detection across JS/TS, Python, Rust, Go, Deno, Gleam, Elixir,
  Ruby, PHP, Dart with framework hints (Svelte, Next, Astro, Vite,
  Vitest, Claude SDK, and more).

## [0.1.1] — 2026-04-18
### Added
- Directory tree detector with depth limit, sorted output, ignore
  rules for `node_modules`, `.git`, `dist`, `target`, `.venv`, and
  similar vendor/build dirs.

## [0.1.0] — 2026-04-18
### Added
- Project scaffold: TypeScript, Node ≥20, MIT.
- CLI entry with `--help` and `--version`.
- Placeholder report output.
