# glance

One-screen orientation for any codebase.

Run `glance` in a repo (or point it at one) and get a single-screen
report: stack, structure, README excerpt, recent commits, surfaced
state files. Designed as the first thing you run in an unfamiliar
repo — or your own, a month later.

## Status

v0.1.0 — scaffold only. Placeholder output. Real detectors land in
subsequent 0.1.x versions.

## Install

Not published yet. Local dev:

```bash
npm install
npm run build
node dist/cli.js --help
```

## Usage

```bash
glance            # report on cwd
glance ./path     # report on a specific path
glance --help
glance --version
```

## License

MIT — see [LICENSE](LICENSE).
