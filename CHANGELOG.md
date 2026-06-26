# Changelog

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
