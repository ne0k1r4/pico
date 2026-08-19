# Pico

[![Pico CI](https://github.com/ne0k1r4/pico/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/ne0k1r4/pico/actions/workflows/ci.yml)
[![Build workers](https://github.com/ne0k1r4/pico/actions/workflows/build-workers.yml/badge.svg?branch=main)](https://github.com/ne0k1r4/pico/actions/workflows/build-workers.yml)

Pico turns any web application into a standalone desktop app or Android APK. It generates ready-to-build Electron applications for desktop platforms (Linux, Windows, macOS) and Capacitor projects for Android devices.

> **Note:** Pico wraps web applications inside native runtime containers. It does not scrape source code, mirror sites offline, or bypass site authentication.

---

## Supported Targets

| Platform | Runtime | Output Format | Build Environment |
| --- | --- | --- | --- |
| **Linux** | Electron | `.AppImage`, `.deb` | Linux host |
| **Windows** | Electron | NSIS `.exe` | Windows host or builder |
| **macOS** | Electron | `.dmg` | macOS host |
| **Android** | Capacitor WebView | Debug/Release `.apk`, Signed `.aab` | JDK, Android SDK & Gradle |

---

## Prerequisites

- **Node.js 22+**: Check your version with `node --version`.
- **Desktop Builds**: Standard build tools required by Electron Builder for your host OS.
- **Android Builds**: OpenJDK 21, Android SDK command-line tools, and platform tools (Android API 24+ supported).

---

## Quick Start

### Installation

Clone the repo, install dependencies, and link the CLI executable:

```bash
git clone https://github.com/ne0k1r4/pico.git
cd pico
npm install
npm link
```

Prefer a GUI? Run `npm run gui` to launch the graphical app builder interface.

---

### Basic Usage

#### Interactive Mode
Run `pico` without parameters to start the step-by-step wizard:

```bash
pico
```

#### Command Line
Pass parameters directly for fast, repeatable builds:

```bash
pico --url "https://example.com" --name "Example App" --platforms linux,android
```

---

## CLI Options

| Flag | Description |
| --- | --- |
| `--url <url>` | Target website URL (HTTP or HTTPS required). |
| `--name <name>` | Display name for the generated application. |
| `--outputDir <dir>` | Destination folder for the project (default: `./apps`). |
| `--platforms <list>` | Comma-separated targets (`linux,win,mac,android`). |
| `--style <style>` | Window style (`normal`, `frameless`, `minimal`). |
| `--no-toolbar` | Hide the navigation toolbar. |
| `--tray` | Minimize window to system tray. |
| `--always-on-top` | Keep window pinned above other windows. |
| `--dark` | Enable force-dark mode styling. |
| `--css <css>` | Custom CSS string to inject into the renderer. |
| `--js <js>` | Custom JS snippet to run at document-ready. |
| `--user-agent <ua>` | Override HTTP request User-Agent header. |
| `--protocol <scheme>` | Register custom deep-link scheme (e.g. `myapp://`). |
| `--proxy <url>` | Network proxy URL (HTTP or SOCKS5). |
| `--shortcuts <json>` | JSON mapping for global desktop keyboard shortcuts. |
| `--block-ads` | Enable domain-level tracker and ad blocking. |
| `--width <px>` / `--height <px>` | Initial desktop window dimensions. |
| `--no-remember` | Disable persistent window sizing across launches. |
| `--no-icon` | Skip fetching site favicon and use default mascot icon. |
| `--build` | Automatically install dependencies and run target build script. |

---

## Building Desktop Apps

Navigate into the generated project folder to test or build:

```bash
cd apps/example-app
npm install
npm start
```

To package the application into a distribution binary for your current OS:

```bash
npm run build:this
```

Build outputs are saved to `dist/`.

---

## Building Android APKs

Generate an Android target project using Capacitor:

```bash
pico --url "https://example.com" --name "Example Mobile" --platforms android
cd apps/example-mobile
npm install
npm run android:add
npm run android:apk:debug
```

The resulting debug APK is created at:
`android/app/build/outputs/apk/debug/app-debug.apk`

### Android Build Commands

| Command | Action |
| --- | --- |
| `npm run android:add` | Initializes the native Android project directory safely (idempotent). |
| `npm run android:sync` | Syncs web launcher assets and updates Capacitor configuration. |
| `npm run android:apk:debug` | Compiles a local debug APK signed with debug keystore. |
| `npm run android:apk` | Runs full production build flow for release APKs or App Bundles. |

> **Note:** Desktop-specific features (custom CSS/JS injection, navigation bar, system tray, ad-blocker) are desktop-only and do not apply to the native Android WebView.

---

## Desktop GUI Application

Pico includes a desktop GUI application built with Electron:

```bash
npm run gui
```

Features included in the GUI interface:
- Visual project configuration form for all CLI parameters.
- Built-in APK builder with keystore selection for signed release APKs (`.apk`) and Google Play App Bundles (`.aab`).
- Real-time build progress logs, SHA-256 checksum verification, and direct download actions.

---

## Distributed Build Workers

Pico provides containerized queue-worker services under `services/build-workers/` for headless building in CI/CD or Kubernetes environments.

| Target | Command | Dockerfile | Output |
| --- | --- | --- | --- |
| **Linux** | `npm run start:linux` | `Dockerfile.linux` | `.AppImage`, `.deb` |
| **Windows** | `npm run start:windows` | `Dockerfile.windows` | `.exe` |
| **macOS** | `npm run start:macos` | Native macOS host | `.dmg` |
| **Android** | `npm run start:android` | `Dockerfile.android` | `.apk`, `.aab` |

Deploy worker services to Kubernetes using the provided manifests:

```bash
kubectl apply -f services/build-workers/deploy/kubernetes/android-worker.yaml
```

---

## Testing

Run generator tests from root:

```bash
npm test
```

Run build-worker tests and type checks:

```bash
cd services/build-workers
bun install
bun test
bun run typecheck
```

---

## Troubleshooting

| Symptom | Cause | Solution |
| --- | --- | --- |
| `sdkmanager: command not found` | Android SDK tools missing from `PATH`. | Add `$ANDROID_SDK_ROOT/cmdline-tools/latest/bin` to your environment `PATH`. |
| `javaCompiler unavailable` | Only JRE installed instead of full JDK. | Install OpenJDK 21 and export `JAVA_HOME`. |
| `android platform already exists` | Direct Capacitor invocation. | Use `npm run android:add` guard script. |
| Missing SDK platform package | Required Android API level not installed. | Run `sdkmanager "platforms;android-35"` to download. |

---

## Project Structure

```text
src/
├── cli.js            # CLI entry point and interactive wizard
├── generator.js      # Project scaffolding and template rendering engine
├── gui.js / gui.html # Graphical desktop app builder interface
└── utils.js          # Favicon fetcher and URL validation helpers
template/             # Base Electron template for desktop projects
services/             # Microservices (website analyzer, build workers, tauri generator)
tests/                # Test suites for generator and GUI status
```

---

## License

Released under the [MIT License](LICENSE).
