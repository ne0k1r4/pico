# pico-chan

<p align="center">
  <img src="assets/mascot.png" alt="pico-chan Mascot" width="280">
  <br>
  <i>"Let's wrap up your favorite websites into beautiful, native desktop apps! (๑˃ᴗ˂)ﻭ"</i>
</p>

---

## The pico-chan Project

Pico-chan is a high-performance desktop wrapper engine. It takes standalone web applications (such as GitHub, Notion, or Discord) and packages them into dedicated, native desktop executables. By wrapping your targets in isolated window scopes, Pico-chan frees your system memory from heavy browser tabs and places your applications in their proper place: your taskbar, system tray, and desktop launchers.

Supported target systems include **Windows, macOS, and Linux**.

---

## Installation

To clone and initialize the development workspace on your local host:

```bash
# Clone the repository
git clone https://github.com/ne0k1r4/pico.git
cd pico

# Install workspace dependencies
npm install
```

---

## Visual GUI Mode

For a fully interactive, dark-neon desktop compiler dashboard, run:

```bash
npm run gui
```

The GUI offers tabbed configuration panels, automatic website validation, icon scraping, and a real-time command line generator.

<p align="center">
  <i>(〃＾▽＾〃) Configure, compile, and run your new app directly from the dashboard!</i>
</p>

---

## Terminal CLI Mode

If you prefer operating from the terminal, Pico-chan provides a CLI.

```bash
# Run the local wrapper script
./pico
```

Answer the interactive configuration prompts (URL, name, style, dimensions) to generate your Electron application wrapper immediately.

### Global Command Setup
To register Pico-chan globally on your host so it can be called from any directory as `pico`:

```bash
# Link the package globally
npm link

# Now you can run it from anywhere!
pico
```

---

## Compiling the Generated Client

After generating your application, follow these commands to launch or package it:

```bash
# Enter the generated directory
cd apps/<your-app-slug>

# Install the Electron dependencies
npm install

# Run the app locally
npm start
```

### Packaging Distribution Installers

To package your wrapper into a ready-to-distribute native installer (e.g. `.dmg`, `.exe`, or `.AppImage`):

```bash
npm run build
```

The compiled package will land in `apps/<your-app-slug>/dist/`.

---

## Configurable Capabilities

- **Window Styles** — Choose between Standard (normal window decoration), Frameless (immersive borderless layout), or Minimal navigation strip.
- **Navigation Controls** — Include back, forward, and home buttons, as well as an active URL bar.
- **System Tray Minimize** — Minimize the application window to the system tray to let it run in the background.
- **Always on Top** — Float the application window above all other application bounds.
- **Force Dark Mode** — Invert light page colors dynamically using active CSS filters.
- **Custom CSS Injection** — Inject custom overrides at load time.
- **Ad Blocking** — Intercept and drop requests to common advertising and tracking domains.
- **Bound Memory** — Restore the window size and coordinates from the last session.

---

## Distribution Targets

| Platform | Output Artifacts |
|---|---|
| Linux | `.AppImage` + `.deb` installations |
| Windows | `.exe` (NSIS Installer) |
| macOS | `.dmg` (Universal Intel + Apple Silicon build) |

---

## Developer Tips

- **Custom Icons:** Replace the generated `icon.png` in your client directory with a custom 512x512 PNG file before compiling distribution builds to ensure proper icon rendering.
- **Custom CSS:** Use Custom CSS to hide unnecessary elements (such as cookie banners, footers, or sidebars) to give your wrapped app a truly native client look.
- **Debug logs:** If an application crashes, run the CLI command with `DEBUG=1` (`DEBUG=1 ./pico`) to view full execution stack traces.

---

## License

MIT
