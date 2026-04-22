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
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
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
    if (!l.trim()) break;
    if (l.trim().startsWith('#')) break;
    if (/^[-=]{3,}$/.test(l.trim())) break;
    paraLines.push(l.trim());
  }

  const summary = paraLines.length > 0 ? stripMd(paraLines.join(' ')) : null;

  const filename = path.split(/[\\/]/).pop() ?? path;
  return { file: filename, title, summary };
}
