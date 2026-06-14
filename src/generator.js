'use strict'

const fs = require('fs-extra')
const path = require('path')

const TEMPLATE_DIR = path.join(__dirname, '../template')

/**
 * Generates the full Electron app project from user config.
 * Returns { dir } with the path to the generated project.
 */
async function generateApp(config) {
  const slug = config.name.trim().replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9-]/g, '')
  const outDir = path.resolve(config.outputDir, slug)

  await fs.ensureDir(outDir)

  // copy base template files over
  await fs.copy(TEMPLATE_DIR, outDir, { overwrite: true })

  // write the config that main.js and app.html will read at runtime
  const appConfig = {
    name: config.name,
    url: config.url,
    width: config.width || 1280,
    height: config.height || 800,
    windowStyle: config.windowStyle || 'normal',
    showToolbar: config.showToolbar !== false,
    systemTray: config.systemTray || false,
    alwaysOnTop: config.alwaysOnTop || false,
    rememberSize: config.rememberSize !== false,
    customCSS: config.injectCSS ? (config.customCSS || '') : '',
    platforms: config.platforms || ['linux']
  }
  await fs.writeJson(path.join(outDir, 'app-config.json'), appConfig, { spaces: 2 })

  // icon — use fetched favicon or generate placeholder svg
  if (config.faviconPath && await fs.pathExists(config.faviconPath)) {
    await fs.copy(config.faviconPath, path.join(outDir, 'icon.png'))
  } else {
    await generateFallbackIcon(outDir, config.name)
  }

  // write the package.json for the generated project
  const pkg = buildPackageJson(slug, config)
  await fs.writeJson(path.join(outDir, 'package.json'), pkg, { spaces: 2 })

  return { dir: outDir, slug }
}

function buildPackageJson(slug, config) {
  const buildTargets = {}
  if (config.platforms.includes('win')) {
    buildTargets.win = { target: [{ target: 'nsis', arch: ['x64'] }], icon: 'icon.png' }
  }
  if (config.platforms.includes('mac')) {
    buildTargets.mac = { target: [{ target: 'dmg', arch: ['x64', 'arm64'] }], icon: 'icon.png' }
  }
  if (config.platforms.includes('linux')) {
    buildTargets.linux = { target: ['AppImage', 'deb'], icon: 'icon.png', category: 'Network' }
  }

  return {
    name: slug,
    version: '1.0.0',
    description: `Desktop wrapper for ${config.url}`,
    main: 'main.js',
    scripts: {
      start: 'electron .',
      build: 'electron-builder'
    },
    devDependencies: {
      electron: '^28.0.0',
      'electron-builder': '^24.9.1'
    },
    build: {
      appId: `io.web2app.${slug}`,
      productName: config.name,
      directories: { output: 'dist' },
      files: ['**/*', '!node_modules/**/*'],
      ...buildTargets
    }
  }
}

async function generateFallbackIcon(outDir, name) {
  const initial = name.trim().charAt(0).toUpperCase()
  // just a small palette — looks decent enough
  const palette = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6']
  const color = palette[initial.charCodeAt(0) % palette.length]

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${color};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${color}cc;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="100" fill="url(#g)"/>
  <text x="256" y="360" font-family="system-ui,-apple-system,sans-serif" font-size="300"
    font-weight="700" fill="rgba(255,255,255,0.95)" text-anchor="middle">${initial}</text>
</svg>`

  await fs.writeFile(path.join(outDir, 'icon.svg'), svg)

  // minimal valid 1×1 PNG stub — electron-builder needs icon.png to exist
  // users should replace with a real 512×512 PNG before distributing
  const stub = Buffer.from(
    '89504e470d0a1a0a0000000d494844520000000100000001' +
    '08020000009001' + '2e0000000c49444154789c6260f8cfc0000000020001' +
    '6221bc330000000049454e44ae426082', 'hex'
  )
  await fs.writeFile(path.join(outDir, 'icon.png'), stub)
}

module.exports = { generateApp }
// generator updated to pass through new config fields
// changed flat icon to gradient — looks nicer in dock/taskbar
