import { basename } from 'node:path';
import type { Report } from './types.js';

function section(title: string, body: string[]): string[] {
  return [title, '─'.repeat(title.length), ...body, ''];
}

function wrap(text: string, width: number): string {
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
  out.push(name);
  out.push(report.target);
  out.push('');

  if (report.readme) {
    const body: string[] = [];
    if (report.readme.title) body.push(report.readme.title);
    if (report.readme.summary) {
      if (report.readme.title) body.push('');
      body.push(wrap(report.readme.summary, 76));
    }
    if (body.length === 0) body.push(`(${report.readme.file} found, no summary)`);
    out.push(...section('readme', body));
  }

  if (report.stacks.length > 0) {
    const body: string[] = [];
    for (const s of report.stacks) {
      const id = s.name ? `${s.name}${s.version ? `@${s.version}` : ''}` : s.manifest;
      const fw = s.frameworks.length > 0 ? ` · ${s.frameworks.join(', ')}` : '';
      body.push(`${s.language.padEnd(12)} ${id}${fw}`);
    }
    out.push(...section('stack', body));
  }

  if (report.notes.length > 0) {
    const width = Math.max(...report.notes.map((n) => n.name.length));
    const body = report.notes.map((n) =>
      n.summary ? `${n.name.padEnd(width)}  ${n.summary}` : n.name,
    );
    out.push(...section('notes', body));
  }

  if (report.git) {
    const body: string[] = [];
    if (report.git.branch) body.push(`branch: ${report.git.branch}`);
    if (report.git.commits.length > 0) {
      if (body.length > 0) body.push('');
      for (const c of report.git.commits) {
        body.push(`${c.hash}  ${c.relTime.padEnd(14)}  ${c.subject}`);
      }
    } else {
      body.push('(no commits)');
    }
    out.push(...section('git', body));
  }

  if (report.tree && report.tree.lines.length > 0) {
    out.push(...section('structure', report.tree.lines));
  }

  return out.join('\n');
}
