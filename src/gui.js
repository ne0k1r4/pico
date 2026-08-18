'use strict'

const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
const fs = require('fs-extra')
const { spawn } = require('child_process')
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

  let platforms = []
  try {
    platforms = JSON.parse(fs.readFileSync(path.join(dir, 'app-config.json'), 'utf8')).platforms || []
  } catch {
    sendLog('Could not read project target settings.')
    return
  }

  if (!platforms.some(platform => ['win', 'mac', 'linux'].includes(platform))) {
    sendLog('Android projects run through an Android emulator or device. Use Compile Native Installer to create the APK.')
    return
  }

  function launchApp() {
    sendLog('Launching app...')

    let electronExe = null
    try {
      const electronPkg = path.join(dir, 'node_modules', 'electron')
      electronExe = require(path.join(electronPkg, 'index.js'))
    } catch (e) {
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

    child.unref()

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

ipcMain.handle('build-app', async (event, dir) => {
  const sendLog = (text) => {
    if (mainWindow) {
      mainWindow.webContents.send('log', text)
    }
  }

  sendLog('Starting distribution build process...')

  const hasNodeModules = fs.existsSync(path.join(dir, 'node_modules'))

  function compileInstaller() {
    const startBuild = () => {
      sendLog('Compiling the selected platform target...')
      const build = spawn('npm', ['run', 'build:this'], { cwd: dir, shell: true })

      build.stdout.on('data', (d) => sendLog(d.toString().trim()))
      build.stderr.on('data', (d) => sendLog(d.toString().trim()))

      build.on('close', (code) => {
        if (code === 0) {
          sendLog('Compilation succeeded! Check the generated project output folders for the package.')
        } else {
          sendLog(`Package compilation failed (exit code ${code}).`)
        }
      })
    }

    let platforms = []
    try {
      platforms = JSON.parse(fs.readFileSync(path.join(dir, 'app-config.json'), 'utf8')).platforms || []
    } catch {
      sendLog('Could not read project target settings. Continuing with the package command.')
    }

    // Capacitor creates the native project once; repeat builds reuse that Android directory.
    if (platforms.includes('android') && !fs.existsSync(path.join(dir, 'android'))) {
      sendLog('Preparing the native Android project...')
      const setup = spawn('npm', ['run', 'android:add'], { cwd: dir, shell: true })

      setup.stdout.on('data', (d) => sendLog(d.toString().trim()))
      setup.stderr.on('data', (d) => sendLog(d.toString().trim()))
      setup.on('close', (code) => {
        if (code === 0) startBuild()
        else sendLog(`Android project preparation failed (exit code ${code}).`)
      })
      return
    }

    startBuild()
  }

  if (!hasNodeModules) {
    sendLog('Installing app dependencies first (npm install)...')
    const install = spawn('npm', ['install'], { cwd: dir, shell: true })

    install.stdout.on('data', (d) => sendLog(d.toString().trim()))
    install.stderr.on('data', (d) => sendLog(d.toString().trim()))

    install.on('close', (code) => {
      if (code === 0) {
        sendLog('Dependencies installed successfully.')
        compileInstaller()
      } else {
        sendLog(`npm install failed (exit code ${code}). Try manual build.`)
      }
    })
  } else {
    compileInstaller()
  }
})
