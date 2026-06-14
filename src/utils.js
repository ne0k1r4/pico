// url validation + favicon fetching
// nothing fancy here, just works for 95% of cases
// TODO: parse html <link rel="icon"> tags for sites that don't have /favicon.ico
// TODO: try manifest.json for PWA icons — those are usually higher res

const fs   = require('fs-extra')
const path = require('path')
const https = require('https')
const http  = require('http')
const { URL } = require('url')

// just checks if the site responds — doesn't care about status code
// even a 404 means the server is alive, which is good enough
async function validateUrl(rawUrl) {
  try {
    const u = new URL(rawUrl)
    return await new Promise(resolve => {
      const lib = u.protocol === 'https:' ? https : http
      const req = lib.request(
        { method: 'HEAD', hostname: u.hostname, path: u.pathname || '/', timeout: 6000 },
        res => resolve(res.statusCode < 600)
      )
      req.on('error',   () => resolve(false))
      req.on('timeout', () => { req.destroy(); resolve(false) })
      req.end()
    })
  } catch {
    // bad url format
    return false
  }
}

// tries a bunch of common favicon locations, returns the path if found
// or null if nothing worked (caller should handle that gracefully)
async function fetchFavicon(siteUrl, outputDir, appName) {
  let base
  try {
    base = new URL(siteUrl)
  } catch {
    return null  // invalid url, just skip
  }

  const candidates = [
    `${base.origin}/apple-touch-icon.png`,     // best quality usually
    `${base.origin}/apple-touch-icon-precomposed.png`,
    `${base.origin}/favicon.png`,
    `${base.origin}/favicon.ico`,
    // google's favicon service as last resort — always returns something
    `https://www.google.com/s2/favicons?domain=${base.hostname}&sz=256`
  ]

  const cacheDir  = path.join(outputDir, '.favicon-cache')
  const slug      = appName.trim().toLowerCase().replace(/\s+/g, '-')
  const savePath  = path.join(cacheDir, `${slug}.png`)

  await fs.ensureDir(cacheDir)

  for (const url of candidates) {
    const ok = await tryDownload(url, savePath)
    if (ok) return savePath
    // silent fail — just try next one
  }

  return null
}

// returns true if download succeeded, false otherwise
// no throwing — let the caller decide what to do
function tryDownload(url, dest) {
  return new Promise(resolve => {
    const lib = url.startsWith('https') ? https : http

    const req = lib.get(url, { timeout: 5000 }, res => {
      // redirect? follow it once
      // TODO: proper redirect following (only doing one hop right now)
      if (res.statusCode === 301 || res.statusCode === 302) {
        const loc = res.headers.location
        if (loc) return resolve(tryDownload(loc, dest).catch(() => false))
        return resolve(false)
      }

      if (res.statusCode !== 200) return resolve(false)

      const ct = res.headers['content-type'] || ''
      const isImage = ct.includes('image') || ct.includes('octet-stream') || url.endsWith('.ico') || url.endsWith('.png')
      if (!isImage) return resolve(false)

      const out = fs.createWriteStream(dest)
      res.pipe(out)
      out.on('finish', () => resolve(true))
      out.on('error',  () => resolve(false))
    })

    req.on('error',   () => resolve(false))
    req.on('timeout', () => { req.destroy(); resolve(false) })
  })
}

module.exports = { validateUrl, fetchFavicon }
// fix: now follows one redirect in tryDownload
