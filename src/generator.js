const fs = require('fs-extra')
const path = require('path')
const zlib = require('zlib')

const TEMPLATE_DIR = path.join(__dirname, '../template')

// Keep generated projects on the same well-tested desktop toolchain as Pico.
const GENERATED_RUNTIME = Object.freeze({
  electron: '^43.4.0',
  electronBuilder: '^26.15.3'
})

const GENERATED_ANDROID_RUNTIME = Object.freeze({
  core: '^8.5.0',
  android: '^8.5.0',
  cli: '^8.5.0'
})

const DESKTOP_PLATFORMS = new Set(['win', 'mac', 'linux'])
const SUPPORTED_PLATFORMS = new Set([...DESKTOP_PLATFORMS, 'android'])

const AD_DOMAINS = [
  'doubleclick.net', 'googlesyndication.com', 'googletagmanager.com',
  'facebook.net', 'connect.facebook.net', 'amazon-adsystem.com',
  'ads.twitter.com', 'static.ads-twitter.com', 'outbrain.com',
  'taboola.com', 'adnxs.com', 'rubiconproject.com', 'pubmatic.com',
  'moatads.com', 'scorecardresearch.com', 'quantserve.com'
]

const FALLBACK_PALETTE = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444']

async function generateApp(config) {
  const platforms = normalizePlatforms(config.platforms)
  const resolvedConfig = { ...config, platforms }
  const slug = slugify(resolvedConfig.name)
  const outDir = path.resolve(config.outputDir, slug)

  await fs.ensureDir(outDir)
  if (platforms.some(platform => DESKTOP_PLATFORMS.has(platform))) {
    await fs.copy(TEMPLATE_DIR, outDir, { overwrite: true })
  }

  const appConfig = buildConfig(resolvedConfig)
  await fs.writeJson(path.join(outDir, 'app-config.json'), appConfig, { spaces: 2 })

  if (resolvedConfig.faviconPath && await fs.pathExists(resolvedConfig.faviconPath)) {
    await fs.copy(resolvedConfig.faviconPath, path.join(outDir, 'icon.png'))
  } else {
    await makeFallbackIcon(outDir, resolvedConfig.name)
  }

  const pkg = buildPackageJson(slug, resolvedConfig)
  await fs.writeJson(path.join(outDir, 'package.json'), pkg, { spaces: 2 })

  if (platforms.includes('android')) {
    await writeAndroidProjectFiles(outDir, slug, resolvedConfig)
  }

  if (resolvedConfig.blockAds) {
    await fs.writeJson(
      path.join(outDir, 'blocked-domains.json'),
      AD_DOMAINS,
      { spaces: 2 }
    )
  }

  return { dir: outDir, slug }
}

function buildConfig(config) {
  const appConfig = {
    name: config.name,
    url: config.url,
    width: config.width || 1280,
    height: config.height || 800,
    windowStyle: config.windowStyle || 'normal',
    showToolbar: config.showToolbar !== false,
    systemTray: !!config.systemTray,
    alwaysOnTop: !!config.alwaysOnTop,
    rememberSize: config.rememberSize !== false,
    darkMode: !!config.darkMode,
    blockAds: !!config.blockAds,
    hardenMode: !!config.hardenMode,
    customCSS: config.injectCSS ? (config.customCSS || '').replace(/\\n/g, '\n') : '',
    customJS: config.injectJS ? (config.customJS || '').replace(/\\n/g, '\n') : '',
    userAgent: config.userAgent || '',
    protocol: config.protocol || '',
    autoUpdate: !!config.autoUpdate,
    updateUrl: config.updateUrl || '',
    shortcuts: config.shortcuts || {},
    proxy: config.proxy || '',
    platforms: config.platforms || ['linux']
  }

  if (config.platforms.includes('android')) {
    appConfig.android = {
      appId: buildAndroidAppId(slugify(config.name)),
      buildCommand: 'npm run android:apk:debug'
    }
  }

  return appConfig
}

function buildPackageJson(slug, config) {
  const platforms = config.platforms
  const hasDesktopTarget = platforms.some(platform => DESKTOP_PLATFORMS.has(platform))
  const hasAndroidTarget = platforms.includes('android')
  const targets = {}

  if (platforms.includes('win')) {
    targets.win = {
      target: [{ target: 'nsis', arch: ['x64'] }],
      icon: 'icon.png'
    }
  }
  if (platforms.includes('mac')) {
    targets.mac = {
      target: [{ target: 'dmg', arch: ['x64', 'arm64'] }],
      icon: 'icon.png'
    }
  }
  if (platforms.includes('linux')) {
    targets.linux = {
      target: ['AppImage', 'deb'],
      icon: 'icon.png',
      category: 'Network'
    }
  }

  const pkg = {
    name: slug,
    version: '1.0.0',
    description: `wrapped: ${config.url}`,
    engines: {
      node: '>=22'
    }
  }

  if (hasDesktopTarget) {
    pkg.main = 'main.js'
    pkg.scripts = {
      start: 'electron .',
      build: 'electron-builder',
      'build:desktop': 'electron-builder --' + currentPlatformFlag()
    }
    pkg.devDependencies = {
      electron: GENERATED_RUNTIME.electron,
      'electron-builder': GENERATED_RUNTIME.electronBuilder
    }
    pkg.build = {
      appId: `io.pico.${slug}`,
      productName: config.name,
      directories: { output: 'dist' },
      files: ['*.js', '*.html', '*.json', 'icon.*', '!node_modules/**'],
      ...targets
    }
  }

  if (hasAndroidTarget) {
    pkg.scripts = {
      ...pkg.scripts,
      'android:add': 'cap add android',
      'android:sync': 'cap sync android',
      'android:apk:debug': 'npm run android:sync && cd android && ./gradlew assembleDebug',
      'android:apk': 'npm run android:sync && cap build android --androidreleasetype APK'
    }
    pkg.dependencies = {
      '@capacitor/android': GENERATED_ANDROID_RUNTIME.android,
      '@capacitor/core': GENERATED_ANDROID_RUNTIME.core
    }
    pkg.devDependencies = {
      ...pkg.devDependencies,
      '@capacitor/cli': GENERATED_ANDROID_RUNTIME.cli
    }
  }

  pkg.scripts['build:this'] = hasDesktopTarget && hasAndroidTarget
    ? 'npm run build:desktop && npm run android:apk'
    : hasAndroidTarget
      ? 'npm run android:apk'
      : 'npm run build:desktop'

  return pkg
}

