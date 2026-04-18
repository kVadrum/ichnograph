#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderText } from './render.js';
import { scan } from './scan.js';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(here, '../package.json'), 'utf8'));

const HELP = `glance ${pkg.version}
${pkg.description}

Usage:
  glance [path]

Options:
  -h, --help     Show this help
  -v, --version  Show version
`;

function main(argv: string[]): number {
  const args = argv.slice(2);

  if (args.includes('--version') || args.includes('-v')) {
    process.stdout.write(`${pkg.version}\n`);
    return 0;
  }

  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(HELP);
    return 0;
  }

  const positional = args.filter((a) => !a.startsWith('-'));
  const target = resolve(positional[0] ?? process.cwd());

  const report = scan(target);
  process.stdout.write(renderText(report));
  return 0;
}

process.exit(main(process.argv));
