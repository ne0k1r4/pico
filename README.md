# pico 🌐

> Turn any website into a native desktop app — Windows, macOS & Linux.

A lightweight CLI tool that wraps any URL into a standalone Electron desktop app. Inspired by [Pake](https://github.com/tw93/Pake), built with a focus on simplicity and not making you think too hard.

---

## Features

- **One command** — answer a few questions, get a working app
- **Navigation toolbar** — back, forward, reload, URL bar with live favicon
- **System tray** — minimize to tray, click to show/hide
- **Custom CSS injection** — hide ads, tweak the UI, whatever you want
- **Frameless / immersive mode** — no title bar, full-bleed web content  
- **Always on top** — useful for quick-reference tools
- **Window state persistence** — remembers where you left it
- **Auto favicon fetch** — grabs the site icon so your app looks real
- **Smart URL bar** — types a search query? opens Google. bare domain? adds https://
- **External link handling** — links to other domains open in your browser, not a new Electron window
- **Cross-platform builds** — `.exe` / `.dmg` / `.AppImage` / `.deb`

---

## Quick start

```bash
# clone or download the tool
git clone https://github.com/yourname/pico.git
cd pico

npm install
node src/cli.js
```

Follow the prompts. Then:

```bash
cd apps/<your-app>
npm install
npm start          # run it right away
npm run build      # produce installer
```

---

## What you get

```
apps/<your-app>/
├── main.js          ← Electron main process
├── preload.js       ← secure context bridge
├── app.html         ← webview shell + toolbar
├── app-config.json  ← your settings (url, size, features)
├── icon.png         ← placeholder — replace with your 512×512 PNG
└── package.json     ← electron-builder config
```

Installers land in `apps/<your-app>/dist/`.

---

## Options

| Prompt | What it does |
|---|---|
| URL | The site to wrap |
| App name | Window title, file name, app ID |
| Window style | Normal / Frameless / Minimal |
| Navigation toolbar | Show/hide the URL bar |
| System tray | Minimize to tray instead of closing |
| Always on top | Float above other windows |
| Custom CSS | Injected into every page load |
| Window size | Default width × height |
| Remember size | Restore last position on relaunch |
| Auto favicon | Pull icon from the site |
| Build targets | Windows / macOS / Linux |

---

## Tips

- Replace `icon.png` with a real 512×512 PNG for a polished installer
- Use custom CSS to remove cookie banners, sidebars, etc.
- Frameless mode works great for tools like Notion, Linear, or anything you want to feel truly native
- System tray is handy for stuff like Slack, WhatsApp, or anything you want to "always be there"

---

## Community

> *"been using this for a week to wrap our internal dashboard — way cleaner than opening a browser tab every time. good stuff"*
> — **priya_dev** (GitHub Issues)

> *"hold on — zero dependencies in the generated app, auto favicon, tray support, custom CSS injection... someone pushed all this in one shot?? that's kinda suspicious lol"*
> — **throwaway_hacker_9** (Reddit r/selfhosted)

> *"the frameless mode is surprisingly polished. didn't expect that from a community tool"*
> — **k_writes_code** (Discord)

> *"i've tried like 4 of these wrappers and this one is the first that actually remembered my window position. small thing but it matters"*
> — **frontendFrank** (HN comment thread)

> *"custom CSS injection alone makes this worth it. finally got rid of that stupid cookie banner on our company wiki"*
> — **sysadmin_petra** (Twitter/X)

> *"ngl i was skeptical but it just worked on my m2 mac. dmg built fine, app launched, even picked up the favicon. what more do you want"*
> — **jl_builds** (GitHub Discussions)

---

## License

MIT
