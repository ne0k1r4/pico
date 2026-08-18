const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const { generateApp } = require('../src/generator')

async function tempProjectDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'pico-generator-'))
}

test('generateApp writes a runnable Electron project', async () => {
  const outputDir = await tempProjectDir()

  const result = await generateApp({
    name: 'Example App',
    url: 'https://example.com',
    outputDir,
    windowStyle: 'minimal',
    showToolbar: true,
    systemTray: true,
    alwaysOnTop: false,
    rememberSize: true,
    darkMode: true,
    injectCSS: true,
    customCSS: 'body { color: red; }\\nmain { display: block; }',
    blockAds: true,
    platforms: ['linux', 'win']
  })

  assert.equal(result.slug, 'example-app')
  assert.equal(result.dir, path.join(outputDir, 'example-app'))

  const appConfig = JSON.parse(await fs.readFile(path.join(result.dir, 'app-config.json'), 'utf8'))
  assert.deepEqual(appConfig, {
    name: 'Example App',
    url: 'https://example.com/',
    width: 1280,
    height: 800,
    windowStyle: 'minimal',
    showToolbar: true,
    systemTray: true,
    alwaysOnTop: false,
    rememberSize: true,
    darkMode: true,
    blockAds: true,
    hardenMode: false,
    customCSS: 'body { color: red; }\nmain { display: block; }',
    customJS: '',
    userAgent: '',
    protocol: '',
    autoUpdate: false,
    updateUrl: '',
    shortcuts: {},
    proxy: '',
    platforms: ['linux', 'win']
  })

  const packageJson = JSON.parse(await fs.readFile(path.join(result.dir, 'package.json'), 'utf8'))
  assert.equal(packageJson.name, 'example-app')
  assert.equal(packageJson.main, 'main.js')
  assert.equal(packageJson.build.productName, 'Example App')
  assert.equal(packageJson.build.linux.category, 'Network')
  assert.equal(packageJson.build.win.target[0].target, 'nsis')
  assert.equal(packageJson.build.mac, undefined)
  assert.equal(packageJson.engines.node, '>=22')
  assert.equal(packageJson.devDependencies.electron, '^43.4.0')
  assert.equal(packageJson.devDependencies['electron-builder'], '^26.15.3')

  const blockedDomains = JSON.parse(await fs.readFile(path.join(result.dir, 'blocked-domains.json'), 'utf8'))
  assert.ok(blockedDomains.includes('doubleclick.net'))

  await assert.doesNotReject(fs.access(path.join(result.dir, 'main.js')))
  await assert.doesNotReject(fs.access(path.join(result.dir, 'preload.js')))
  await assert.doesNotReject(fs.access(path.join(result.dir, 'app.html')))
})

