const CODES = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
} as const;

type Code = keyof typeof CODES;

let enabled = true;

export function setColorEnabled(value: boolean): void {
  enabled = value;
}

// Precedence: --no-color > NO_COLOR > FORCE_COLOR > TTY autodetect.
// Conforms to https://no-color.org and https://force-color.org.
export function colorsAutoEnabled(argv: string[], env: NodeJS.ProcessEnv, isTTY: boolean): boolean {
  if (argv.includes('--no-color')) return false;
  if (env.NO_COLOR !== undefined && env.NO_COLOR !== '') return false;
  if (env.FORCE_COLOR === '0') return false;
  if (env.FORCE_COLOR !== undefined && env.FORCE_COLOR !== '') return true;
  return isTTY;
}

function wrap(code: Code, s: string): string {
  if (!enabled) return s;
  return `${CODES[code]}${s}${CODES.reset}`;
}

export const c = {
  bold: (s: string) => wrap('bold', s),
  dim: (s: string) => wrap('dim', s),
  red: (s: string) => wrap('red', s),
  green: (s: string) => wrap('green', s),
  yellow: (s: string) => wrap('yellow', s),
  blue: (s: string) => wrap('blue', s),
  magenta: (s: string) => wrap('magenta', s),
  cyan: (s: string) => wrap('cyan', s),
  boldCyan: (s: string) => (enabled ? `${CODES.bold}${CODES.cyan}${s}${CODES.reset}` : s),
};
