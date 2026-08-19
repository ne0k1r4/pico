# Changelog

## [1.6.0] — 2026-08-19

### Added

- A custom-keystore **Signed Release APK** flow in the desktop interface, with native keystore selection and one-build-only alias and password fields.
- SHA-256 display and native clipboard copy controls beside every completed APK download action.
- Dual GUI workflow verification for debug and release APKs, including confirmation that the release artifact is signed by the selected keystore.

### Security

- Keystore passwords are kept in memory only, never written to generated projects, and are removed from the interface immediately after handoff to the build process.
- Pico writes the temporary Gradle signing initializer with owner-only permissions and removes it after the build.

---

## [1.5.1] — 2026-08-18

### Added

- A **Download Debug APK** action that appears only after the graphical build pipeline verifies `app-debug.apk`.
- A user-selected Save As flow for APK artifacts, with cancellation, retry, and completed-download feedback in the status panel.
- A visible Electron end-to-end workflow that generates an Android project, builds its APK, downloads it through the interface, and verifies the saved artifact.

---

## [1.5.0] — 2026-08-18

### Added

- Visible real-time Android APK stage indicators in the desktop interface for dependencies, native project preparation, asset sync, Gradle compilation, and the final artifact.
- Structured IPC build-status events and APK artifact-path feedback alongside the existing compiler log stream.
- GUI regression coverage that verifies the real-time APK status bridge and display contract.

### Changed

- The GUI build pipeline now awaits every stage and reports a clear success or failure result to the interface.

---

## [1.4.1] — 2026-08-18

### Fixed

- Rejected non-web URLs, incomplete project settings, and invalid window dimensions before generation can write a malformed project.
- Reported missing CLI option values and malformed shortcut JSON instead of failing with an unhelpful runtime error.
- Prevented the desktop GUI from attempting to launch Electron for Android-only projects.
- Corrected Android application IDs so every generated identifier satisfies Android's package-name rules.
- Made Android project preparation idempotent, so repeated APK builds reuse the existing native project.
- Completed Android job support in the build worker, including command planning, artifact discovery, content typing, and an Android SDK worker image.

---

## [1.4.0] — 2026-08-18

### Added

- Android target generation through Capacitor, including website launcher assets, native configuration, and APK build scripts.
- Android options in the interactive CLI and desktop GUI.
- Android-specific generation tests and a generated-project build guide.

### Changed

- Generated project metadata now rejects unsupported platform targets before writing output files.

---

## [1.3.0] — 2026-08-18

### Changed

- Updated the CLI and generated application toolchains to Electron 43 and Electron Builder 26.
- Updated the interactive CLI dependencies to Inquirer 14, Chalk 6, and the current fs-extra 11 release.
- Declared Node.js 22 as the supported runtime for Pico and generated applications.

### Fixed

- Restored the generated app toolbar navigation bridge by aligning its IPC event channel.
- Corrected the GUI favicon request payload so site icons can be retrieved from the desktop dashboard.

---

## [1.2.0] — 2026-06-25

### Added

- GUI: Electron-based config dashboard (`npm run gui`)
- Run App Launcher button — spawns generated app directly from GUI
- Real-time build log output in GUI terminal panel
- CLI preview pane — shows equivalent CLI command as you configure

### Fixed

- App launcher was using `exec('npm start')` which silently failed on some setups; now resolves the actual electron binary from the generated app's `node_modules`
- URL validation no longer blocks submission when site is unreachable

---

## [1.1.0] — 2026-06-14

### Added

- Dark mode injection via CSS `filter: invert` + hue-rotate
- Ad/tracker domain blocking via Electron `webRequest` intercept
- Custom CSS injection at page load
- System tray support — app hides to tray instead of quitting
- Always-on-top window option
- Window size and position persistence

### Fixed

- Window position restored off-screen on single-monitor setups after disconnecting external display
- New-window events were spawning extra Electron windows instead of opening in browser

---

## [1.0.0] — 2026-06-14

### Added

- CLI with interactive prompts
- Electron webview shell with navigation toolbar
- Frameless window mode
- Favicon fetch with Google fallback
- Gradient fallback icon generated from app name initial
- Multi-screen safe window position restore
- macOS standard app menu
- Cross-platform build config: Windows, macOS, Linux
