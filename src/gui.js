'use strict'

const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
const fs = require('fs-extra')
const { exec } = require('child_process')
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
    sendLog('🔍 Initializing app generation workspace...')
    const result = await generateApp(config)
    sendLog(`📂 Project directory prepared: ${result.dir}`)
    sendLog('🎨 Assets and configuration files written.')
    sendLog('📦 Generated files manifest and package settings.')
    sendLog('✅ Generation complete!')
    return { success: true, dir: result.dir }
  } catch (err) {
    sendLog(`❌ Error: ${err.message}`)
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

  sendLog('🚀 Preparing app runtime environment...')
  
  // Check if node_modules exists
  const hasNodeModules = fs.existsSync(path.join(dir, 'node_modules'))
  
  if (!hasNodeModules) {
    sendLog('📥 Installing package dependencies (npm install)...')
    const child = exec('npm install', { cwd: dir })
    
    child.stdout.on('data', (data) => sendLog(data.toString().trim()))
    child.stderr.on('data', (data) => sendLog(data.toString().trim()))
    
    child.on('close', (code) => {
      if (code === 0) {
        sendLog('📦 Dependencies installed successfully!')
        sendLog('🏃 Starting application...')
        exec('npm start', { cwd: dir })
      } else {
        sendLog(`❌ Dependency installation failed (exit code ${code}).`)
      }
    })
  } else {
    sendLog('🏃 Starting application...')
    exec('npm start', { cwd: dir })
  }
})
