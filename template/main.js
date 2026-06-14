'use strict'

const {
  app, BrowserWindow, Menu, shell,
  ipcMain, Tray, nativeImage, screen
} = require('electron')
const path = require('path')
const fs = require('fs')

const config = require('./app-config.json')

// where we stash window size/position between sessions
const STATE_FILE = path.join(app.getPath('userData'), 'window-state.json')

let mainWindow = null
let tray = null

// ─── window state ────────────────────────────────────────────────────────────

function loadWindowState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
  } catch {
    return {}
  }
}

function saveWindowState(win) {
  if (!win || win.isMinimized() || win.isMaximized()) return
  const bounds = win.getBounds()
  fs.writeFileSync(STATE_FILE, JSON.stringify(bounds))
}

// ─── create window ───────────────────────────────────────────────────────────

function createWindow() {
  const saved = config.rememberSize ? loadWindowState() : {}

  // make sure the saved position is still on a visible screen
  const displays = screen.getAllDisplays()
  let x = saved.x, y = saved.y
  if (x !== undefined && y !== undefined) {
    const onScreen = displays.some(d =>
      x >= d.bounds.x && x < d.bounds.x + d.bounds.width &&
      y >= d.bounds.y && y < d.bounds.y + d.bounds.height
    )
    if (!onScreen) { x = undefined; y = undefined }
  }

  const isFrameless = config.windowStyle === 'frameless'

  mainWindow = new BrowserWindow({
    width: saved.width || config.width,
    height: saved.height || config.height,
    x, y,
    minWidth: 320,
    minHeight: 240,
    title: config.name,
    frame: !isFrameless,
    titleBarStyle: isFrameless ? 'hidden' : 'default',
    alwaysOnTop: !!config.alwaysOnTop,
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: '#ffffff',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  mainWindow.loadFile(path.join(__dirname, 'app.html'))

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    if (saved.maximized) mainWindow.maximize()
  })

  // remember size on close
  mainWindow.on('close', (e) => {
    if (config.systemTray && !app.isQuiting) {
      e.preventDefault()
      mainWindow.hide()
      return
    }
    if (config.rememberSize) saveWindowState(mainWindow)
  })

  mainWindow.on('closed', () => { mainWindow = null })

  // open external links in the default browser, not a new electron window
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url !== config.url && !url.startsWith(new URL(config.url).origin)) {
      shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })

  buildMenu()
}

// ─── system tray ─────────────────────────────────────────────────────────────

function createTray() {
  if (!config.systemTray) return

  const iconPath = path.join(__dirname, 'icon.png')
  const img = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  tray = new Tray(img)
  tray.setToolTip(config.name)

  const menu = Menu.buildFromTemplate([
    { label: `Open ${config.name}`, click: () => { mainWindow?.show() } },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuiting = true; app.quit() } }
  ])
  tray.setContextMenu(menu)
  tray.on('click', () => {
    if (mainWindow?.isVisible()) mainWindow.hide()
    else mainWindow?.show()
  })
}

// ─── menu ─────────────────────────────────────────────────────────────────────

function buildMenu() {
  const isMac = process.platform === 'darwin'

  const template = [
    ...(isMac ? [{ label: app.name, submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { type: 'separator' }, { role: 'quit' }] }] : []),
    {
      label: 'File',
      submenu: [isMac ? { role: 'close' } : { role: 'quit' }]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Back',
          accelerator: 'Alt+Left',
          click: () => mainWindow?.webContents.send('navigate', 'back')
        },
        {
          label: 'Forward',
          accelerator: 'Alt+Right',
          click: () => mainWindow?.webContents.send('navigate', 'forward')
        },
        {
          label: 'Home',
          accelerator: 'CmdOrCtrl+H',
          click: () => mainWindow?.webContents.send('navigate', 'home')
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'resetZoom' },
        { type: 'separator' },
        { role: 'toggleDevTools' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Open in Browser',
          click: () => shell.openExternal(config.url)
        }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ─── IPC ─────────────────────────────────────────────────────────────────────

ipcMain.handle('get-config', () => config)

ipcMain.on('open-external', (_, url) => {
  shell.openExternal(url)
})

// ─── app lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow()
  createTray()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
  else mainWindow?.show()
})

app.on('before-quit', () => {
  app.isQuiting = true
  if (config.rememberSize && mainWindow) saveWindowState(mainWindow)
})

// v1.1 — tray: added after someone asked for it in issues
// keeping this separate so it's easy to rip out if needed
