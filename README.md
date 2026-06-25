# 🌟 pico-chan 🌟

<p align="center">
  <img src="assets/mascot.png" alt="pico-chan Mascot" width="280">
  <br>
  <i>"Let's wrap up your favorite websites into beautiful, native desktop apps! (๑˃ᴗ˂)ﻭ"</i>
</p>

---

## 🌸 why pico-chan?

Are you tired of having 50 browser tabs open, hogging your memory? Pico-chan wraps any website into a standalone native desktop application. Give your daily web apps (GitHub, Notion, Discord, etc.) their own window, their own tray icon, and their own dedicated taskbar slot. 

Works beautifully on **Windows, macOS, and Linux**!

---

## 🚀 installation

Get pico-chan set up on your machine in just a few steps:

```bash
# Clone the repository
git clone https://github.com/ne0k1r4/pico.git
cd pico

# Install development dependencies
npm install
```

---

## 🎨 visual gui mode (recommended)

For a fully interactive, dark-neon desktop dashboard, launch the graphical workspace:

```bash
npm run gui
```

The GUI offers a tabbed configurations form, automatic website metadata detection, favicon scraping, and a **real-time CLI command builder**.

<p align="center">
  <i>(〃＾▽＾〃) Configure, compile, and run your new app directly from the dashboard!</i>
</p>

---

## 💻 terminal cli mode

If you prefer the command line, pico-chan has a interactive CLI built right in. 

```bash
# Run the local wrapper script
./pico
```

It will ask you a series of questions—URL, app name, style, always-on-top, etc. Once completed, it compiles your app immediately.

### 🌟 global command shortcut
Want to run pico-chan globally from *any* terminal folder simply as `pico`? Register it globally via NPM:

```bash
# Link the package globally
npm link

# Now you can run it from anywhere!
pico
```

---

## 📦 compiling the generated client

Once generated, run the output wrapper with these simple steps:

```bash
# Navigate to the generated directory
cd apps/<your-app-slug>

# Install the Electron dependencies
npm install

# Run the app locally to test it!
npm start
```

### 🔨 compiling distribution installers

To package the wrapper into a ready-to-distribute native installer (e.g. `.dmg`, `.exe`, or `.AppImage`):

```bash
npm run build
```

The compiled package will land in `apps/<your-app-slug>/dist/`.

---

## 🛠️ features you can configure

- 🖼️ **Window Styles** — Standard normal borders, Frameless (clean header, traffic lights on macOS), or Minimal navigation strip.
- ⚓ **Navigation Controls** — Back, Forward, Home keys and custom address bar.
- 📥 **System Tray Minimize** — Closes to the system tray so the app runs in the background.
- 🔝 **Always on Top** — Float client above other application bounds.
- 🌙 **Force Dark Mode** — Inverts color layouts on target site dynamically using active CSS filters.
- 🎨 **Custom CSS Injection** — Paste customized style overrides.
- 🛡️ **Ad Blocking** — Automatically intercepts and cancels requests to common ad/tracker domains.
- ⚙️ **Bound Memory** — Restores the window size and position from the last session.

---

## 📦 build distribution targets

| Platform | Output Artifacts |
|---|---|
| 🐧 **Linux** | `.AppImage` + `.deb` installations |
| 🪟 **Windows** | `.exe` (NSIS Installer) |
| 🍏 **macOS** | `.dmg` (Universal Intel + Apple Silicon build) |

---

## 🎀 developer tips

- **Custom Icons:** Replace the generated `icon.png` in your client directory with a custom 512x512 PNG file before compiling distribution builds to ensure proper icon rendering.
- **Custom CSS:** Use Custom CSS to hide unnecessary elements (such as cookie banners, footers, or sidebars) to give your wrapped app a truly native client look.
- **Debug logs:** If an application crashes, run the CLI command with `DEBUG=1` (`DEBUG=1 ./pico`) to view full execution stack traces.

---

## 📄 license

MIT
