# Changelog

All notable changes to `ichnograph` follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

As of v0.2.0, the text and `--json` output are considered stable —
they will not break without a major-version bump.

## [Unreleased]
### Added
- Stack detector now reads `name` and `version` from `build.zig.zon` (Zig).
  Brings Zig into the detected-language matrix. Accepts both the modern
  enum-literal form (`.name = .my_pkg`, Zig 0.14+) and the older quoted
  string form (`.name = "my_pkg"`). The `.version` lookup doesn't collide
  with `.minimum_zig_version` because the dotted form of the latter is
  `.minimum_zig_version`, not `.version` — no substring match risk.
- Stack detector now reads `name` and `version` from `shard.yml` (Crystal).
  Brings Crystal into the detected-language matrix. Top-level `^name:` /
  `^version:` only, so a nested `version:` under a `dependencies:` source
  spec (Crystal's `github: …\nversion: ~> x.y` form) can't masquerade as the
  shard's own version. Quotes are stripped and trailing `#` comments
  terminate the value cleanly — same shape as the `pubspec.yaml` lookup.
- Stack detector now reads `name` and `version` from a root-level `*.cabal`
  file (Haskell). Previously Haskell projects were invisible to detection.
  Field lookup is anchored at column 0 so an indented `version:` inside a
  `library`/`executable` stanza can't masquerade as the package's own
  version (cabal stanza fields are indented by convention). Field names
  are matched case-insensitively per the Cabal spec. If a root contains
  multiple `*.cabal` files (rare; cabal expects exactly one), the
  alphabetically first wins as a deterministic tie-break.

### Fixed
- Stack detector's Dart `name` lookup in `pubspec.yaml` now mirrors the
  `version` lookup: optional surrounding quotes are stripped and trailing
  `#` comments terminate the value cleanly. Previously a quoted
  `name: "my_pkg"` surfaced with literal quotes, and a bare
  `name: my_pkg # the package` happened to work only because YAML
  identifiers don't contain whitespace.

### Added
- Stack detector now reads `name` and `version` from `Project.toml` /
  `JuliaProject.toml` (Julia). Brings Julia into the detected-language
  matrix. Lookup is scoped to the top-of-file region (before the first
  `[section]` header) so a `version = "..."` line under `[compat]` or
  `[deps]` can't masquerade as the package's own version, mirroring the
  `gleam.toml` scoping. When both files exist, `JuliaProject.toml` wins
  (matching Julia's own load order — the prefix exists precisely to
  override a generic `Project.toml`).
- Stack detector now reads `name` and `version` from a root-level `*.gemspec`
  (Ruby). Previously both were hard-coded to `null` so a Ruby gem's identity
  was invisible in the stack section. When a `.gemspec` is present it
  becomes the reported `manifest` (preferred over `Gemfile` since the
  gemspec carries the gem's own metadata, not just dependency declarations).
  A `spec.version = MyGem::VERSION` reference — the canonical
  Bundler-scaffolded pattern — resolves through to the literal in
  `lib/<gem>/version.rb` so published gems surface their actual version
  instead of nothing. A `*.gemspec` alone is now sufficient to detect
  Ruby; previously detection required a `Gemfile`.
- Stack detector now reads `app` (as name) and `version` from `mix.exs`
  (Elixir). Previously both were hard-coded to `null` so an Elixir
  package's identity was invisible in the stack section. Lookup is
  scoped to the `def project do ... end` block so child-app specs
  appearing later in the file (inside an umbrella's deps list, for
  example) can't shadow the host project's values. A `version: @ver`
  reference resolves through to the module-level `@ver "..."`
  attribute — the canonical pattern for published Hex packages — so
  libraries that follow that idiom now surface their actual version
  instead of nothing.
- Stack detector now reads `version` from `gleam.toml`. Previously hard-coded
  to `null` so a Gleam package's version was invisible in the stack section.
  Lookup is scoped to the top-of-file region (before the first `[section]`
  header) so a `version = "..."` line under a subtable like
  `[dependencies.foo]` can't masquerade as the package's own version. Name
  lookup is scoped the same way for consistency, though it was already
  top-of-file by convention.
- Stack detector now reads `version` from `pubspec.yaml` (Dart/Flutter).
  Previously hard-coded to `null` so a Dart package's version was invisible
  in the stack section. Top-level `^version:` only, so nested
  `version:` entries under `dependencies:` aren't mistaken for the
  package's own version. Quotes are stripped; Flutter's build-suffix form
  (`1.0.0+42`) is preserved verbatim. Trailing `#` comments terminate the
  value cleanly.
- Stack detector now reads `name` and `version` from `deno.json` (JSR
  publishing surface). Previously these were hard-coded to `null` so a
  Deno package's identity was invisible in the stack section. When both
  `deno.json` and `deno.jsonc` are present, `deno.json` wins (matching
  Deno's own resolution). The `manifest` field now reflects which file
  was actually inspected — previously a project with only `deno.jsonc`
  was reported as `manifest: 'deno.json'`. JSONC with C-style comments
  still falls back to null name/version rather than pulling in a JSONC
  parser for a degraded surface.
- Stack detector now surfaces PHP frameworks from `composer.json`
  (`require` + `require-dev`): Laravel, Symfony, CakePHP, Yii,
  CodeIgniter, Slim, Laminas, Drupal, Statamic, Filament, Livewire,
  Inertia, PHPUnit, Pest. Composer's `version` field is also read now;
  it was previously hard-coded to `null`. Brings PHP to parity with the
  JS and Python framework detection paths.

### Fixed
- Inline-markdown stripping (used by both the readme summary and the
  notes summaries) now strips `<details>`, `<summary>`, `<figure>`, and
  `<figcaption>` tags. A GitHub-flavored README that wraps its
  description in a disclosure block (`<details><summary>What is this?
  </summary>…</details>`) previously surfaced the literal tags in the
  summary; the wrapped content now shines through the same way `<a>`
  or `<b>` already did. Same allowlist rationale: these are
  unambiguously HTML constructs in README/STATE prose — `summary` and
  `details` as bare placeholders (`<summary>`) are vanishingly rare
  compared to the disclosure-widget usage.
- Notes and readme detectors now decode HTML entities (named `&amp;`,
  `&lt;`, `&gt;`, `&quot;`, `&apos;`, `&nbsp;`, `&copy;`, `&mdash;`,
  `&hellip;`, smart quotes, and similar; numeric `&#39;` / `&#x2014;`)
  in the one-line summary. A README title like `AT&amp;T Toolkit`
  previously surfaced with the literal entity; it now collapses to
  `AT&T Toolkit`. Decoding runs *after* the HTML-tag strip so an
  encoded literal `&lt;b&gt;bold&lt;/b&gt;` survives the tag pass and
  emerges as `<b>bold</b>` rather than being eaten. `&amp;` is decoded
  in a single pass, so `&amp;lt;` produces `&lt;` (not `<`), matching
  HTML5 spec behavior. Unknown names like `&foo;` stay literal —
  guessing at sentinel-shaped tokens is worse than leaving them
  alone. `&nbsp;` decodes to a regular space so the final `.trim()`
  consumes it cleanly at summary boundaries. Surrogate-range numeric
  entities (`&#xD800;`) are rejected and stay literal.
- Notes and readme detectors now strip leading blockquote markers
  (`>`, `>>`) from the one-line summary. A `STATE.md` whose first line
  is `> Status: active` previously surfaced `> Status: active` verbatim;
  it now collapses to `Status: active`. CommonMark §5.1 makes the space
  after `>` optional (`>foo` works) and allows nesting (`>> reply`); the
  regex handles both. The marker is structure, not content — same
  reasoning as list markers being stripped. In the readme path, each
  line of a multi-line blockquote is dequoted before paragraph join, so
  a two-line `>` block collapses to a single coherent sentence; a line
  that's nothing but `>` (empty blockquote) terminates the paragraph,
  matching the empty-line terminator already in place.
- Notes and readme detectors now strip GFM footnote references
  (`[^1]`, `[^api-note]`) from the one-line summary. A README sentence
  like `A small tool[^1] for orienting in repos.` previously surfaced
  with the footnote marker intact; it now collapses to
  `A small tool for orienting in repos.`. The strip is restricted by a
  negative lookahead for `:` so a leading footnote definition line
  (`[^1]: …`) stays literal rather than being mangled into
  `: …` — definitions aren't refs and shouldn't be eaten by the same
  pass. Labels disallow whitespace and `]` per the GFM spec, matching
  what the parser would accept as a real reference.
- Notes and readme detectors now strip CommonMark's optional closing `#`
  sequence from ATX headings. `## Status ##` is a heading whose content
  is `Status` per spec §4.2; previously the trailing run surfaced
  verbatim as `Status ##`. The strip requires whitespace before the
  closing run, so `# foo#` (no separating space) stays literal as
  intended — the trailing `#` there is content, not a marker.
- Notes detector now strips a leading list marker (and optional GFM task
  checkbox) when extracting the one-line summary. A `TODO.md` whose first
  line is `- [ ] Wire up auth` previously surfaced the bullet and
  checkbox verbatim; it now collapses to `Wire up auth`. Bullet markers
  (`-`, `*`, `+`) and ordered markers (`1.`) are recognized; the
  checkbox group is restricted to `[ ]` / `[x]` / `[X]` so literal
  bracketed shortcuts like `- [draft] notes` survive — same reasoning
  as reference-link shortcuts being left alone in stripInlineMd. The
  marker requires trailing whitespace per CommonMark, so prose tokens
  like `-foo` aren't mis-classified.
- Notes and readme detectors now skip leading multi-line HTML comment
  blocks (a `<!--` that opens on one line and closes on a later one).
  The per-line strip helper only collapses comments contained within
  the string it sees, so a `<!--\nCopyright …\n-->` license header
  ahead of the title — or a TOC sentinel block sitting between title
  and paragraph — previously surfaced the literal `<!--` opener as
  the summary or title. Pattern mirrors the existing fenced-code-block
  skip: a block-at-start is digested away, a block mid-paragraph
  terminates the paragraph.
- Inline-markdown stripping (used by both the readme summary and the
  notes summaries) now strips a curated allowlist of common inline HTML
  tags (`<a>`, `<b>`, `<br>`, `<p>`, `<img>`, `<sub>`, `<sup>`, `<kbd>`,
  `<span>`, `<div>`, headings, table cells, and similar). Wrapped
  content shines through (`<a href="x">tool</a>` → `tool`); a
  `<p align="center"><b>Tool</b></p>` cluster used as a centered title
  now collapses to `Tool`. Non-HTML placeholders (`<name>`,
  `<your-token>`) are intentionally left alone — they're more often
  literal in prose than tag-shaped, and the existing autolink rules
  already covered the URL/email cases.
- Inline-markdown stripping (used by both the readme summary and the
  notes summaries) now strips HTML comments (`<!-- ... -->`). A
  `STATE.md` whose first non-blank line is a canonical-home marker
  (`<!-- canonical: foo.md -->`) previously surfaced that comment as
  the one-line summary; it now collapses to empty so the caller digs
  past it to the next real line. Mid-line comments consume their
  surrounding whitespace so no double space is left behind. The
  paragraph-level joiner in the readme detector handles comments that
  span lines as well.
- Inline-markdown stripping (used by both the readme summary and the
  notes summaries) now handles CommonMark autolinks: `<https://x>`,
  `<mailto:a@b>`, and `<a@b.com>` collapse to their URL/email content
  instead of surfacing with literal angle brackets. The URI form
  requires a scheme (letter then alphanum/`+.-`); the email form
  requires `user@host.tld`. Bare `<word>` literals in prose stay
  intact because they match neither pattern.
- Inline-markdown stripping (used by both the readme summary and the
  notes summaries) now handles reference-style links and images
  (`[text][ref]`, `![alt][ref]`). A README badge cluster like
  `[![CI][ci-badge]][ci-url]` previously surfaced with the brackets
  intact; it now collapses to `CI`. Bare bracketed shortcuts (`[draft]`,
  `[WIP]`) are intentionally left alone — too often literal in prose to
  safely strip.
- Entry-points detector now surfaces justfile recipes that declare
  parameters (`build target='debug':`, `bench *args:`,
  `deploy env stage:`). The previous header regex required `:`
  immediately after the recipe name, so any recipe with arguments was
  silently skipped. Makefile parsing keeps the strict regex since
  Makefile targets never carry inline parameter syntax and the looser
  pattern would mis-classify rare assignment lines like `KEY = "x:y"`.
- Entry-points detector now tolerates TOML-legal trailing comments on
  `[[bin]]` headers (e.g. `[[bin]]  # primary cli`). Previously the header
  regex required only whitespace before the newline, so such tables were
  silently skipped.
- Notes detector now strips inline markdown (code spans, bold/italic,
  links) from the one-line summary it extracts for `STATE.md`, `TODO.md`,
  etc. Previously a heading like `# **Status**: active` surfaced as
  `**Status**: active` with the literal asterisks.
- Notes detector now skips fenced code blocks (` ``` ` / `~~~`) when
  extracting the one-line summary. A note that led with an example
  block previously surfaced ` ``` ` (or ` ```ts `) as the summary; it
  now digs past the block to the next prose line.
- Readme detector now skips a leading fenced code block when extracting
  the first paragraph. A README that led with a usage/install snippet
  before the description previously surfaced the fence content as the
  summary; it now digs past the block to the real prose.
- Inline-markdown stripping (used by both the readme summary and the
  notes summaries) now handles image syntax. `![alt](url)` previously
  left a stray `!` because the link regex stripped `[alt](url)` but not
  the leading bang; images now collapse to the alt text (or are dropped
  entirely if alt is empty).
- Inline-markdown stripping now handles single-underscore italic
  (`_text_`). The bold form `__text__` was already supported but the
  italic form was not, so a heading like `# _draft_ status` previously
  surfaced as `_draft_ status`. Lookbehind/lookahead guards keep
  intraword underscores in identifiers like `CODE_OF_CONDUCT` intact.
- Inline-markdown stripping now handles strikethrough (`~~text~~`).
  Previously a heading like `# ~~old plan~~ new plan` surfaced with the
  literal tildes intact. The fence detection that runs before the strip
  helper still treats `~~~` as a code-fence marker, so the two don't
  collide.

## [0.4.0] — 2026-04-21
### Added
- Entry-points detector now surfaces `Cargo.toml` `[[bin]]` tables,
  invoking each as `cargo run --bin <name>`. Implicit bins (from
  `src/main.rs` or `src/bin/*.rs`) are not surfaced — only explicitly
  declared `[[bin]]` entries.

## [0.3.4] — 2026-04-20
### Added
- Entry-points detector now surfaces `pyproject.toml` console scripts from
  `[project.scripts]` (PEP 621) and `[tool.poetry.scripts]`. Poetry scripts
  use `poetry run <name>` as the invocation hint; PEP 621 scripts surface
  the bare name (on PATH after `pip install`).

### Changed
- README refreshed for the published-on-npm state: install section now
  covers `npm install -g` and `npx`, example output updated to the
  current surface, and the Commands detector description notes
  `pyproject.toml` script tables alongside `package.json` /
  `Makefile` / `justfile`.

## [0.3.3] — 2026-04-20
### Changed
- Expanded `package.json` `keywords` from 4 to 16 entries covering the
  tool's actual search axes (repository summary, structure/tree, stack
  detection, git, readme, zero-dependency). Metadata-only.

## [0.3.2] — 2026-04-20
### Changed
- README footer now carries the `Copyright (c) 2026 KeMeK Network`
  notice so the holder is visible on the npm package page, not only
  inside `LICENSE`.

## [0.3.1] — 2026-04-20
### Changed
- `package.json` now carries `repository`, `homepage`, and `bugs`
  fields so the npm page links back to the GitHub source. No code
  change; metadata-only release.
- `bin` path normalized from `./dist/cli.js` to `dist/cli.js` to
  match what npm rewrites to at publish time (no functional effect).

## [0.3.0] — 2026-04-19
### Changed
- Project renamed from `alidade` to `ichnograph`. The prior name was
  never published; no redirect or compatibility shim is shipped.
- Binary renamed from `alidade` to `ichnograph`.
- Rationale: `alidade` risked namespace friction with an active real
  estate private-equity firm (Alidade Capital LLC). `ichnograph` —
  Vitruvius's term for an architectural plan drawn from directly above
  — fits the tool better semantically and is verified conflict-cold
  across npm, GitHub, USPTO, and general web search.
- No behavior, CLI flag, text output, or JSON schema changes. Public
  surface is unchanged except for the binary name.

## [0.2.0] — 2026-04-19
### Changed
- Project renamed from `glance` to `alidade`. The prior name was never
  published, so no redirect or compatibility shim is shipped.
- Binary renamed from `glance` to `alidade`.
- `--json` schema at `schemaVersion: 1` is now frozen. Future additive
  fields will not bump `schemaVersion`; breaking changes will.

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
