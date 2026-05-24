# ichnograph — morning log

One line per autonomous daily session. Newest at the bottom. Each row
points at the rich report under `sessions/`.

Formats:
- `YYYY-MM-DD shipped <short-sha> — "<summary>" → sessions/YYYY-MM-DD.md`
- `YYYY-MM-DD skipped — "<brief reason>" → sessions/YYYY-MM-DD.md`
- `YYYY-MM-DD blocked — "<what got in the way>" → sessions/YYYY-MM-DD.md`

---

2026-04-20 shipped 1e32743 — "entrypoints: detect pyproject.toml console scripts" → sessions/2026-04-20.md
2026-04-21 shipped 16e8084 — "entrypoints: detect Cargo.toml [[bin]] tables" → sessions/2026-04-21.md
2026-04-22 shipped 0e841db — "readme: handle setext-style headings (Title\n===)" → sessions/2026-04-22.md
2026-04-23 shipped 7a3a8d8 — "entrypoints: tolerate trailing comments on Cargo [[bin]] headers" → sessions/2026-04-23.md
2026-04-24 shipped 4abb271 — "notes: strip inline markdown from summaries" → sessions/2026-04-24.md
2026-04-26 shipped f6a8b23 — "notes: skip fenced code blocks when extracting summary" → sessions/2026-04-26.md
2026-04-27 shipped 138725b — "readme: skip leading fenced code block when extracting summary" → sessions/2026-04-27.md
2026-04-28 shipped c492ec7 — "notes/readme: strip image syntax without leaving stray !" → sessions/2026-04-28.md
2026-04-29 blocked — "code committed locally as 862cb00 but git push could not auth to github" → sessions/2026-04-29.md
2026-04-30 shipped 4dbabdc — "notes/readme: strip strikethrough (~~text~~) from summaries" → sessions/2026-04-30.md
2026-05-01 shipped 7fb8208 — "entrypoints: detect justfile recipes with parameters" → sessions/2026-05-01.md
2026-05-02 shipped 49c9ff1 — "notes/readme: strip reference-style links and images from summaries" → sessions/2026-05-02.md
2026-05-04 shipped 5015462 — "notes/readme: strip CommonMark autolink angle brackets" → sessions/2026-05-04.md
2026-05-05 shipped 37a3d2d — "notes/readme: strip HTML comments from summaries" → sessions/2026-05-05.md
2026-05-06 shipped c4cb768 — "notes/readme: strip common inline HTML tags from summaries" → sessions/2026-05-06.md
2026-05-07 shipped 25a8d6c — "notes/readme: skip leading multi-line HTML comment blocks" → sessions/2026-05-07.md
2026-05-08 shipped 643b0f6 — "notes: strip list marker and GFM task checkbox from summaries" → sessions/2026-05-08.md
2026-05-09 shipped 32d0de5 — "notes/readme: strip optional closing # sequence from ATX headings" → sessions/2026-05-09.md
2026-05-10 shipped 3b888a0 — "stack: detect PHP frameworks and version in composer.json" → sessions/2026-05-10.md
2026-05-11 shipped a76c81f — "notes/readme: strip GFM footnote references from summaries" → sessions/2026-05-11.md
2026-05-12 shipped 7a22a8b — "notes/readme: strip leading blockquote markers from summaries" → sessions/2026-05-12.md
2026-05-13 shipped 5120eaf — "notes/readme: decode HTML entities in summaries" → sessions/2026-05-13.md
2026-05-14 shipped f9566b2 — "notes/readme: strip <details>/<summary>/<figure>/<figcaption>" → sessions/2026-05-14.md
2026-05-15 shipped 6f08072 — "stack: read name and version from deno.json" → sessions/2026-05-15.md
2026-05-16 shipped 3d18f17 — "stack: read version from pubspec.yaml" → sessions/2026-05-16.md
2026-05-17 shipped a119fbc — "stack: read version from gleam.toml" → sessions/2026-05-17.md
2026-05-18 shipped 1ba3f08 — "stack: read app name and version from mix.exs" → sessions/2026-05-18.md
2026-05-19 shipped a8eacda — "stack: read name and version from Ruby .gemspec" → sessions/2026-05-19.md
2026-05-20 shipped 1ab1d8b — "stack: read name and version from Julia Project.toml" → sessions/2026-05-20.md
2026-05-21 shipped 8984402 — "stack: strip quotes and trailing comments from Dart pubspec name" → sessions/2026-05-21.md
2026-05-22 shipped 5a48374 — "stack: read name and version from Haskell *.cabal files" → sessions/2026-05-22.md
2026-05-23 shipped 36f5f98 — "stack: read name and version from Crystal shard.yml" → sessions/2026-05-23.md
2026-05-24 shipped 9452f78 — "stack: read name and version from Zig build.zig.zon" → sessions/2026-05-24.md
