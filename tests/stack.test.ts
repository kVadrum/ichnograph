import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { detectStack } from '../src/detect/stack.js';
import { makeFixture, type Fixture } from './helpers.js';

describe('detectStack', () => {
  let fx: Fixture;

  beforeEach(() => {
    fx = makeFixture();
  });

  afterEach(() => {
    fx.cleanup();
  });

  it('returns empty for a bare directory', () => {
    expect(detectStack(fx.path)).toEqual([]);
  });

  it('detects TypeScript project with Svelte + Vitest', () => {
    fx.write('tsconfig.json', '{}');
    fx.write(
      'package.json',
      JSON.stringify({
        name: 'myapp',
        version: '1.2.3',
        dependencies: { svelte: '^5.0.0' },
        devDependencies: { vitest: '^2.0.0' },
      }),
    );

    const stacks = detectStack(fx.path);
    expect(stacks).toHaveLength(1);
    expect(stacks[0]).toMatchObject({
      language: 'TypeScript',
      name: 'myapp',
      version: '1.2.3',
    });
    expect(stacks[0]?.frameworks).toContain('Svelte');
    expect(stacks[0]?.frameworks).toContain('Vitest');
  });

  it('distinguishes JS from TS based on tsconfig', () => {
    fx.write('package.json', JSON.stringify({ name: 'plainjs' }));
    const stacks = detectStack(fx.path);
    expect(stacks[0]?.language).toBe('JavaScript');
    expect(stacks[0]?.version).toBeNull();
  });

  it('uses explicit nulls when name or version absent', () => {
    fx.write('package.json', JSON.stringify({}));
    const stacks = detectStack(fx.path);
    expect(stacks[0]?.name).toBeNull();
    expect(stacks[0]?.version).toBeNull();
  });

  it('parses pyproject.toml project name and frameworks', () => {
    fx.write(
      'pyproject.toml',
      `[project]
name = "mypy-thing"
version = "0.2.0"
dependencies = ["fastapi", "pydantic"]
`,
    );
    const stacks = detectStack(fx.path);
    expect(stacks[0]).toMatchObject({
      language: 'Python',
      name: 'mypy-thing',
      version: '0.2.0',
    });
    expect(stacks[0]?.frameworks).toContain('FastAPI');
    expect(stacks[0]?.frameworks).toContain('Pydantic');
  });

  it('parses composer.json name, version, and frameworks', () => {
    fx.write(
      'composer.json',
      JSON.stringify({
        name: 'acme/site',
        version: '1.4.2',
        require: { 'laravel/framework': '^11.0', 'livewire/livewire': '^3.0' },
        'require-dev': { 'pestphp/pest': '^2.0' },
      }),
    );
    const stacks = detectStack(fx.path);
    expect(stacks[0]).toMatchObject({
      language: 'PHP',
      name: 'acme/site',
      version: '1.4.2',
    });
    expect(stacks[0]?.frameworks).toContain('Laravel');
    expect(stacks[0]?.frameworks).toContain('Livewire');
    expect(stacks[0]?.frameworks).toContain('Pest');
  });

  it('reads Go module name from go.mod', () => {
    fx.write('go.mod', 'module github.com/example/thing\n\ngo 1.22\n');
    const stacks = detectStack(fx.path);
    expect(stacks[0]?.language).toBe('Go');
    expect(stacks[0]?.name).toBe('github.com/example/thing');
  });

  it('reads Deno name and version from deno.json', () => {
    fx.write(
      'deno.json',
      JSON.stringify({ name: '@scope/widget', version: '0.5.1' }),
    );
    const stacks = detectStack(fx.path);
    expect(stacks[0]).toMatchObject({
      language: 'Deno',
      manifest: 'deno.json',
      name: '@scope/widget',
      version: '0.5.1',
    });
  });

  it('falls back to nulls for deno.jsonc with comments', () => {
    fx.write(
      'deno.jsonc',
      '// project config\n{ "name": "@scope/widget", "version": "0.5.1" }\n',
    );
    const stacks = detectStack(fx.path);
    expect(stacks[0]).toMatchObject({
      language: 'Deno',
      manifest: 'deno.jsonc',
      name: null,
      version: null,
    });
  });
});
