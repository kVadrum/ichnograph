#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { colorsAutoEnabled, setColorEnabled } from './color.js';
import { renderText } from './render.js';
import { scan } from './scan.js';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(here, '../package.json'), 'utf8'));

const HELP = `alidade ${pkg.version}
${pkg.description}

Usage:
  alidade [path] [options]

Options:
  -h, --help           Show this help
  -v, --version        Show version
  -d, --depth <n>      Tree depth (default: 2)
      --commits <n>    Recent commits to show (default: 5)
      --json           Emit JSON report instead of formatted text
      --no-color       Disable ANSI colors (NO_COLOR env also respected)
`;

type Flags = {
  help: boolean;
  version: boolean;
  noColor: boolean;
  json: boolean;
  depth?: number;
  commits?: number;
  target?: string;
};

function parseNumberFlag(name: string, raw: string | undefined): number | Error {
  if (raw === undefined || raw === '') return new Error(`${name} requires a number`);
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
    return new Error(`${name}: "${raw}" is not a non-negative integer`);
  }
  return n;
}

function parseArgs(argv: string[]): Flags | Error {
  const flags: Flags = { help: false, version: false, noColor: false, json: false };
  const positionals: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? '';
    if (a === '-h' || a === '--help') flags.help = true;
    else if (a === '-v' || a === '--version') flags.version = true;
    else if (a === '--no-color') flags.noColor = true;
    else if (a === '--json') flags.json = true;
    else if (a === '-d' || a === '--depth') {
      const n = parseNumberFlag('--depth', argv[++i]);
      if (n instanceof Error) return n;
      flags.depth = n;
    } else if (a.startsWith('--depth=')) {
      const n = parseNumberFlag('--depth', a.slice('--depth='.length));
      if (n instanceof Error) return n;
      flags.depth = n;
    } else if (a === '--commits') {
      const n = parseNumberFlag('--commits', argv[++i]);
      if (n instanceof Error) return n;
      flags.commits = n;
    } else if (a.startsWith('--commits=')) {
      const n = parseNumberFlag('--commits', a.slice('--commits='.length));
      if (n instanceof Error) return n;
      flags.commits = n;
    } else if (a.startsWith('-')) {
      return new Error(`Unknown option: ${a}`);
    } else {
      positionals.push(a);
    }
  }

  if (positionals.length > 1) {
    return new Error(
      `too many arguments: expected at most one path, got ${positionals.length}`,
    );
  }
  flags.target = positionals[0];
  return flags;
}

function main(argv: string[]): number {
  const parsed = parseArgs(argv.slice(2));
  if (parsed instanceof Error) {
    process.stderr.write(`alidade: ${parsed.message}\n`);
    process.stderr.write(`try 'alidade --help'\n`);
    return 2;
  }

  if (parsed.version) {
    process.stdout.write(`${pkg.version}\n`);
    return 0;
  }
  if (parsed.help) {
    process.stdout.write(HELP);
    return 0;
  }

  const colorFlags = parsed.noColor ? ['--no-color'] : [];
  // JSON output must never contain ANSI escapes — they'd break JSON consumers.
  setColorEnabled(
    !parsed.json && colorsAutoEnabled(colorFlags, process.env, Boolean(process.stdout.isTTY)),
  );

  const target = resolve(parsed.target ?? process.cwd());
  const report = scan(target, { depth: parsed.depth, commits: parsed.commits });

  if (parsed.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    process.stdout.write(renderText(report) + '\n');
  }
  return 0;
}

process.exit(main(process.argv));
