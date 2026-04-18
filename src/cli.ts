#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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

  const target = resolve(args[0] ?? process.cwd());
  process.stdout.write(`glance v${pkg.version}\n`);
  process.stdout.write(`target: ${target}\n`);
  process.stdout.write(`(detectors land in v0.1.1+)\n`);
  return 0;
}

process.exit(main(process.argv));
