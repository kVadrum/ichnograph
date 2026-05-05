import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type ReadmeSection = {
  file: string;
  title: string | null;
  summary: string | null;
};

const CANDIDATE_RE = /^readme(\.(md|mdx|rst|txt|markdown))?$/i;

function findReadme(root: string): string | null {
  let names: string[];
  try {
    names = readdirSync(root);
  } catch {
    return null;
  }
  for (const n of names) {
    if (CANDIDATE_RE.test(n)) return join(root, n);
  }
  return null;
}

function stripMd(line: string): string {
  return line
    // HTML comments first: a `<!-- canonical: x -->` marker (or a TOC sentinel
    // like `<!-- toc -->`) at the start of a paragraph would otherwise surface
    // as part of the summary. Surrounding whitespace is consumed so a mid-line
    // comment doesn't leave a double space behind. The `[\s\S]*?` body lets a
    // comment span the joined paragraph lines.
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
    // CommonMark autolinks: <https://x>, <mailto:a@b>, <a@b.com> → drop
    // the angle brackets. The URI form requires a scheme (letter then
    // alphanum/+.-); the email form requires `user@host.tld`. Bare
    // `<word>` literals in prose stay put because they match neither.
    .replace(/<([a-zA-Z][a-zA-Z0-9+.-]{1,31}:[^\s<>]+)>/g, '$1')
    .replace(/<([^\s<>@]+@[^\s<>@.]+(?:\.[^\s<>@.]+)+)>/g, '$1')
    .trim();
}

function stripFrontmatter(text: string): string {
  if (!text.startsWith('---\n') && !text.startsWith('---\r\n')) return text;
  const end = text.indexOf('\n---', 3);
  if (end === -1) return text;
  return text.slice(end + 4).replace(/^\s*\n/, '');
}

export function detectReadme(root: string): ReadmeSection | null {
  const path = findReadme(root);
  if (!path) return null;
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return null;
  }

  const text = stripFrontmatter(raw);
  const lines = text.split(/\r?\n/);

  let title: string | null = null;
  let i = 0;
  for (; i < lines.length; i++) {
    const l = lines[i]?.trim() ?? '';
    if (!l) continue;
    const h1 = l.match(/^#\s+(.+)$/);
    if (h1) {
      title = stripMd(h1[1] ?? '');
      i++;
      break;
    }
    title = stripMd(l);
    i++;
    // Setext-style heading: a title line followed by === or --- acts as H1/H2.
    // Skip the underline so it doesn't terminate the paragraph scan below.
    const next = lines[i]?.trim() ?? '';
    if (/^[=-]{3,}$/.test(next)) i++;
    break;
  }

  while (i < lines.length && !(lines[i]?.trim())) i++;

  const paraLines: string[] = [];
  for (; i < lines.length; i++) {
    const l = lines[i] ?? '';
    const trimmed = l.trim();

    // Skip a leading fenced code block: READMEs sometimes lead with a
    // usage/install snippet before the description, and surfacing the
    // fence contents is worse than digging past it to real prose. Once
    // the paragraph has started, a fence terminates it like a heading.
    const fence = trimmed.match(/^(`{3,}|~{3,})/);
    if (fence && fence[1]) {
      if (paraLines.length > 0) break;
      const marker = fence[1];
      i++;
      while (i < lines.length && !(lines[i]?.trim().startsWith(marker))) i++;
      // Eat blank lines after the close fence so the for-loop's i++ lands
      // on the next non-blank line.
      while (i + 1 < lines.length && !(lines[i + 1]?.trim())) i++;
      continue;
    }

    if (!trimmed) break;
    if (trimmed.startsWith('#')) break;
    if (/^[-=]{3,}$/.test(trimmed)) break;
    paraLines.push(trimmed);
  }

  const summary = paraLines.length > 0 ? stripMd(paraLines.join(' ')) : null;

  const filename = path.split(/[\\/]/).pop() ?? path;
  return { file: filename, title, summary };
}
