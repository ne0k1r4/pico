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
    url: 'https://example.com',
    width: 1280,
    height: 800,
    windowStyle: 'minimal',
    showToolbar: true,
    systemTray: true,
    alwaysOnTop: false,
    rememberSize: true,
    darkMode: true,
    blockAds: true,
    customCSS: 'body { color: red; }\nmain { display: block; }',
    platforms: ['linux', 'win']
  })

  const packageJson = JSON.parse(await fs.readFile(path.join(result.dir, 'package.json'), 'utf8'))
  assert.equal(packageJson.name, 'example-app')
  assert.equal(packageJson.main, 'main.js')
  assert.equal(packageJson.build.productName, 'Example App')
  assert.equal(packageJson.build.linux.category, 'Network')
  assert.equal(packageJson.build.win.target[0].target, 'nsis')
  assert.equal(packageJson.build.mac, undefined)

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
