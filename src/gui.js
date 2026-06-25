'use strict'

const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
const fs = require('fs-extra')
const { exec, spawn } = require('child_process')
const { generateApp } = require('./generator')
const { validateUrl, fetchFavicon } = require('./utils')

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 720,
    minWidth: 800,
    minHeight: 650,
    title: 'Pico — Turn any website into a desktop app',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'gui-preload.js')
    },
    autoHideMenuBar: true
  })

  mainWindow.loadFile(path.join(__dirname, 'gui.html'))
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// IPC Handlers
ipcMain.handle('validate-url', async (event, url) => {
  return await validateUrl(url).catch(() => false)
})

ipcMain.handle('fetch-favicon', async (event, { url, name }) => {
  try {
    const tempDir = path.join(app.getPath('temp'), 'pico-favicons')
    await fs.ensureDir(tempDir)
    return await fetchFavicon(url, tempDir, name)
  } catch (err) {
    return null
  }
})

ipcMain.handle('generate-app', async (event, config) => {
  const sendLog = (text) => {
    if (mainWindow) {
      mainWindow.webContents.send('log', text)
    }
  }

  try {
    sendLog('Initializing app generation workspace...')
    const result = await generateApp(config)
    sendLog(`Project directory prepared: ${result.dir}`)
    sendLog('Assets and configuration files written.')
    sendLog('Generated files manifest and package settings.')
    sendLog('Generation complete!')
    return { success: true, dir: result.dir }
  } catch (err) {
    sendLog(`Error: ${err.message}`)
    return { success: false, error: err.message }
  }
})

ipcMain.handle('open-folder', async (event, dir) => {
  await shell.openPath(dir)
})

ipcMain.handle('run-app', (event, dir) => {
  const sendLog = (text) => {
    if (mainWindow) {
      mainWindow.webContents.send('log', text)
    }
  }

  sendLog('Preparing app runtime environment...')

  const hasNodeModules = fs.existsSync(path.join(dir, 'node_modules'))

  function launchApp() {
    sendLog('Launching app...')

    // require('electron') inside the generated app dir returns the path to the real native binary
    // we can't use require() directly from here (wrong cwd), so resolve the path manually
    let electronExe = null
    try {
      const electronPkg = path.join(dir, 'node_modules', 'electron')
      electronExe = require(path.join(electronPkg, 'index.js'))
    } catch (e) {
      // fallback: try the dist binary directly
      const fallback = path.join(dir, 'node_modules', 'electron', 'dist', 'electron')
      if (fs.existsSync(fallback)) electronExe = fallback
    }

    if (!electronExe) {
      sendLog('Could not find electron binary. Run: cd ' + dir + ' && npm start')
      return
    }

    const child = spawn(electronExe, ['.'], {
      cwd: dir,
      detached: true,
      stdio: 'ignore'
    })

    child.unref() // let it run independently of pico GUI

    child.on('error', (err) => {
      sendLog(`Launch error: ${err.message}`)
    })

    sendLog('App launched. Window should appear shortly.')
  }

  if (!hasNodeModules) {
    sendLog('Installing dependencies (npm install)...')
    const install = spawn('npm', ['install'], { cwd: dir, shell: true })

    install.stdout.on('data', (d) => sendLog(d.toString().trim()))
    install.stderr.on('data', (d) => sendLog(d.toString().trim()))

    install.on('close', (code) => {
      if (code === 0) {
        sendLog('Dependencies installed.')
        launchApp()
      } else {
        sendLog(`npm install failed (exit ${code}). Try running it manually in the app folder.`)
      }
    })
  } else {
    launchApp()
  }
})
