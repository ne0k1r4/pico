#!/usr/bin/env node

const path = require('path')
const { generateApp } = require('./generator')
const { validateUrl, fetchFavicon } = require('./utils')
const { spawn } = require('child_process')

let inquirer
let chalk

async function loadCliDependencies() {
  const [inquirerModule, chalkModule] = await Promise.all([
    import('inquirer'),
    import('chalk')
  ])

  inquirer = inquirerModule.default
  chalk = chalkModule.default
}

function fixUrl(raw) {
  let u = (raw || '').trim()
  if (!u) return u
  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(u)) u = 'https://' + u
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
        if (!isWebUrl(val)) return 'enter a valid HTTP or HTTPS URL'
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
      name: 'injectJS',
      message: 'Inject custom JavaScript?',
      default: false
    },
    {
      type: 'input',
      name: 'customJS',
      message: 'Paste your JS (one line, use \\n for newlines):',
      when: a => a.injectJS,
      default: 'console.log("App ready!");'
    },
    {
      type: 'input',
      name: 'userAgent',
      message: 'Custom User-Agent (leave empty for default):',
      default: ''
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
        { name: 'Linux    (.AppImage + .deb)', value: 'linux', checked: process.platform === 'linux' },
        { name: 'Android  (.apk)', value: 'android', checked: false }
      ],
      validate: v => v.length ? true : 'pick at least one platform'
    },
    {
      type: 'confirm',
      name: 'build',
      message: 'Compile the native installer now?',
      default: false
    }
  ])
}

const DEFAULTS = {
  outputDir: './apps',
  windowStyle: 'normal',
  showToolbar: true,
  systemTray: false,
  alwaysOnTop: false,
  darkMode: false,
  injectCSS: false,
  customCSS: '* { font-family: sans-serif; }',
  injectJS: false,
  customJS: 'console.log("App ready!");',
  userAgent: '',
  protocol: '',
  shortcuts: {},
  proxy: '',
  blockAds: false,
  width: 1280,
  height: 800,
  rememberSize: true,
  fetchIcon: true,
  build: false,
  platforms: [process.platform === 'win32' ? 'win' : process.platform === 'darwin' ? 'mac' : 'linux']
}

function parseArgs(args) {
  const options = {}
  const nextValue = (flag, index) => {
    const value = args[index + 1]
    if (!value || value.startsWith('--')) {
      throw new Error(`${flag} requires a value`)
    }
    return value
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--url') {
      options.url = fixUrl(nextValue(arg, i))
      i += 1
    } else if (arg === '--name') {
      options.name = nextValue(arg, i)
      i += 1
    } else if (arg === '--output' || arg === '--outputDir') {
      options.outputDir = nextValue(arg, i)
      i += 1
    } else if (arg === '--style') {
      options.windowStyle = nextValue(arg, i)
      i += 1
    } else if (arg === '--no-toolbar') {
      options.showToolbar = false
    } else if (arg === '--tray') {
      options.systemTray = true
    } else if (arg === '--always-on-top') {
      options.alwaysOnTop = true
    } else if (arg === '--dark') {
      options.darkMode = true
    } else if (arg === '--inject-css') {
      options.injectCSS = true
    } else if (arg === '--css') {
      options.customCSS = nextValue(arg, i)
      i += 1
      options.injectCSS = true
    } else if (arg === '--inject-js') {
      options.injectJS = true
    } else if (arg === '--js') {
      options.customJS = nextValue(arg, i)
      i += 1
      options.injectJS = true
    } else if (arg === '--user-agent') {
      options.userAgent = nextValue(arg, i)
      i += 1
    } else if (arg === '--protocol') {
      options.protocol = nextValue(arg, i)
      i += 1
    } else if (arg === '--shortcuts') {
      const shortcuts = nextValue(arg, i)
      i += 1
      try { options.shortcuts = JSON.parse(shortcuts) } catch { throw new Error('--shortcuts must be valid JSON') }
    } else if (arg === '--proxy') {
      options.proxy = nextValue(arg, i)
      i += 1
    } else if (arg === '--block-ads') {
      options.blockAds = true
    } else if (arg === '--width') {
      options.width = Number(nextValue(arg, i))
      i += 1
    } else if (arg === '--height') {
      options.height = Number(nextValue(arg, i))
      i += 1
    } else if (arg === '--no-remember') {
      options.rememberSize = false
    } else if (arg === '--no-icon') {
      options.fetchIcon = false
    } else if (arg === '--platforms') {
      options.platforms = nextValue(arg, i).split(',')
      i += 1
    } else if (arg === '--build') {
      options.build = true
    }
  }
  return options
}

