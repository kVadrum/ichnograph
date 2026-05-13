import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export type NoteHit = {
  name: string;
  kind: 'file' | 'dir';
  summary: string | null;
};

const NAME_PATTERNS: Array<{ match: (n: string) => boolean; priority: number }> = [
  { match: (n) => /^STATE(\.md)?$/i.test(n), priority: 1 },
  { match: (n) => /^TODO(S)?(\.md)?$/i.test(n), priority: 2 },
  { match: (n) => /^ROADMAP(\.md)?$/i.test(n), priority: 3 },
  { match: (n) => /^CHANGELOG(\.md)?$/i.test(n), priority: 4 },
  { match: (n) => /^CHANGES(\.md)?$/i.test(n), priority: 4 },
  { match: (n) => /^HISTORY(\.md)?$/i.test(n), priority: 4 },
  { match: (n) => /^SPEC(-.+)?\.md$/i.test(n), priority: 5 },
  { match: (n) => /^0[0-9]-.+\.md$/i.test(n), priority: 5 },
  { match: (n) => /^ARCHITECTURE(\.md)?$/i.test(n), priority: 6 },
  { match: (n) => /^CONTRIBUTING(\.md)?$/i.test(n), priority: 7 },
  { match: (n) => /^SECURITY(\.md)?$/i.test(n), priority: 7 },
  { match: (n) => /^CODE_OF_CONDUCT(\.md)?$/i.test(n), priority: 7 },
  { match: (n) => /^CLAUDE\.md$/i.test(n), priority: 8 },
  { match: (n) => /^AGENTS\.md$/i.test(n), priority: 8 },
];

const DIR_PATTERNS: Array<{ match: (n: string) => boolean; priority: number }> = [
  { match: (n) => /^adrs?$/i.test(n), priority: 6 },
  { match: (n) => /^docs?$/i.test(n), priority: 9 },
];

// HTML entities surfaced verbatim by READMEs / STATE files — `AT&amp;T`,
// `Don&#39;t`, `caf&eacute;`. Decoded after tag-stripping so that an
// encoded-but-literal `&lt;b&gt;tag&lt;/b&gt;` in source survives the tag
// pass and then collapses to the intended `<b>tag</b>` (rather than being
// decoded first and then eaten by the tag stripper). The named set is a
// curated allowlist of common entities; unknown names like `&foo;` stay
// literal rather than guessed at. `nbsp` decodes to a regular space so
// the surrounding `.trim()` and downstream consumers don't see a U+00A0
// boundary char.
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  copy: '©', reg: '®', trade: '™',
  hellip: '…', mdash: '—', ndash: '–',
  laquo: '«', raquo: '»', middot: '·', bull: '•',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
};

function decodeEntities(s: string): string {
  return s.replace(
    /&(?:([a-zA-Z][a-zA-Z0-9]{1,15})|#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6}));/g,
    (m, name, dec, hex) => {
      if (name) return NAMED_ENTITIES[name] ?? m;
      const cp = dec ? parseInt(dec, 10) : parseInt(hex, 16);
      // Reject NUL, surrogates, and out-of-range — keeps the source literal
      // intact rather than emitting an invalid or surprising codepoint.
      if (!Number.isFinite(cp) || cp <= 0 || cp > 0x10ffff) return m;
      if (cp >= 0xd800 && cp <= 0xdfff) return m;
      return String.fromCodePoint(cp);
    },
  );
}

function stripInlineMd(line: string): string {
  const stripped = line
    // HTML comments first: a line that's nothing but `<!-- canonical: x -->`
    // should collapse to empty so the caller's `length === 0` skip moves on
    // to the next real line. Surrounding whitespace is consumed so mid-line
    // comments don't leave double spaces behind. Only single-line comments
    // are handled here; multi-line comment blocks at the top of a notes file
    // would need line-spanning logic in firstMeaningfulLine to skip over.
    .replace(/\s*<!--[\s\S]*?-->\s*/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    // Single-underscore italic (`_text_`). Lookbehind/lookahead require
    // non-word boundaries on both sides so intraword underscores in tokens
    // like `CODE_OF_CONDUCT` or `tool_v2` aren't mistaken for emphasis.
    .replace(/(?<![A-Za-z0-9_])_([^_\n]+?)_(?![A-Za-z0-9_])/g, '$1')
    .replace(/~~([^~\n]+)~~/g, '$1')
    // Images before links: ![alt](url) → alt, ![](url) → ''. Order matters:
    // the link regex would otherwise leave a stray '!' in front of the alt.
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/!\[([^\]]*)\]\[[^\]]*\]/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Reference-style links: [text][ref] → text. Shortcut form [text]
    // is intentionally not stripped — bare brackets in prose are too
    // often literal (e.g. `[draft]`, `[WIP]`) to safely collapse.
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1')
    // GFM footnote references: `[^1]`, `[^api-note]` → drop. The
    // negative lookahead for `:` keeps definition lines (`[^1]: …`)
    // intact so a leading footnote def isn't mangled into `: text`.
    // Labels disallow whitespace and `]` per the GFM spec.
    .replace(/\[\^[^\]\s]+\](?!:)/g, '')
    // CommonMark autolinks: <https://x>, <mailto:a@b>, <a@b.com> → drop
    // the angle brackets. The URI form requires a scheme (letter then
    // alphanum/+.-); the email form requires `user@host.tld`. Bare
    // `<word>` literals in prose stay put because they match neither.
    .replace(/<([a-zA-Z][a-zA-Z0-9+.-]{1,31}:[^\s<>]+)>/g, '$1')
    .replace(/<([^\s<>@]+@[^\s<>@.]+(?:\.[^\s<>@.]+)+)>/g, '$1')
    // Common inline HTML tags surfaced verbatim by READMEs / STATE files —
    // <a href="x">text</a>, <br>, <p align="center">…</p>, <sub>, <kbd> —
    // are stripped so wrapped content shines through. The allowlist (vs a
    // generic `<\/?[a-zA-Z][a-zA-Z0-9-]*…>` pattern) keeps prose
    // placeholders like `<name>` or `<your-token>` intact: they don't
    // match any real HTML tag and are usually literal in this kind of
    // text. Attributes are tolerated via `[^<>]*`; quoted `>` inside
    // attributes is rare enough that a stricter parser isn't justified.
    .replace(
      /<\/?(?:a|abbr|b|br|cite|code|del|div|em|h[1-6]|hr|i|img|ins|kbd|li|mark|ol|p|pre|q|s|samp|small|span|strong|sub|sup|table|tbody|td|th|thead|tr|u|ul|var)\b[^<>]*\/?>/gi,
      '',
    );
  // Decode entities last so that an encoded literal `&lt;b&gt;` survives the
  // tag-stripper above (it sees only the literal `&lt;` chars, not a tag) and
  // then collapses to `<b>` here as the author intended. Final `.trim()`
  // catches any boundary whitespace introduced by `&nbsp;`.
  return decodeEntities(stripped).trim();
}

