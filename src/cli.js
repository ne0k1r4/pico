#!/usr/bin/env node

'use strict'

const inquirer = require('inquirer')
const chalk = require('chalk')
const path = require('path')
const fs = require('fs-extra')
const { generateApp } = require('./generator')
const { validateUrl, fetchFavicon } = require('./utils')

// had to add this because people kept putting bare domains lol
function normalizeUrl(input) {
  let url = input.trim()
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url
  }
  return url
}

async function main() {
  console.log()
  console.log(chalk.bold('  web2app') + chalk.gray(' — wrap any site as a native app'))
  console.log(chalk.gray('  ─────────────────────────────────'))
  console.log()

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'url',
      message: 'Website URL:',
      validate: async (val) => {
        const url = normalizeUrl(val)
        const ok = await validateUrl(url)
        return ok ? true : 'Could not reach that URL — double check it?'
      },
      filter: normalizeUrl
    },
    {
      type: 'input',
      name: 'name',
      message: 'App name:',
      validate: v => v.trim().length >= 1 ? true : 'Give it a name!'
    },
    {
      type: 'input',
      name: 'outputDir',
      message: 'Where to save the project?',
      default: './apps'
    },
    {
      type: 'list',
      name: 'windowStyle',
      message: 'Window style:',
      choices: [
        { name: 'Normal (with title bar)', value: 'normal' },
        { name: 'Frameless (immersive, no title bar)', value: 'frameless' },
        { name: 'Minimal (thin toolbar only)', value: 'minimal' }
      ],
      default: 'normal'
    },
    {
      type: 'confirm',
      name: 'showToolbar',
      message: 'Show navigation bar (back/forward/URL)?',
      default: true,
      when: ans => ans.windowStyle !== 'frameless'
    },
    {
      type: 'confirm',
      name: 'systemTray',
      message: 'Add system tray icon (minimize to tray)?',
      default: false
    },
    {
      type: 'confirm',
      name: 'alwaysOnTop',
      message: 'Keep window always on top?',
      default: false
    },
    {
      type: 'confirm',
      name: 'injectCSS',
      message: 'Inject custom CSS? (useful to hide ads, tweak UI)',
      default: false
    },
    {
      type: 'editor',
      name: 'customCSS',
      message: 'Enter your custom CSS:',
      default: '/* your custom styles here */\n',
      when: ans => ans.injectCSS
    },
    {
      type: 'number',
      name: 'width',
      message: 'Default window width:',
      default: 1280
    },
    {
      type: 'number',
      name: 'height',
      message: 'Default window height:',
      default: 800
    },
    {
      type: 'confirm',
      name: 'rememberSize',
      message: 'Remember window position & size between sessions?',
      default: true
    },
    {
      type: 'confirm',
      name: 'fetchIcon',
      message: 'Try to fetch favicon automatically?',
      default: true
    },
    {
      type: 'checkbox',
      name: 'platforms',
      message: 'Build targets:',
      choices: [
        { name: 'Windows (.exe)', value: 'win', checked: process.platform === 'win32' },
        { name: 'macOS (.dmg)', value: 'mac', checked: process.platform === 'darwin' },
        { name: 'Linux (.AppImage + .deb)', value: 'linux', checked: process.platform === 'linux' }
      ],
      validate: v => v.length > 0 ? true : 'Pick at least one'
    }
  ])

  console.log()
  console.log(chalk.cyan('  generating your app...'))

  // try to grab the favicon in the background — not a dealbreaker if it fails
  let faviconPath = null
  if (answers.fetchIcon) {
    try {
      console.log(chalk.gray('  fetching favicon...'))
      faviconPath = await fetchFavicon(answers.url, answers.outputDir, answers.name)
      if (faviconPath) console.log(chalk.gray('  ✓ favicon saved'))
    } catch (_) {
      // silently ignore — placeholder will be used
    }
  }

  const result = await generateApp({ ...answers, faviconPath })

  console.log()
  console.log(chalk.green('  ✓ done!'))
  console.log()
  console.log(chalk.bold('  Next steps:'))
  console.log(chalk.gray(`    cd ${result.dir}`))
  console.log(chalk.gray('    npm install'))
  console.log(chalk.gray('    npm start          # run it'))
  console.log(chalk.gray('    npm run build      # build installer'))
  console.log()
}

main().catch(err => {
  console.error(chalk.red('\n  error:'), err.message)
  process.exit(1)
})
// added windowStyle list prompt — normal / frameless / minimal
// removed a console.log I forgot to take out