function isWebUrl(value) {
  try {
    const parsed = new URL(value)
    return ['http:', 'https:'].includes(parsed.protocol) && Boolean(parsed.hostname)
  } catch {
    return false
  }
}

async function main() {
  await loadCliDependencies()

  const args = process.argv.slice(2)
  let answers

  if (args.length > 0) {
    const parsed = parseArgs(args)
    if (!parsed.url || !parsed.name) {
      console.error(chalk.red('\n  ERROR: both --url and --name are required when using command-line arguments'))
      console.log('\n  Usage: pico --url <url> --name <name> [options]')
      console.log('  Options:')
      console.log('    --style <normal|frameless|minimal>')
      console.log('    --no-toolbar')
      console.log('    --tray')
      console.log('    --always-on-top')
      console.log('    --dark')
      console.log('    --inject-css')
      console.log('    --css <custom-css-string>')
      console.log('    --inject-js')
      console.log('    --js <custom-js-string>')
      console.log('    --user-agent <ua-string>')
      console.log('    --block-ads')
      console.log('    --width <px>')
      console.log('    --height <px>')
      console.log('    --no-remember')
      console.log('    --no-icon')
      console.log('    --platforms <win,mac,linux,android>')
      process.exit(1)
    }
    answers = { ...DEFAULTS, ...parsed }
  } else {
    printBanner()
    try {
      answers = await askQuestions()
    } catch (err) {
      if (err.isTtyError || err.message?.includes('force closed')) {
        console.log(chalk.gray('\n  cancelled'))
        process.exit(0)
      }
      throw err
    }
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
  if (answers.platforms.some(platform => ['win', 'mac', 'linux'].includes(platform))) {
    console.log(chalk.gray('  npm start        ← run the desktop app'))
  }
  if (answers.platforms.includes('android')) {
    console.log(chalk.gray('  npm run android:add        ← create the Android project once'))
    console.log(chalk.gray('  npm run android:apk:debug  ← create a debug APK'))
  }
  console.log(chalk.gray('  npm run build:this  ← package selected target(s)'))
  console.log()

  if (answers.build) {
    console.log(chalk.cyan('  compiling native installer...'))
    try {
      console.log(chalk.gray('  running npm install...'))
      await runCommand('npm', ['install'], result.dir)
      if (answers.platforms.includes('android')) {
        console.log(chalk.gray('  preparing Android project...'))
        await runCommand('npm', ['run', 'android:add'], result.dir)
      }
      console.log(chalk.gray('  packaging selected target(s)...'))
      await runCommand('npm', ['run', 'build:this'], result.dir)
      console.log(chalk.green.bold('\n  compilation complete! Review the generated output folders for the package.'))
    } catch (err) {
      console.error(chalk.red.bold('\n  compilation failed: ') + err.message)
    }
  }
}

function runCommand(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, shell: true, stdio: 'inherit' })
    child.on('close', code => {
      if (code === 0) resolve()
      else reject(new Error(`${cmd} failed with exit code ${code}`))
    })
  })
}

main().catch(err => {
  console.error(chalk.red.bold('\n  ERROR: ') + err.message)
  if (process.env.DEBUG) console.error(err.stack)
  console.error(chalk.gray('  run with DEBUG=1 for full stack trace'))
  process.exit(1)
})