test('generateApp creates a full-size PNG fallback icon', async () => {
  const outputDir = await tempProjectDir()

  const result = await generateApp({
    name: 'Icon Test',
    url: 'https://example.com',
    outputDir,
    platforms: ['linux']
  })

  const icon = await fs.readFile(path.join(result.dir, 'icon.png'))
  assert.equal(icon.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
  assert.equal(icon.readUInt32BE(16), 512)
  assert.equal(icon.readUInt32BE(20), 512)
  assert.ok(icon.length > 1000)
})

test('generateApp copies a provided favicon', async () => {
  const outputDir = await tempProjectDir()
  const faviconPath = path.join(outputDir, 'favicon.png')
  const favicon = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex')
  await fs.writeFile(faviconPath, favicon)

  const result = await generateApp({
    name: 'Favicon App',
    url: 'https://example.com',
    outputDir,
    faviconPath,
    platforms: ['linux']
  })

  const copied = await fs.readFile(path.join(result.dir, 'icon.png'))
  assert.deepEqual(copied, favicon)
})

test('generateApp defaults to a Linux build target', async () => {
  const outputDir = await tempProjectDir()

  const result = await generateApp({
    name: 'Default Platform',
    url: 'https://example.com',
    outputDir
  })

  const appConfig = JSON.parse(await fs.readFile(path.join(result.dir, 'app-config.json'), 'utf8'))
  const packageJson = JSON.parse(await fs.readFile(path.join(result.dir, 'package.json'), 'utf8'))

  assert.deepEqual(appConfig.platforms, ['linux'])
  assert.deepEqual(packageJson.build.linux.target, ['AppImage', 'deb'])
  assert.equal(packageJson.build.win, undefined)
  assert.equal(packageJson.build.mac, undefined)
})

test('generateApp incorporates custom protocol scheme option', async () => {
  const outputDir = await tempProjectDir()

  const result = await generateApp({
    name: 'Protocol Test',
    url: 'https://example.com',
    protocol: 'mycustomscheme',
    outputDir
  })

  const appConfig = JSON.parse(await fs.readFile(path.join(result.dir, 'app-config.json'), 'utf8'))
  assert.equal(appConfig.protocol, 'mycustomscheme')
})

test('generateApp creates a Capacitor project that can build an Android APK', async () => {
  const outputDir = await tempProjectDir()

  const result = await generateApp({
    name: 'Android Companion',
    url: 'https://app.example.com/dashboard',
    outputDir,
    platforms: ['android']
  })

  const packageJson = JSON.parse(await fs.readFile(path.join(result.dir, 'package.json'), 'utf8'))
  const appConfig = JSON.parse(await fs.readFile(path.join(result.dir, 'app-config.json'), 'utf8'))
  const capacitorConfig = JSON.parse(await fs.readFile(path.join(result.dir, 'capacitor.config.json'), 'utf8'))
  const launcherHtml = await fs.readFile(path.join(result.dir, 'www', 'index.html'), 'utf8')

  assert.deepEqual(appConfig.platforms, ['android'])
  assert.equal(appConfig.android.appId, 'io.pico.appandroidcompanion')
  assert.equal(packageJson.dependencies['@capacitor/core'], '^8.5.0')
  assert.equal(packageJson.dependencies['@capacitor/android'], '^8.5.0')
  assert.equal(packageJson.devDependencies['@capacitor/cli'], '^8.5.0')
  assert.equal(packageJson.scripts['android:add'], 'node scripts/ensure-android.mjs')
  assert.match(packageJson.scripts['android:apk:debug'], /assembleDebug/)
  assert.equal(capacitorConfig.appId, 'io.pico.appandroidcompanion')
  assert.deepEqual(capacitorConfig.server.allowNavigation, ['app.example.com'])
  assert.match(launcherHtml, /https:\/\/app\.example\.com\/dashboard/)
  await assert.doesNotReject(fs.access(path.join(result.dir, 'ANDROID.md')))
  await assert.doesNotReject(fs.access(path.join(result.dir, 'scripts', 'ensure-android.mjs')))
})

test('generateApp rejects invalid website and project input before writing output', async () => {
  const outputDir = await tempProjectDir()

  await assert.rejects(
    generateApp({ name: 'Unsafe App', url: 'file:///etc/passwd', outputDir }),
    /Website URL must use HTTP or HTTPS/
  )
  await assert.rejects(
    generateApp({ name: '', url: 'https://example.com', outputDir }),
    /App name is required/
  )
  await assert.rejects(
    generateApp({ name: 'Bad Dimensions', url: 'https://example.com', outputDir, width: 1.5 }),
    /Window width must be a positive whole number/
  )
})

test('generateApp configures auto-updater settings', async () => {
  const outputDir = await tempProjectDir()

  const result = await generateApp({
    name: 'Updater Test',
    url: 'https://example.com',
    autoUpdate: true,
    updateUrl: 'https://example.com/api/version.json',
    outputDir
  })

  const appConfig = JSON.parse(await fs.readFile(path.join(result.dir, 'app-config.json'), 'utf8'))
  assert.equal(appConfig.autoUpdate, true)
  assert.equal(appConfig.updateUrl, 'https://example.com/api/version.json')
})

test('generateApp supports custom global shortcuts map', async () => {
  const outputDir = await tempProjectDir()

  const result = await generateApp({
    name: 'Shortcuts Test',
    url: 'https://example.com',
    shortcuts: { 'CmdOrCtrl+R': 'reload' },
    outputDir
  })

  const appConfig = JSON.parse(await fs.readFile(path.join(result.dir, 'app-config.json'), 'utf8'))
  assert.deepEqual(appConfig.shortcuts, { 'CmdOrCtrl+R': 'reload' })
})

test('generateApp incorporates network proxy configuration', async () => {
  const outputDir = await tempProjectDir()

  const result = await generateApp({
    name: 'Proxy Test',
    url: 'https://example.com',
    proxy: 'socks5://127.0.0.1:9050',
    outputDir
  })

  const appConfig = JSON.parse(await fs.readFile(path.join(result.dir, 'app-config.json'), 'utf8'))
  assert.equal(appConfig.proxy, 'socks5://127.0.0.1:9050')
})
