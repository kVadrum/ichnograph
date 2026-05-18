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

  it('reads Dart pubspec name and version', () => {
    fx.write(
      'pubspec.yaml',
      `name: my_pkg
version: 1.2.3
description: A test package.
`,
    );
    const stacks = detectStack(fx.path);
    expect(stacks[0]).toMatchObject({
      language: 'Dart',
      manifest: 'pubspec.yaml',
      name: 'my_pkg',
      version: '1.2.3',
    });
  });

  it('preserves Flutter build suffix in pubspec version', () => {
    fx.write(
      'pubspec.yaml',
      `name: flutter_app
version: 1.0.0+42
environment:
  sdk: ">=3.0.0 <4.0.0"
dependencies:
  flutter:
    sdk: flutter
`,
    );
    const stacks = detectStack(fx.path);
    expect(stacks[0]?.version).toBe('1.0.0+42');
    expect(stacks[0]?.frameworks).toContain('Flutter');
  });

  it('ignores nested version keys under dependencies in pubspec', () => {
    fx.write(
      'pubspec.yaml',
      `name: my_pkg
dependencies:
  some_dep:
    version: 9.9.9
`,
    );
    const stacks = detectStack(fx.path);
    expect(stacks[0]?.version).toBeNull();
  });

  it('strips quotes around pubspec version', () => {
    fx.write('pubspec.yaml', `name: my_pkg\nversion: "2.0.0"\n`);
    const stacks = detectStack(fx.path);
    expect(stacks[0]?.version).toBe('2.0.0');
  });

  it('reads Gleam name and version from gleam.toml', () => {
    fx.write(
      'gleam.toml',
      `name = "my_gleam_pkg"
version = "0.3.1"
description = "a test"

[dependencies]
gleam_stdlib = "~> 0.27"
`,
    );
    const stacks = detectStack(fx.path);
    expect(stacks[0]).toMatchObject({
      language: 'Gleam',
      manifest: 'gleam.toml',
      name: 'my_gleam_pkg',
      version: '0.3.1',
    });
  });

  it('ignores version under [dependencies.x] subtables in gleam.toml', () => {
    fx.write(
      'gleam.toml',
      `name = "my_gleam_pkg"

[dependencies.foo]
version = "9.9.9"
`,
    );
    const stacks = detectStack(fx.path);
    expect(stacks[0]?.name).toBe('my_gleam_pkg');
    expect(stacks[0]?.version).toBeNull();
  });

  it('reads Elixir mix.exs app name and literal version', () => {
    fx.write(
      'mix.exs',
      `defmodule MyApp.MixProject do
  use Mix.Project

  def project do
    [
      app: :my_app,
      version: "0.4.2",
      elixir: "~> 1.14",
      deps: deps()
    ]
  end

  defp deps, do: []
end
`,
    );
    const stacks = detectStack(fx.path);
    expect(stacks[0]).toMatchObject({
      language: 'Elixir',
      manifest: 'mix.exs',
      name: 'my_app',
      version: '0.4.2',
    });
  });

  it('resolves @version module-attribute in mix.exs', () => {
    fx.write(
      'mix.exs',
      `defmodule MyApp.MixProject do
  use Mix.Project

  @version "1.7.0"

  def project do
    [
      app: :my_app,
      version: @version,
      deps: []
    ]
  end
end
`,
    );
    const stacks = detectStack(fx.path);
    expect(stacks[0]?.version).toBe('1.7.0');
  });

  it('returns null mix.exs version when project block is missing', () => {
    fx.write('mix.exs', 'defmodule Foo do\nend\n');
    const stacks = detectStack(fx.path);
    expect(stacks[0]).toMatchObject({
      language: 'Elixir',
      name: null,
      version: null,
    });
  });

  it('ignores app:/version: outside the project block in mix.exs', () => {
    fx.write(
      'mix.exs',
      `defmodule MyApp.MixProject do
  use Mix.Project

  def project do
    [
      app: :real_app,
      version: "1.0.0"
    ]
  end

  defp deps do
    [
      {:other, app: :wrong, version: "9.9.9"}
    ]
  end
end
`,
    );
    const stacks = detectStack(fx.path);
    expect(stacks[0]?.name).toBe('real_app');
    expect(stacks[0]?.version).toBe('1.0.0');
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
