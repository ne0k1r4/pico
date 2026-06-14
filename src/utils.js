'use strict'

const fs = require('fs-extra')
const path = require('path')
const https = require('https')
const http = require('http')
const { URL } = require('url')

/**
 * Quick reachability check — just a HEAD request, 5s timeout.
 * Returns true if we get any response (even 4xx, site is up).
 */
async function validateUrl(rawUrl) {
  try {
    const url = new URL(rawUrl)
    return await new Promise(resolve => {
      const mod = url.protocol === 'https:' ? https : http
      const req = mod.request(
        { method: 'HEAD', hostname: url.hostname, path: url.pathname || '/', timeout: 5000 },
        res => resolve(res.statusCode < 600)
      )
      req.on('error', () => resolve(false))
      req.on('timeout', () => { req.destroy(); resolve(false) })
      req.end()
    })
  } catch {
    return false
  }
}

/**
 * Tries a few common favicon locations and saves the first one it finds.
 * Not perfect but works for most sites. Returns the saved file path or null.
 */
async function fetchFavicon(siteUrl, outputDir, appName) {
  const base = new URL(siteUrl)

  // try these in order
  const candidates = [
    `${base.origin}/favicon.ico`,
    `${base.origin}/favicon.png`,
    `${base.origin}/apple-touch-icon.png`,
    `${base.origin}/apple-touch-icon-precomposed.png`,
    `https://www.google.com/s2/favicons?domain=${base.hostname}&sz=128`
  ]

  const slug = appName.trim().replace(/\s+/g, '-').toLowerCase()
  const tmpDir = path.join(outputDir, '.favicon-cache')
  await fs.ensureDir(tmpDir)
  const savePath = path.join(tmpDir, `${slug}-icon.png`)

  for (const candidate of candidates) {
    try {
      const ok = await downloadFile(candidate, savePath)
      if (ok) return savePath
    } catch {
      continue
    }
  }
  return null
}

function downloadFile(url, dest) {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : http
    const req = mod.get(url, { timeout: 5000 }, res => {
      if (res.statusCode !== 200) return resolve(false)
      const type = res.headers['content-type'] || ''
      if (!type.includes('image') && !type.includes('octet')) return resolve(false)

      const out = require('fs').createWriteStream(dest)
      res.pipe(out)
      out.on('finish', () => resolve(true))
      out.on('error', () => resolve(false))
    })
    req.on('error', () => resolve(false))
    req.on('timeout', () => { req.destroy(); resolve(false) })
  })
}

module.exports = { validateUrl, fetchFavicon }