// CommonMark allows an optional closing `#` sequence preceded by whitespace:
// `## Status ##` is a heading whose content is `Status`, not `Status ##`.
// The whitespace requirement keeps `# foo#` literal — no separating space
// means the trailing `#` is content per spec.
function stripClosingHashes(s: string): string {
  return s.replace(/\s+#+\s*$/, '');
}

function firstMeaningfulLine(path: string): string | null {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return null;
  }
  const lines = raw.split(/\r?\n/);
  let i = 0;
  if (lines[0]?.trim() === '---') {
    i = 1;
    while (i < lines.length && lines[i]?.trim() !== '---') i++;
    i++;
  }
  for (; i < lines.length; i++) {
    const l = lines[i]?.trim() ?? '';
    if (!l) continue;
    // Skip multi-line HTML comment blocks. stripInlineMd only collapses
    // comments that open and close on the same line, so a leading
    // `<!--\ncopyright\n-->` header would otherwise surface `<!--` as
    // the summary. Single-line comments are handled by stripInlineMd
    // below; this branch only catches the unclosed-on-this-line case.
    if (l.startsWith('<!--') && !l.includes('-->')) {
      i++;
      while (i < lines.length && !lines[i]?.includes('-->')) i++;
      continue;
    }
    // Skip fenced code blocks: the opening fence isn't meaningful prose, and
    // surfacing "```" or "```ts" as the summary is worse than digging past
    // it to the next real line.
    const fence = l.match(/^(`{3,}|~{3,})/);
    if (fence && fence[1]) {
      const marker = fence[1];
      i++;
      while (i < lines.length && !(lines[i]?.trim().startsWith(marker))) i++;
      continue;
    }
    const h = l.match(/^#{1,6}\s+(.+)$/);
    // List items: TODO.md / STATE.md commonly lead with `- [ ] do thing`
    // or `- branch: dev` instead of a heading. Strip the leading marker
    // (and optional GFM task checkbox) so the summary is the content,
    // not the bullet. CommonMark requires whitespace after the marker,
    // so prose tokens like `-foo` aren't matched. The checkbox group is
    // restricted to `[ ]` / `[x]` / `[X]` so literal bracketed shortcuts
    // (`- [draft] note`) survive — same reasoning as reference-link
    // shortcuts being left alone in stripInlineMd.
    let body = h ? stripClosingHashes(h[1] ?? '') : l;
    if (!h) {
      // Blockquote markers: STATE.md / TODO.md sometimes lead with
      // `> note text` instead of a heading or bullet. CommonMark §5.1
      // makes the space after `>` optional (`>foo`) and allows nesting
      // (`>> reply`). Strip the marker(s) so the quoted body surfaces
      // as the summary — same reasoning as list markers being stripped:
      // the marker is structure, not content.
      const bq = l.match(/^>+\s*(.+)$/);
      if (bq) body = bq[1] ?? '';
      else {
        const li = l.match(/^(?:[-*+]|\d+\.)\s+(?:\[[ xX]\]\s+)?(.+)$/);
        if (li) body = li[1] ?? '';
      }
    }
    const text = stripInlineMd(body);
    if (text.length === 0) continue;
    return text.length > 80 ? text.slice(0, 77) + '…' : text;
  }
  return null;
}

function countDirEntries(path: string): number {
  try {
    return readdirSync(path).filter((n: string) => !n.startsWith('.')).length;
  } catch {
    return 0;
  }
}

export function detectNotes(root: string): NoteHit[] {
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return [];
  }

  const hits: Array<NoteHit & { priority: number }> = [];

  for (const name of entries) {
    const full = join(root, name);
    let isDir = false;
    try {
      isDir = statSync(full).isDirectory();
    } catch {
      continue;
    }

    if (!isDir) {
      for (const p of NAME_PATTERNS) {
        if (p.match(name)) {
          hits.push({
            name,
            kind: 'file',
            summary: firstMeaningfulLine(full),
            priority: p.priority,
          });
          break;
        }
      }
    } else {
      for (const p of DIR_PATTERNS) {
        if (p.match(name)) {
          const count = countDirEntries(full);
          hits.push({
            name: `${name}/`,
            kind: 'dir',
            summary: count > 0 ? `(${count} entries)` : '(empty)',
            priority: p.priority,
          });
          break;
        }
      }
    }
  }

  hits.sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
  return hits.map(({ name, kind, summary }) => ({ name, kind, summary }));
}
