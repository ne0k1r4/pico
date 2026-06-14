// main.js — electron entry point
// TODO: add auto-updater (electron-updater) — people keep asking
// TODO: keyboard shortcut to toggle toolbar visibility
// TODO: per-app zoom level persistence

'use strict'

const {
  app, BrowserWindow, Menu, shell,
  ipcMain, Tray, nativeImage, screen, session
} = require('electron')
const path = require('path')
const fs   = require('fs')

const config = (() => {
  try {
    return require('./app-config.json')
  } catch (e) {
    // this should never happen in a generated app but just in case
    console.error('FATAL: could not load app-config.json —', e.message)
    process.exit(1)
  }
})()

const STATE_PATH   = path.join(app.getPath('userData'), 'window-state.json')
const BLOCKED_PATH = path.join(__dirname, 'blocked-domains.json')

let win  = null
let tray = null

// ─── window state ────────────────────────────────────────────────────────────

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'))
  } catch {
    return {}  // first run or corrupted — start fresh
  }
}

function writeState() {
  if (!win || win.isMinimized() || win.isMaximized()) return
  try {
    fs.writeFileSync(STATE_PATH, JSON.stringify(win.getBounds()))
  } catch {
    // not critical — worst case they lose window position
  }
}

// check the saved position is still on a connected monitor
// happens a lot with multi-monitor setups when you unplug one
function isOnScreen(x, y) {
  if (x == null || y == null) return false
  return screen.getAllDisplays().some(d =>
    x >= d.bounds.x && x < d.bounds.x + d.bounds.width &&
    y >= d.bounds.y && y < d.bounds.y + d.bounds.height
  )
}

// ─── ad blocking ─────────────────────────────────────────────────────────────

function setupAdBlocking() {
  if (!config.blockAds) return

  let blocked = []
  try {
    blocked = JSON.parse(fs.readFileSync(BLOCKED_PATH, 'utf8'))
  } catch {
    return  // no blocklist file — skip silently
  }

  // intercept requests and kill ones matching blocked domains
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, cb) => {
    try {
      const hostname = new URL(details.url).hostname
      const isBlocked = blocked.some(d => hostname === d || hostname.endsWith('.' + d))
      cb({ cancel: isBlocked })
    } catch {
      cb({ cancel: false })
    }
  })
}

// ─── dark mode injection ──────────────────────────────────────────────────────

// crude but effective — inverts the page and re-inverts images/videos
// not perfect for every site but good enough for most
const DARK_CSS = `
html { filter: invert(1) hue-rotate(180deg) !important; }
img, video, canvas, iframe, [style*="background-image"] {
  filter: invert(1) hue-rotate(180deg) !important;
}
`

// ─── create window ────────────────────────────────────────────────────────────

function createWindow() {
  const saved    = config.rememberSize ? readState() : {}
  const isFrameless = config.windowStyle === 'frameless'

  // don't restore to a monitor that's no longer plugged in
  const x = isOnScreen(saved.x, saved.y) ? saved.x : undefined
  const y = isOnScreen(saved.x, saved.y) ? saved.y : undefined

  win = new BrowserWindow({
    width:  saved.width  || config.width  || 1280,
    height: saved.height || config.height || 800,
    x, y,
    minWidth:  380,
    minHeight: 300,
    title:     config.name,
    icon:      path.join(__dirname, 'icon.png'),
    frame:     !isFrameless,
    // hidden title bar on mac so window still drags from top
    titleBarStyle: process.platform === 'darwin' && isFrameless ? 'hiddenInset' : 'default',
    alwaysOnTop:   !!config.alwaysOnTop,
    backgroundColor: '#ffffff',
    show: false,  // show after content loads — avoids white flash
    webPreferences: {
      nodeIntegration:  false,
      contextIsolation: true,
      webviewTag:       true,
      preload: path.join(__dirname, 'preload.js'),
      // TODO: evaluate if spellcheck should be configurable
      spellcheck: true
    }
  })

  win.loadFile(path.join(__dirname, 'app.html'))

  win.once('ready-to-show', () => {
    win.show()
    if (saved.maximized) win.maximize()
  })

  win.on('close', e => {
    // tray mode — hide instead of actually closing
    if (config.systemTray && !app._quitting) {
      e.preventDefault()
      win.hide()
      return
    }
    if (config.rememberSize) writeState()
  })

  win.on('closed', () => { win = null })

  // links to other origins → open in browser, not a new electron window
  // without this you end up with a mess of windows for oauth flows etc
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const appOrigin  = new URL(config.url).origin
      const linkOrigin = new URL(url).origin
      if (linkOrigin !== appOrigin) {
        shell.openExternal(url)
        return { action: 'deny' }
      }
    } catch {
      // malformed url — just deny it
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })

  // inject dark mode css into every page if enabled
  if (config.darkMode) {
    win.webContents.on('did-finish-load', () => {
      win.webContents.insertCSS(DARK_CSS).catch(() => {})
    })
  }

  buildMenu()
}

// ─── tray ────────────────────────────────────────────────────────────────────

function setupTray() {
  if (!config.systemTray) return

  try {
    const img = nativeImage.createFromPath(path.join(__dirname, 'icon.png'))
      .resize({ width: 16, height: 16 })
    tray = new Tray(img)
    tray.setToolTip(config.name)
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Show ' + config.name, click: () => win?.show() },
      { type: 'separator' },
      { label: 'Quit', click: () => { app._quitting = true; app.quit() } }
    ]))
    tray.on('click', () => win?.isVisible() ? win.hide() : win?.show())
  } catch (e) {
    // tray can fail on some linux setups (no systray support) — not fatal
    console.warn('tray setup failed:', e.message)
  }
}

// ─── menu ─────────────────────────────────────────────────────────────────────

function buildMenu() {
  const mac = process.platform === 'darwin'

  const tpl = [
    ...(mac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: 'File',
      submenu: [mac ? { role: 'close' } : { role: 'quit' }]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Back',    accelerator: 'Alt+Left',  click: () => win?.webContents.send('nav', 'back') },
        { label: 'Forward', accelerator: 'Alt+Right', click: () => win?.webContents.send('nav', 'forward') },
        { label: 'Home',    accelerator: 'CmdOrCtrl+Shift+H', click: () => win?.webContents.send('nav', 'home') },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'resetZoom' },
        { type: 'separator' },
        { role: 'toggleDevTools' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Open in Browser', click: () => shell.openExternal(config.url) },
        { label: 'Clear Cache & Reload', click: clearCacheAndReload }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl))
}

async function clearCacheAndReload() {
  try {
    await session.defaultSession.clearCache()
    await session.defaultSession.clearStorageData({ storages: ['cookies', 'localstorage', 'sessionstorage'] })
    win?.webContents.send('nav', 'home')
  } catch (e) {
    console.error('cache clear failed:', e.message)
  }
}

// ─── ipc ─────────────────────────────────────────────────────────────────────

ipcMain.handle('get-config', () => config)

ipcMain.on('open-external', (_, url) => {
  shell.openExternal(url).catch(e => console.warn('open-external failed:', e.message))
})

// ─── lifecycle ────────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  setupAdBlocking()
  createWindow()
  setupTray()
})

app.on('window-all-closed', () => {
  // on mac apps usually stay alive until cmd+q — match that behavior
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (!win) createWindow()
  else win.show()
})

app.on('before-quit', () => {
  app._quitting = true
  if (config.rememberSize && win) writeState()
})
