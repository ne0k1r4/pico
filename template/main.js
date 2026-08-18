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
    console.error('FATAL: could not load app-config.json —', e.message)
    process.exit(1)
  }
})()

function isAllowedNavigation(targetUrl, baseUrl) {
  try {
    const target = new URL(targetUrl)
    const base = new URL(baseUrl)

    if (target.protocol === 'javascript:' || target.protocol === 'data:') {
      return false
    }

    const targetHost = target.hostname.toLowerCase().replace(/^www\./, '')
    const baseHost = base.hostname.toLowerCase().replace(/^www\./, '')

    if (targetHost === baseHost || targetHost.endsWith('.' + baseHost)) {
      return true
    }

    const authProviders = [
      'accounts.google.com',
      'github.com',
      'appleid.apple.com',
      'login.microsoftonline.com',
      'facebook.com',
      'twitter.com',
      'auth0.com'
    ]

    return authProviders.some(p => targetHost === p || targetHost.endsWith('.' + p))
  } catch {
    return false
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
}

const STATE_PATH   = path.join(app.getPath('userData'), 'window-state.json')
const BLOCKED_PATH = path.join(__dirname, 'blocked-domains.json')

let win  = null
let tray = null

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'))
  } catch {
    return {}
  }
}

function writeState() {
  if (!win || win.isMinimized() || win.isMaximized()) return
  try {
    fs.writeFileSync(STATE_PATH, JSON.stringify(win.getBounds()))
  } catch {
  }
}

function isOnScreen(x, y) {
  if (x == null || y == null) return false
  return screen.getAllDisplays().some(d =>
    x >= d.bounds.x && x < d.bounds.x + d.bounds.width &&
    y >= d.bounds.y && y < d.bounds.y + d.bounds.height
  )
}

function setupCSP() {
  if (!config.hardenMode) return
  session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
    const headers = details.responseHeaders || {}
    headers["Content-Security-Policy"] = ["default-src * 'unsafe-inline' 'unsafe-eval' data: blob:"]
    cb({ responseHeaders: headers })
  })
}

function setupAdBlocking() {
  if (!config.blockAds) return

  let blocked = []
  try {
    blocked = JSON.parse(fs.readFileSync(BLOCKED_PATH, 'utf8'))
  } catch {
    return
  }

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

const DARK_CSS = `
html { filter: invert(1) hue-rotate(180deg) !important; }
img, video, canvas, iframe, [style*="background-image"] {
  filter: invert(1) hue-rotate(180deg) !important;
}
`

function createWindow() {
  const saved    = config.rememberSize ? readState() : {}
  const isFrameless = config.windowStyle === 'frameless'

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
    titleBarStyle: process.platform === 'darwin' && isFrameless ? 'hiddenInset' : 'default',
    alwaysOnTop:   !!config.alwaysOnTop,
    backgroundColor: '#ffffff',
    show: false,
    webPreferences: {
      nodeIntegration:  false,
      contextIsolation: true,
      webSecurity:      true,
      allowRunningInsecureContent: false,
      navigateOnDragDrop: false,
      webviewTag:       true,
      preload: path.join(__dirname, 'preload.js'),
      spellcheck: true
    }
  })

  win.loadFile(path.join(__dirname, 'app.html'))

  win.once('ready-to-show', () => {
    win.show()
    if (saved.maximized) win.maximize()
  })

  win.on('close', e => {
    if (config.systemTray && !app._quitting) {
      e.preventDefault()
      win.hide()
      return
    }
    if (config.rememberSize) writeState()
  })

  win.on('closed', () => { win = null })

  win.webContents.on('before-input-event', (e, input) => {
    if (!config.hardenMode) return
    const key = (input.key || '').toLowerCase()
    const isF12 = key === 'f12'
    const isInspectCombo = input.control && input.shift && key === 'i'
    if (isF12 || isInspectCombo) e.preventDefault()
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!isAllowedNavigation(url, config.url)) {
      shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })

  win.webContents.on("will-navigate", (e, url) => {
    if (!isAllowedNavigation(url, config.url)) {
      e.preventDefault()
      shell.openExternal(url)
    }
  })

  if (config.darkMode) {
    win.webContents.on('did-finish-load', () => {
      win.webContents.insertCSS(DARK_CSS).catch(() => {})
    })
  }

  buildMenu()
}

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
    tray.on('double-click', () => {
      if (win) {
        if (win.isMinimized()) win.restore()
        win.show()
        win.focus()
      }
    })
  } catch (e) {
    console.warn('tray setup failed:', e.message)
  }
}

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
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
        { type: 'separator' },
        {
          label: 'Find in Page',
          accelerator: 'CmdOrCtrl+F',
          click: () => win?.webContents.send('open-find')
        }
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
        { type: 'separator' },
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+=',
          click: () => win?.webContents.send('zoom-action', 'in')
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => win?.webContents.send('zoom-action', 'out')
        },
        {
          label: 'Reset Zoom',
          accelerator: 'CmdOrCtrl+0',
          click: () => win?.webContents.send('zoom-action', 'reset')
        },
        { type: 'separator' },
        ...(config.hardenMode ? [] : [{ role: 'toggleDevTools' }])
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

ipcMain.handle('get-config', () => config)

ipcMain.on('open-external', (_, url) => {
  shell.openExternal(url).catch(e => console.warn('open-external failed:', e.message))
})

ipcMain.on('shortcut-find', () => {
  if (win) {
    win.webContents.send('open-find')
  }
})

function checkUpdates() {
  if (!config.autoUpdate || !config.updateUrl) return
  try {
    const httpLib = config.updateUrl.startsWith('https') ? require('https') : require('http')
    httpLib.get(config.updateUrl, res => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const info = JSON.parse(data)
          if (info.version && info.version !== app.getVersion()) {
            console.log('[pico] update available:', info.version)
          }
        } catch {}
      })
    }).on('error', () => {})
  } catch {}
}

function registerCustomShortcuts() {
  if (!config.shortcuts || typeof config.shortcuts !== 'object') return
  const { globalShortcut } = require('electron')
  for (const [key, action] of Object.entries(config.shortcuts)) {
    try {
      globalShortcut.register(key, () => {
        if (!win) return
        if (action === 'reload') win.webContents.reload()
        if (action === 'focus') { win.show(); win.focus() }
        if (action === 'find') win.webContents.send('open-find')
      })
    } catch {}
  }
}

app.whenReady().then(() => {
  if (config.userAgent && config.userAgent.trim()) {
    session.defaultSession.setUserAgent(config.userAgent.trim())
  }
  if (config.proxy && config.proxy.trim()) {
    session.defaultSession.setProxy({ proxyRules: config.proxy.trim() }).catch(() => {})
  }
  if (config.protocol && config.protocol.trim()) {
    const scheme = config.protocol.trim().replace(/:\/\//, '')
    if (!app.isDefaultProtocolClient(scheme)) {
      app.setAsDefaultProtocolClient(scheme)
    }
  }
  setupAdBlocking()
  setupCSP()
  checkUpdates()
  registerCustomShortcuts()
  createWindow()
  setupTray()
})

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('window-all-closed', () => {
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