async function writeAndroidProjectFiles(outDir, slug, config) {
  const allowedHosts = getAndroidAllowedHosts(config.url)
  const androidConfig = {
    appId: buildAndroidAppId(slug),
    appName: config.name,
    webDir: 'www',
    server: { allowNavigation: allowedHosts }
  }
  const webDir = path.join(outDir, 'www')

  // The local page keeps Capacitor's native bridge available before it opens the chosen website.
  const launcherHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(config.name)}</title>
  </head>
  <body>
    <p>Opening ${escapeHtml(config.name)}…</p>
    <script>
      window.location.replace(${JSON.stringify(config.url)})
    </script>
  </body>
</html>
`

  const androidReadme = `# Android APK build\n\nThis Pico project uses Capacitor to package ${config.url} in an Android WebView.\n\n## Build a debug APK\n\n1. Install Node.js 22+, Android Studio, and the Android SDK.\n2. Run \`npm install\`.\n3. Run \`npm run android:add\` once to create the native Android project.\n4. Run \`npm run android:apk:debug\`.\n\nThe debug APK is created at \`android/app/build/outputs/apk/debug/app-debug.apk\`. For a signed release APK, configure a keystore and run \`npm run android:apk\`.\n\nDesktop-only features such as the Electron toolbar, system tray, request blocking, and renderer injection are not applied to the Android WebView.\n`

  await fs.ensureDir(webDir)
  await Promise.all([
    fs.writeJson(path.join(outDir, 'capacitor.config.json'), androidConfig, { spaces: 2 }),
    fs.writeFile(path.join(webDir, 'index.html'), launcherHtml),
    fs.writeFile(path.join(outDir, 'ANDROID.md'), androidReadme)
  ])
}

function getAndroidAllowedHosts(url) {
  try {
    return [new URL(url).hostname]
  } catch {
    return []
  }
}

function buildAndroidAppId(slug) {
  return `io.pico.${slug.replace(/-/g, '') || 'app'}`
}

function normalizePlatforms(platforms) {
  const requested = Array.isArray(platforms) ? platforms : ['linux']
  const uniquePlatforms = [...new Set(requested)]
  const unsupported = uniquePlatforms.filter(platform => !SUPPORTED_PLATFORMS.has(platform))

  if (unsupported.length) {
    throw new Error(`Unsupported platform target: ${unsupported.join(', ')}`)
  }
  if (!uniquePlatforms.length) {
    throw new Error('Choose at least one platform target')
  }

  return uniquePlatforms
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function currentPlatformFlag() {
  if (process.platform === 'win32') return 'win'
  if (process.platform === 'darwin') return 'mac'
  return 'linux'
}

async function makeFallbackIcon(outDir, name) {
  const letter = (name.trim()[0] || 'A').toUpperCase()
  const colors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444']
  const color  = colors[letter.charCodeAt(0) % colors.length]
  const dark   = color + 'aa'

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${color}"/>
      <stop offset="100%" stop-color="${dark}"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#g)"/>
  <text x="256" y="355" text-anchor="middle"
    font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
    font-size="290" font-weight="800" fill="rgba(255,255,255,0.92)">${letter}</text>
</svg>`

  await fs.writeFile(path.join(outDir, 'icon.svg'), svg)
  await fs.writeFile(path.join(outDir, 'icon.png'), createFallbackPng(color, 512))
}

function createFallbackPng(hexColor, size) {
  const start = hexToRgb(hexColor)
  const end = {
    r: Math.max(0, start.r - 42),
    g: Math.max(0, start.g - 42),
    b: Math.max(0, start.b - 42)
  }
  const stride = size * 4 + 1
  const raw = Buffer.alloc(stride * size)

  for (let y = 0; y < size; y++) {
    const row = y * stride
    raw[row] = 0
    for (let x = 0; x < size; x++) {
      const t = (x + y) / (2 * (size - 1))
      const offset = row + 1 + x * 4
      raw[offset] = Math.round(start.r + (end.r - start.r) * t)
      raw[offset + 1] = Math.round(start.g + (end.g - start.g) * t)
      raw[offset + 2] = Math.round(start.b + (end.b - start.b) * t)
      raw[offset + 3] = 255
    }
  }

  const header = Buffer.from('89504e470d0a1a0a', 'hex')
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  return Buffer.concat([
    header,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0))
  ])
}

function hexToRgb(hex) {
  const value = hex.replace('#', '')
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16)
  }
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type)
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0)
  return Buffer.concat([length, typeBuffer, data, crc])
}

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function slugify(name) {
  return (name || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'my-app'
}

module.exports = { generateApp }
