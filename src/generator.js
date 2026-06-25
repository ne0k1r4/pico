const fs = require('fs-extra')
const path = require('path')
const zlib = require('zlib')

const TEMPLATE_DIR = path.join(__dirname, '../template')

const AD_DOMAINS = [
  'doubleclick.net', 'googlesyndication.com', 'googletagmanager.com',
  'facebook.net', 'connect.facebook.net', 'amazon-adsystem.com',
  'ads.twitter.com', 'static.ads-twitter.com', 'outbrain.com',
  'taboola.com', 'adnxs.com', 'rubiconproject.com', 'pubmatic.com',
  'moatads.com', 'scorecardresearch.com', 'quantserve.com'
]

async function generateApp(config) {
  const slug = slugify(config.name)
  const outDir = path.resolve(config.outputDir, slug)

  await fs.ensureDir(outDir)
  await fs.copy(TEMPLATE_DIR, outDir, { overwrite: true })

  const appConfig = buildConfig(config)
  await fs.writeJson(path.join(outDir, 'app-config.json'), appConfig, { spaces: 2 })

  if (config.faviconPath && await fs.pathExists(config.faviconPath)) {
    await fs.copy(config.faviconPath, path.join(outDir, 'icon.png'))
  } else {
    await makeFallbackIcon(outDir, config.name)
  }

  const pkg = buildPackageJson(slug, config)
  await fs.writeJson(path.join(outDir, 'package.json'), pkg, { spaces: 2 })

  if (config.blockAds) {
    await fs.writeJson(
      path.join(outDir, 'blocked-domains.json'),
      AD_DOMAINS,
      { spaces: 2 }
    )
  }

  return { dir: outDir, slug }
}

function buildConfig(config) {
  return {
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
    customCSS: config.injectCSS ? (config.customCSS || '').replace(/\\n/g, '\n') : '',
    platforms: config.platforms || ['linux']
  }
}

function buildPackageJson(slug, config) {
  const platforms = config.platforms || ['linux']
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

  return {
    name: slug,
    version: '1.0.0',
    description: `wrapped: ${config.url}`,
    main: 'main.js',
    scripts: {
      start: 'electron .',
      build: 'electron-builder',
      'build:this': 'electron-builder --' + currentPlatformFlag()
    },
    devDependencies: {
      'electron': '^28.0.0',
      'electron-builder': '^24.9.1'
    },
    build: {
      appId: `io.pico.${slug}`,
      productName: config.name,
      directories: { output: 'dist' },
      files: ['*.js', '*.html', '*.json', 'icon.*', '!node_modules/**'],
      ...targets
    }
  }
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
  return name.trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    || 'my-app'
}

module.exports = { generateApp }
