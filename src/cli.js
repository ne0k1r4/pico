#!/usr/bin/env node

const inquirer = require('inquirer')
const chalk = require('chalk')
const path = require('path')
const fs = require('fs-extra')
const { generateApp } = require('./generator')
const { validateUrl, fetchFavicon } = require('./utils')

function fixUrl(raw) {
  let u = (raw || '').trim()
  if (!u) return u
  if (!u.startsWith('http://') && !u.startsWith('https://')) u = 'https://' + u
  return u
}

function printBanner() {
  console.log()
  console.log('  ' + chalk.bold.white('pico') + chalk.gray(' · any website → native desktop app'))
  console.log('  ' + chalk.gray('─'.repeat(40)))
  console.log()
}

async function askQuestions() {
  return inquirer.prompt([
    {
      type: 'input',
      name: 'url',
      message: 'URL of the website:',
      filter: fixUrl,
      validate: async val => {
        if (!val) return 'required'
        const alive = await validateUrl(val).catch(() => false)
        if (!alive) {
          console.log(chalk.yellow('\n  ⚠ could not reach that url — continuing anyway'))
        }
        return true
      }
    },
    {
      type: 'input',
      name: 'name',
      message: 'App name:',
      validate: v => v.trim() ? true : 'required'
    },
    {
      type: 'input',
      name: 'outputDir',
      message: 'Output folder:',
      default: './apps'
    },
    {
      type: 'list',
      name: 'windowStyle',
      message: 'Window style:',
      choices: [
        { name: 'Normal  — standard title bar', value: 'normal' },
        { name: 'Frameless — no title bar, feels native', value: 'frameless' },
        { name: 'Minimal — just a thin nav strip', value: 'minimal' }
      ],
      default: 'normal'
    },
    {
      type: 'confirm',
      name: 'showToolbar',
      message: 'Show nav toolbar (back / forward / url bar)?',
      default: true,
      when: a => a.windowStyle !== 'frameless'
    },
    {
      type: 'confirm',
      name: 'systemTray',
      message: 'Minimize to system tray instead of closing?',
      default: false
    },
    {
      type: 'confirm',
      name: 'alwaysOnTop',
      message: 'Always on top?',
      default: false
    },
    {
      type: 'confirm',
      name: 'darkMode',
      message: 'Force dark mode on the site? (injects dark CSS)',
      default: false
    },
    {
      type: 'confirm',
      name: 'injectCSS',
      message: 'Inject custom CSS?',
      default: false
    },
    {
      type: 'input',
      name: 'customCSS',
      message: 'Paste your CSS (one line, use \\n for newlines):',
      when: a => a.injectCSS,
      default: '* { font-family: sans-serif; }'
    },
    {
      type: 'confirm',
      name: 'blockAds',
      message: 'Block common ad/tracker domains?',
      default: false
    },
    {
      type: 'number',
      name: 'width',
      message: 'Window width:',
      default: 1280
    },
    {
      type: 'number',
      name: 'height',
      message: 'Window height:',
      default: 800
    },
    {
      type: 'confirm',
      name: 'rememberSize',
      message: 'Remember window size & position?',
      default: true
    },
    {
      type: 'confirm',
      name: 'fetchIcon',
      message: 'Try to grab favicon from the site?',
      default: true
    },
    {
      type: 'checkbox',
      name: 'platforms',
      message: 'Build for:',
      choices: [
        { name: 'Windows  (.exe)', value: 'win',   checked: process.platform === 'win32' },
        { name: 'macOS    (.dmg)', value: 'mac',   checked: process.platform === 'darwin' },
        { name: 'Linux    (.AppImage + .deb)', value: 'linux', checked: process.platform === 'linux' }
      ],
      validate: v => v.length ? true : 'pick at least one platform'
    }
  ])
}

async function main() {
  printBanner()

  let answers
  try {
    answers = await askQuestions()
  } catch (err) {
    if (err.isTtyError || err.message?.includes('force closed')) {
      console.log(chalk.gray('\n  cancelled'))
      process.exit(0)
    }
    throw err
  }

  console.log()
  console.log(chalk.cyan('  building...'))

  let faviconPath = null
  if (answers.fetchIcon) {
    process.stdout.write(chalk.gray('  fetching favicon... '))
    faviconPath = await fetchFavicon(answers.url, answers.outputDir, answers.name).catch(() => null)
    console.log(faviconPath ? chalk.green('got it') : chalk.gray('skipped'))
  }

  const result = await generateApp({ ...answers, faviconPath })

  console.log()
  console.log(chalk.green.bold('  done ✓'))
  console.log()
  console.log(chalk.white('  your app is at:') + ' ' + chalk.cyan(result.dir))
  console.log()
  console.log(chalk.gray('  cd ' + result.dir))
  console.log(chalk.gray('  npm install'))
  console.log(chalk.gray('  npm start        ← run it'))
  console.log(chalk.gray('  npm run build    ← package into installer'))
  console.log()
}

main().catch(err => {
  console.error(chalk.red.bold('\n  ERROR: ') + err.message)
  if (process.env.DEBUG) console.error(err.stack)
  console.error(chalk.gray('  run with DEBUG=1 for full stack trace'))
  process.exit(1)
})
