import { basename } from 'node:path';
import type { Report } from './types.js';

function section(title: string, body: string[]): string[] {
  return [title, '─'.repeat(title.length), ...body, ''];
}

export function renderText(report: Report): string {
  const out: string[] = [];
  const name = basename(report.target) || report.target;
  out.push(name);
  out.push(report.target);
  out.push('');

  if (report.stacks.length > 0) {
    const body: string[] = [];
    for (const s of report.stacks) {
      const id = s.name ? `${s.name}${s.version ? `@${s.version}` : ''}` : s.manifest;
      const fw = s.frameworks.length > 0 ? ` · ${s.frameworks.join(', ')}` : '';
      body.push(`${s.language.padEnd(12)} ${id}${fw}`);
    }
    out.push(...section('stack', body));
  }

  if (report.tree && report.tree.lines.length > 0) {
    out.push(...section('structure', report.tree.lines));
  }

  return out.join('\n');
}
