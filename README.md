# pico

Turn any website into a native desktop app.

## Install

```bash
git clone https://github.com/ne0k1r4/pico.git
cd pico
npm install
npm link
```

## Usage

**CLI**

```bash
pico
```

**GUI**

```bash
npm run gui
```

## What it does

Wraps a URL in an Electron window and outputs a standalone desktop app. Supports custom window styles, CSS injection, ad blocking, system tray, always-on-top, and per-platform packaging.

The generated project is a normal Electron app with its own `package.json`, `app-config.json`, runtime template, icon files, and `electron-builder` configuration.

## Generated app

```bash
cd apps/<name>
npm install
npm start        # run
npm run build    # package into installer
```

Output: `apps/<name>/dist/`

## Platforms

| Platform | Output |
|---|---|
| Linux | `.AppImage` + `.deb` |
| Windows | `.exe` |
| macOS | `.dmg` |

## Repository layout

| Path | Purpose |
|---|---|
| `src/` | Root CLI, GUI launcher, generator, and shared utilities |
| `template/` | Electron runtime copied into each generated app |
| `services/website-analyzer/` | Fastify/Bun API for extracting website metadata, assets, PWA data, and framework signals |
| `services/tauri-app-generator/` | Rust generator for production Tauri projects from website profiles |
| `services/build-workers/` | Queue workers for platform-specific Tauri builds and artifact uploads |

## Development

```bash
npm test
```

Service-specific tests are kept with each service:

```bash
cd services/website-analyzer && bun test
cd services/build-workers && bun test
cd services/tauri-app-generator && cargo test
```

## License

MIT
