// TODO: add a --update flag that regenerates an existing app without overwriting app-config.json
// TODO: support custom electron version per project
// TODO: maybe cache the template copy step? copying everytime feels wasteful

const fs = require('fs-extra')
const path = require('path')

const TEMPLATE_DIR = path.join(__dirname, '../template')

// list of sketchy ad/tracker domains to block
// not exhaustive but covers the most annoying ones
// TODO: pull this from a proper blocklist file instead of hardcoding
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

  // blow away and recreate — easier than trying to merge
  await fs.ensureDir(outDir)
  await fs.copy(TEMPLATE_DIR, outDir, { overwrite: true })

  const appConfig = buildConfig(config)
  await fs.writeJson(path.join(outDir, 'app-config.json'), appConfig, { spaces: 2 })

  // icon handling — use fetched one, otherwise make a placeholder
  if (config.faviconPath && await fs.pathExists(config.faviconPath)) {
    await fs.copy(config.faviconPath, path.join(outDir, 'icon.png'))
  } else {
    // generates a colored svg + stub png
    // TODO: auto-convert svg to real png using sharp or jimp if available
    await makeFallbackIcon(outDir, config.name)
  }

  const pkg = buildPackageJson(slug, config)
  await fs.writeJson(path.join(outDir, 'package.json'), pkg, { spaces: 2 })

  // write the blocklist if they asked for it
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
    // if they gave us css, use it. otherwise empty string = no injection
    customCSS: config.injectCSS ? (config.customCSS || '').replace(/\\n/g, '\n') : '',
    platforms: config.platforms || ['linux']
  }
}

function buildPackageJson(slug, config) {
  // only add platforms they actually selected
  const targets = {}

  if (config.platforms.includes('win')) {
    targets.win = {
      target: [{ target: 'nsis', arch: ['x64'] }],
      icon: 'icon.png'
    }
  }
  if (config.platforms.includes('mac')) {
    // arm64 for m-series macs + x64 for intel
    targets.mac = {
      target: [{ target: 'dmg', arch: ['x64', 'arm64'] }],
      icon: 'icon.png'
    }
  }
  if (config.platforms.includes('linux')) {
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
      // convenience — build just for current platform
      'build:this': 'electron-builder --' + currentPlatformFlag()
    },
    devDependencies: {
      'electron': '^28.0.0',
      'electron-builder': '^24.9.1'
    },
    build: {
      appId: `io.web2app.${slug}`,
      productName: config.name,
      directories: { output: 'dist' },
      // don't bundle node_modules into the app — electron doesn't need them
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

  // decent enough — gradient square with rounded corners and the first letter
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

  // stub png — electron-builder won't start without icon.png
  // real users should drop in a proper 512x512 before distributing
  // TODO: auto-rasterize svg → png if sharp is installed globally
  const stubPng = Buffer.from(
    '89504e470d0a1a0a0000000d4948445200000001000000010802' +
    '0000009001' + '2e0000000c49444154789c626000000000020001e221bc33' +
    '0000000049454e44ae426082', 'hex'
  )
  await fs.writeFile(path.join(outDir, 'icon.png'), stubPng)
}

function slugify(name) {
  return name.trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')  // collapse multiple dashes
    || 'my-app'  // fallback if name was all special chars
}

module.exports = { generateApp }
// v2 — added ad blocking
