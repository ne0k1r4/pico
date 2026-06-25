# pico

Turn any website into a native desktop app.

---

## Install

```bash
git clone https://github.com/ne0k1r4/pico.git
cd pico
npm install
npm link
```

---

## Usage

**CLI**

```bash
pico
```

**GUI**

```bash
npm run gui
```

---

## What it does

Wraps a URL in an Electron window and outputs a standalone desktop app. Supports custom window styles, CSS injection, ad blocking, system tray, always-on-top, and per-platform packaging.

---

## Generated app

```bash
cd apps/<name>
npm install
npm start        # run
npm run build    # package into installer
```

Output: `apps/<name>/dist/`

---

## Platforms

| Platform | Output |
|---|---|
| Linux | `.AppImage` + `.deb` |
| Windows | `.exe` |
| macOS | `.dmg` |

---

## License

MIT
