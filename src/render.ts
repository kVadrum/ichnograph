import { basename } from 'node:path';
import type { Report } from './types.js';

export function renderText(report: Report): string {
  const out: string[] = [];
  const name = basename(report.target) || report.target;
  out.push(`${name}`);
  out.push(report.target);
  out.push('');

  if (report.tree && report.tree.lines.length > 0) {
    out.push('structure');
    out.push('─────────');
    for (const line of report.tree.lines) out.push(line);
    out.push('');
  }

  return out.join('\n');
}
