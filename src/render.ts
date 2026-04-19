import { basename } from 'node:path';
import { c } from './color.js';
import type { Report } from './types.js';

function section(title: string, body: string[]): string[] {
  return [c.boldCyan(title), c.dim('─'.repeat(title.length)), ...body, ''];
}

function wrapText(text: string, width: number): string {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if (!line) {
      line = w;
      continue;
    }
    if (line.length + 1 + w.length > width) {
      lines.push(line);
      line = w;
    } else {
      line += ' ' + w;
    }
  }
  if (line) lines.push(line);
  return lines.join('\n');
}

export function renderText(report: Report): string {
  const out: string[] = [];
  const name = basename(report.target) || report.target;
  out.push(c.bold(name));
  out.push(c.dim(report.target));
  out.push('');

  if (report.readme) {
    const body: string[] = [];
    if (report.readme.title) body.push(c.bold(report.readme.title));
    if (report.readme.summary) {
      if (report.readme.title) body.push('');
      body.push(wrapText(report.readme.summary, 76));
    }
    if (body.length === 0) body.push(c.dim(`(${report.readme.file} found, no summary)`));
    out.push(...section('readme', body));
  }

  if (report.stacks.length > 0) {
    const body: string[] = [];
    for (const s of report.stacks) {
      const id = s.name ? `${s.name}${s.version ? `@${s.version}` : ''}` : s.manifest;
      const fw = s.frameworks.length > 0 ? c.dim(` · ${s.frameworks.join(', ')}`) : '';
      body.push(`${c.magenta(s.language.padEnd(12))} ${id}${fw}`);
    }
    out.push(...section('stack', body));
  }

  if (report.notes.length > 0) {
    const width = Math.max(...report.notes.map((n) => n.name.length));
    const body = report.notes.map((n) => {
      const colored = n.kind === 'dir' ? c.blue(n.name) : n.name;
      const padded = colored + ' '.repeat(Math.max(0, width - n.name.length));
      return n.summary ? `${padded}  ${c.dim(n.summary)}` : padded;
    });
    out.push(...section('notes', body));
  }

  if (report.git) {
    const body: string[] = [];
    if (report.git.branch) body.push(`branch: ${c.green(report.git.branch)}`);
    if (report.git.commits.length > 0) {
      if (body.length > 0) body.push('');
      for (const commit of report.git.commits) {
        body.push(
          `${c.yellow(commit.hash)}  ${c.dim(commit.relTime.padEnd(14))}  ${commit.subject}`,
        );
      }
    } else {
      body.push(c.dim('(no commits)'));
    }
    out.push(...section('git', body));
  }

  if (report.tree && report.tree.lines.length > 0) {
    const body = report.tree.lines.map((line) =>
      line.endsWith('/') ? line.replace(/([^│├└─\s][^/]*\/)$/, (m) => c.blue(m)) : line,
    );
    if (report.tree.truncated) body.push(c.dim('(some entries truncated)'));
    out.push(...section('structure', body));
  }

  return out.join('\n');
}
