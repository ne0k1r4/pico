# pico

Turn any website into a standalone desktop application.

Pico 1.4 requires **Node.js 22 or later**. It generates Electron 43 desktop projects and can now generate Capacitor-based Android projects that package a website as an `.apk`.

## Install

```bash
git clone https://github.com/ne0k1r4/pico.git
cd pico
npm install
npm link
```

Confirm the active runtime with `node --version` before installing. A current Node.js 22 LTS release is recommended.

## Usage

### Interactive CLI

```bash
pico
```

### Non-Interactive CLI Arguments

```bash
pico --url "https://example.com" --name "My App" --build
```

#### Available Flags

| Flag | Description |
|---|---|
| `--url <url>` | Target website URL |
| `--name <name>` | Application display name |
| `--outputDir <dir>` | Directory for generated project (default: `./apps`) |
| `--style <style>` | Window style (`normal`, `frameless`, `minimal`) |
| `--no-toolbar` | Hide top navigation bar |
| `--tray` | Enable minimize to system tray |
| `--always-on-top` | Keep window above all other windows |
| `--dark` | Enable forced dark mode |
| `--css <css>` | Inject custom CSS string |
| `--js <js>` | Inject custom JavaScript string on `dom-ready` |
| `--user-agent <ua>` | Override default User-Agent string |
| `--protocol <scheme>` | Register custom deep-linking protocol scheme |
| `--proxy <url>` | Configure HTTP/SOCKS network proxy |
| `--shortcuts <json>` | JSON mapping for custom global keybindings |
| `--block-ads` | Enable request filtering for ad/tracker domains |
| `--width <px>` | Initial window width (default: `1280`) |
| `--height <px>` | Initial window height (default: `800`) |
| `--platforms <list>` | Target platforms comma-separated (`linux,win,mac,android`) |
| `--build` | Automatically run `npm install` and compile installer |

### Desktop GUI

```bash
npm run gui
```

An interactive desktop dashboard for configuring, generating, running, and compiling installers with real-time build logs.

## Generated Applications

Each generated app is a standalone Electron project located in `apps/<slug>/`:

```bash
cd apps/<slug>
npm install
npm start        # Launch app locally
npm run build    # Package installer for host system
```

Compiled installers are placed in `apps/<slug>/dist/`.

Generated projects inherit Pico's Node.js 22 requirement and include Electron 43 plus Electron Builder 26 in their development dependencies.

## Android APKs

Pass `--platforms android` to generate a Capacitor project that opens the selected website inside an Android WebView. It includes the web launcher, Capacitor configuration, and scripts required to create either a debug APK or a signed release APK.

```bash
pico --url "https://example.com" --name "Example Mobile" --platforms android
cd apps/example-mobile
npm install
npm run android:add
npm run android:apk:debug
```

The debug output is `android/app/build/outputs/apk/debug/app-debug.apk`. Building Android applications requires Android Studio and an installed Android SDK. Android output supports Android API 24 and later. For a signed release APK, configure a keystore and run `npm run android:apk`. The generated `ANDROID.md` contains the same workflow.

Android projects keep the website inside a native WebView. Electron-only functions, including the desktop toolbar, system tray, ad filtering, and renderer injection, do not transfer to Android.

When using the Pico desktop GUI, select **Android (.APK)** and use **Compile Native Installer**. Pico will create the native Android project before it runs the package command.

## Packaging Pico

To compile the Pico generator itself into an installable desktop package:

```bash
npm run build
```

The output installer is generated in `dist/`.

## Supported Platforms

| Platform | Output Artifacts |
|---|---|
| Linux | `.AppImage` + `.deb` |
| Windows | `.exe` (NSIS) |
| macOS | `.dmg` |
| Android | `.apk` (Capacitor + Android SDK) |

## Repository Layout

| Path | Purpose |
|---|---|
| `src/` | CLI parser, GUI launcher, generator engine, and utilities |
| `template/` | Electron runtime shell template for generated apps |
| `services/website-analyzer/` | Service for extracting website metadata and PWA profiles |
| `services/tauri-app-generator/` | Service for generating Tauri Rust projects |
| `services/build-workers/` | Build queue worker service |

## Testing

```bash
npm test
```

## License

MIT
