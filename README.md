# pico

Wraps any website into a desktop app. Works on Windows, Mac, and Linux.

That's it.

---

## why

I got tired of having 30 browser tabs open. Some sites I use every day deserve their own window, their own tray icon, their own place in the taskbar. This does that.

---

## install

```bash
git clone https://github.com/ne0k1r4/pico.git
cd pico
npm install
```

---

## usage

```bash
node src/cli.js
```

It will ask you a few questions — URL, app name, window style, that kind of stuff. Answer them, it generates a folder with a ready-to-run Electron app inside.

Then:

```bash
cd apps/<your-app>
npm install
npm start
```

To build an actual installer:

```bash
npm run build
```

Installer lands in `apps/<your-app>/dist/`.

---

## what you can configure

- **Window style** — normal, frameless (no title bar), or minimal
- **Navigation toolbar** — show or hide the back/forward/url bar
- **System tray** — minimize to tray instead of closing
- **Always on top** — float above other windows
- **Dark mode** — forces dark on any site, even ones without it
- **Custom CSS** — inject your own styles into the page
- **Ad blocking** — blocks requests to common ad/tracker domains
- **Window size** — default width and height
- **Remember size** — restores last position and size on relaunch
- **Auto favicon** — pulls the site icon so the app looks real

---

## build targets

| Platform | Output |
|---|---|
| Linux | `.AppImage` + `.deb` |
| Windows | `.exe` (NSIS installer) |
| macOS | `.dmg` (Intel + Apple Silicon) |

---

## add to app launcher (Linux)

After building, create a `.desktop` file so it shows up in your app menu:

```ini
[Desktop Entry]
Name=MyApp
Exec=/path/to/dist/myapp.AppImage
Icon=/path/to/apps/myapp/icon.svg
Type=Application
Categories=Network;
```

Save it to `~/.local/share/applications/myapp.desktop` and it will appear in your launcher.

---

## tips

- Replace `icon.png` in the generated folder with a real 512x512 PNG before building — makes the installer look proper
- If the site already has dark mode just leave the dark mode option off
- Custom CSS is great for hiding cookie banners, removing sidebars, whatever annoys you
- System tray is useful for things you want running in the background all day
- Run with `DEBUG=1 node src/cli.js` if something breaks — prints the full stack trace

---

## license

MIT
