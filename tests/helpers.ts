import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export type Fixture = {
  path: string;
  cleanup: () => void;
  write: (relPath: string, content: string) => void;
  mkdir: (relPath: string) => void;
};

export function makeFixture(): Fixture {
  const path = mkdtempSync(join(tmpdir(), 'ichnograph-test-'));
  return {
    path,
    cleanup: () => rmSync(path, { recursive: true, force: true }),
    write: (rel, content) => {
      const full = join(path, rel);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, content);
    },
    mkdir: (rel) => {
      mkdirSync(join(path, rel), { recursive: true });
    },
  };
}
