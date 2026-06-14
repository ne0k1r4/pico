# Changelog

## [1.0.0] — 2026-06-14

### Added
- CLI with interactive prompts (inquirer)
- Electron webview shell with navigation toolbar
- Frameless / immersive window mode
- System tray support — minimize to tray on close
- Always-on-top option
- Custom CSS injection into every page load
- Window size & position persistence across sessions
- Smart URL bar — bare domains, search fallback
- Auto favicon fetch with Google fallback
- Loading splash screen
- Correct macOS app menu (About / Hide / Quit)
- Multi-screen position restore safety check
- External links open in default browser
- Live favicon in URL bar
- Page title reflected in window title
- Gradient fallback icon generated from app initial
- Cross-platform build config: Windows (.exe), macOS (.dmg), Linux (.AppImage/.deb)

### Fixed
- Window position restored off-screen on single-monitor setups
- New-window events were spawning extra Electron windows
- macOS menu missing standard app entries
