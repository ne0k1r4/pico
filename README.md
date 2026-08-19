# Pico

[![Pico CI](https://github.com/ne0k1r4/pico/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/ne0k1r4/pico/actions/workflows/ci.yml)
[![Build workers](https://github.com/ne0k1r4/pico/actions/workflows/build-workers.yml/badge.svg?branch=main)](https://github.com/ne0k1r4/pico/actions/workflows/build-workers.yml)

**Pico** turns an HTTP or HTTPS website into a native project that can be packaged for desktop operating systems or Android. Version **1.6.0** generates Electron 43 desktop applications and Capacitor 8 Android projects, including idempotent Android setup, debug and custom-keystore release APK workflows, and build-worker support.

> Pico wraps the target website in a native runtime. It does not copy the website's source code, make an offline mirror, or bypass the website's authentication and access controls.

| Target  | Generated runtime | Primary output          | Build environment                  |
| ------- | ----------------- | ----------------------- | ---------------------------------- |
| Linux   | Electron          | `.AppImage`, `.deb`     | Linux host                         |
| Windows | Electron          | NSIS `.exe`             | Windows host or compatible builder |
| macOS   | Electron          | `.dmg`                  | macOS host                         |
| Android | Capacitor WebView | Debug or release `.apk` | Java, Android SDK, Gradle wrapper  |

## Requirements

Pico requires **Node.js 22 or later**. Check the active runtime with `node --version` before installing. Desktop packaging also requires the usual host-platform dependencies used by Electron Builder.

Android projects require a JDK, Android SDK command-line tools, platform tools, and a matching Android platform/build-tools installation. Capacitor supports Android API 24 and later; physical devices require an up-to-date Android WebView. [1]

| Purpose                           | Minimum requirement              | Verification command        |
| --------------------------------- | -------------------------------- | --------------------------- |
| Run Pico                          | Node.js 22                       | `node --version`            |
| Build an Android APK              | JDK with `javac`                 | `javac -version`            |
| Manage Android packages           | Android SDK tools                | `sdkmanager --version`      |
| Build a generated Android project | Android SDK platform/build-tools | `npm run android:apk:debug` |

## Install

Clone the repository, install its dependencies, and link the CLI locally.

```bash
git clone https://github.com/ne0k1r4/pico.git
cd pico
npm install
npm link
```

After linking, `pico` is available as a command in the active Node.js environment. Use `npm run gui` instead if you prefer the desktop configuration interface.

## Generate an application

Run Pico without arguments to use the interactive workflow. It asks for the website, application name, packaging targets, and optional desktop settings.

```bash
pico
```

For repeatable builds and CI, provide the site and application name directly.

```bash
pico --url "https://example.com" --name "Example App" --platforms linux
```

Pico validates that the target is a syntactically valid `http://` or `https://` URL before it creates project files. A transient reachability check in the interactive flow is advisory, so an otherwise valid site can still be packaged when the target is temporarily unavailable.

### CLI reference

| Flag                             | Description                                                                 |
| -------------------------------- | --------------------------------------------------------------------------- |
| `--url <url>`                    | Required website URL. Pico accepts HTTP and HTTPS only.                     |
| `--name <name>`                  | Required application display name.                                          |
| `--outputDir <dir>`              | Project output folder; default: `./apps`.                                   |
| `--platforms <list>`             | Comma-separated targets: `linux,win,mac,android`.                           |
| `--style <style>`                | Desktop window style: `normal`, `frameless`, or `minimal`.                  |
| `--no-toolbar`                   | Hides the Electron navigation toolbar.                                      |
| `--tray`                         | Minimizes a desktop app to the system tray when supported.                  |
| `--always-on-top`                | Keeps a desktop window above other windows.                                 |
| `--dark`                         | Applies the desktop dark-mode injection.                                    |
| `--css <css>`                    | Enables and injects a desktop custom CSS string.                            |
| `--js <js>`                      | Enables desktop custom JavaScript at document-ready.                        |
| `--user-agent <ua>`              | Overrides the desktop request user agent.                                   |
| `--protocol <scheme>`            | Registers a custom desktop deep-link scheme.                                |
| `--proxy <url>`                  | Configures an HTTP or SOCKS proxy for desktop output.                       |
| `--shortcuts <json>`             | JSON map of desktop global shortcuts. Invalid JSON is rejected.             |
| `--block-ads`                    | Enables the desktop request filter for the bundled tracker-domain list.     |
| `--width <px>` / `--height <px>` | Positive whole-number desktop window dimensions.                            |
| `--no-remember`                  | Disables desktop window-size persistence.                                   |
| `--no-icon`                      | Skips website favicon retrieval and uses Pico's fallback icon.              |
| `--build`                        | Installs generated dependencies and starts the selected packaging workflow. |

## Desktop output

Desktop projects contain Electron runtime files and are ready to install and run locally.

```bash
cd apps/example-app
npm install
npm start
```

Package the project for the host target with the generated script.

```bash
npm run build:this
```

For a desktop-only target, this calls Electron Builder and writes artifacts under `dist/`. Cross-platform packaging may require building on the target operating system, particularly for macOS signing and notarization.

## Android APK output

Use the Android target to generate a Capacitor project that opens the selected website inside an Android WebView.

```bash
pico --url "https://example.com" --name "Example Mobile" --platforms android
cd apps/example-mobile
npm install
npm run android:add
npm run android:apk:debug
```

The generated `android:add` command is safe to rerun. It reuses an existing `android/` directory instead of deleting a native project that may contain local changes. `android:sync` also runs this guard before it copies the launcher page and updates Capacitor configuration.

| Command                     | Outcome                                                                                               |
| --------------------------- | ----------------------------------------------------------------------------------------------------- |
| `npm run android:add`       | Creates the native Android directory once, or reuses it on later runs.                                |
| `npm run android:sync`      | Copies the current web launcher and refreshes native Capacitor configuration.                         |
| `npm run android:apk:debug` | Builds a locally signed debug APK.                                                                    |
| `npm run android:apk`       | Starts Capacitor's Android APK build flow; configure a release keystore for distributable output. [2] |

The debug APK is written to:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

> A debug APK is signed with the local Android debug certificate. It is appropriate for local installation and QA, not for Play Store distribution. Use a private release keystore and a release-signing workflow before public delivery.

Pico generated and verified a debug APK for `https://sujalinfo.in` during the v1.4.1 validation pass. The application used package ID `io.pico.appsujalinfo`, was built successfully with the Gradle wrapper, and passed APK signature verification.

### Android limitations

Android output intentionally uses a native WebView. Electron-specific features—including the desktop toolbar, system tray, Electron request filtering, and renderer CSS/JavaScript injection—do not transfer to Android. Website authentication, cookies, and permissions are controlled by the Android WebView and the target site.

### Desktop GUI

Launch Pico's desktop GUI with:

```bash
npm run gui
```

Select **Android (.APK)** under packaging targets to create a mobile project. For Android-only output, the **Run App Launcher** action explains that an emulator or physical device is required; use **Compile Native Installer** to prepare and build the APK instead.

During an Android build, the terminal view now adds a live status panel for dependency installation, Android project preparation, Capacitor asset synchronization, Gradle compilation, release signing, and the final APK artifact. When the build completes, the panel displays the artifact path, its SHA-256 checksum, a **Copy SHA-256** action, and a **Download** action that saves the APK through a native file dialog.

To create a signed release APK, select **Android (.APK)** and then enable **Signed Release APK**. Use **Select Keystore** to choose a local `.jks`, `.keystore`, `.p12`, or `.pfx` file; provide its alias and passwords; then choose **Compile Native Installer**. Pico passes these values to a temporary owner-only Gradle initializer for that build and deletes the initializer afterward. It does not add passwords, aliases, or the keystore path to the generated project or preserve them in the interface after the build begins.

## Build-worker deployment

`services/build-workers/` contains queue consumers for unattended artifact builds. The worker validates a source archive, checks its SHA-256 digest, builds the selected platform, finds output artifacts, and uploads the artifacts and JSONL build log to object storage.

Android jobs use Pico-generated Capacitor sources rather than a Tauri workspace. The Android command path installs package dependencies, ensures the Android project exists, synchronizes Capacitor, runs Gradle's debug-APK task, then uploads files found beneath `android/app/build/outputs/`.

| Worker target | Start command           | Container definition | Uploaded artifact |
| ------------- | ----------------------- | -------------------- | ----------------- |
| Linux         | `npm run start:linux`   | `Dockerfile.linux`   | Desktop bundle    |
| Windows       | `npm run start:windows` | `Dockerfile.windows` | Desktop bundle    |
| macOS         | `npm run start:macos`   | Native macOS host    | Desktop bundle    |
| Android       | `npm run start:android` | `Dockerfile.android` | `.apk`            |

The Android worker image installs Node.js 22, Bun, OpenJDK 21, Android SDK command-line tools, API 35 build components, and platform tools. Configure `REDIS_URL`, `ARTIFACT_BUCKET`, storage credentials, and `WORKER_PLATFORM=android` before deployment. The worker requires a persistent build environment with sufficient storage for Gradle and Android SDK caches.

Apply the provided Kubernetes manifest after creating the `pico-build-worker` secret with the required Redis and object-storage values. The manifest configures one Android worker with secure pod defaults, build-appropriate resources, and an isolated ephemeral workspace.

```bash
kubectl apply -f services/build-workers/deploy/kubernetes/android-worker.yaml
```

The **Pico CI** badge reports root generator tests, while the **Build workers** badge reports worker tests, type checking, and container builds. On pushes to `main`, the worker workflow publishes `ghcr.io/ne0k1r4/pico-build-worker-android` for the deployment manifest.

## Test and validate

Run the main generator tests from the repository root.

```bash
npm test
```

Run the build-worker tests and TypeScript check separately.

```bash
cd services/build-workers
bun install
bun test
bun run typecheck
```

The root suite covers desktop generation, fallback icons, configuration fields, Android project structure, Android package IDs, and input validation. The worker suite covers desktop and Android command planning plus queue-schema acceptance.

## Troubleshooting

| Symptom                                                | Likely cause                                                         | Resolution                                                                                      |
| ------------------------------------------------------ | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `sdkmanager: command not found`                        | Android SDK command-line tools are absent from `PATH`.               | Install the command-line tools and add `<ANDROID_SDK_ROOT>/cmdline-tools/latest/bin` to `PATH`. |
| Gradle reports that `javaCompiler` is unavailable      | A JRE is installed without the JDK compiler.                         | Install a full JDK and set `JAVA_HOME` to its installation directory.                           |
| `android platform already exists`                      | A project invokes Capacitor directly instead of Pico's guard script. | Use `npm run android:add`; it is safe to rerun.                                                 |
| Debug APK build cannot find an SDK platform            | The required Android platform/build-tools package is missing.        | Install the platform requested by Gradle with `sdkmanager`, then rerun the build.               |
| Android app opens but a desktop-only option is missing | Android uses Capacitor WebView rather than Electron.                 | Use the documented Android workflow or implement an Android-native equivalent.                  |
| Website cannot be packaged                             | The target URL is malformed or uses a non-web scheme.                | Supply a full HTTP or HTTPS URL.                                                                |

## Repository layout

| Path                          | Purpose                                                        |
| ----------------------------- | -------------------------------------------------------------- |
| `src/cli.js`                  | Interactive and non-interactive Pico command-line interface.   |
| `src/generator.js`            | Validates project input and writes desktop and Android output. |
| `src/gui.js` / `src/gui.html` | Electron-based desktop configuration interface.                |
| `template/`                   | Electron runtime template copied to desktop projects.          |
| `tests/`                      | Node.js generator regression tests.                            |
| `services/build-workers/`     | Queue-based platform builders, including `Dockerfile.android`. |
| `CHANGELOG.md`                | Versioned feature and bug-fix history.                         |

## License

Pico is released under the [MIT License](LICENSE).

## References

[1] [Capacitor Android Documentation](https://capacitorjs.com/docs/android)

[2] [Capacitor CLI: `cap build`](https://capacitorjs.com/docs/cli/commands/build)
