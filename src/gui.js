"use strict";

const {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  shell,
} = require("electron");
const path = require("path");
const fs = require("fs-extra");
const crypto = require("crypto");
const { execFile, spawn } = require("child_process");
const { promisify } = require("util");
const { generateApp } = require("./generator");
const { validateUrl, fetchFavicon } = require("./utils");

let mainWindow = null;
const execFileAsync = promisify(execFile);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 720,
    minWidth: 800,
    minHeight: 650,
    title: "Pico — Turn any website into a desktop app",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "gui-preload.js"),
    },
    autoHideMenuBar: true,
  });

  mainWindow.loadFile(path.join(__dirname, "gui.html"));
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("validate-url", async (event, url) => {
  return await validateUrl(url).catch(() => false);
});

ipcMain.handle("fetch-favicon", async (event, { url, name }) => {
  try {
    const tempDir = path.join(app.getPath("temp"), "pico-favicons");
    await fs.ensureDir(tempDir);
    return await fetchFavicon(url, tempDir, name);
  } catch (err) {
    return null;
  }
});

ipcMain.handle("generate-app", async (event, config) => {
  const sendLog = (text) => {
    if (mainWindow) {
      mainWindow.webContents.send("log", text);
    }
  };

  try {
    sendLog("Initializing app generation workspace...");
    const result = await generateApp(config);
    sendLog(`Project directory prepared: ${result.dir}`);
    sendLog("Assets and configuration files written.");
    sendLog("Generated files manifest and package settings.");
    sendLog("Generation complete!");
    return { success: true, dir: result.dir };
  } catch (err) {
    sendLog(`Error: ${err.message}`);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("open-folder", async (event, dir) => {
  await shell.openPath(dir);
});

async function saveArtifact(artifactPath) {
  const sourcePath = path.resolve(String(artifactPath || ""));
  const extension = path.extname(sourcePath).toLowerCase();
  const artifactType = {
    ".apk": { label: "APK", filter: "Android packages" },
    ".aab": { label: "Android App Bundle", filter: "Android App Bundles" },
  }[extension];
  if (!artifactType) {
    return {
      success: false,
      error: "Only APK and AAB artifacts can be downloaded.",
    };
  }
  if (!(await fs.pathExists(sourcePath))) {
    return {
      success: false,
      error: "The generated artifact could not be found.",
    };
  }

  const defaultPath = path.join(
    app.getPath("downloads"),
    path.basename(sourcePath),
  );
  const automatedPath =
    extension === ".aab"
      ? process.env.PICO_AUTOMATED_BUNDLE_DOWNLOAD_PATH
      : process.env.PICO_AUTOMATED_DOWNLOAD_PATH;
  const selection = automatedPath
    ? { canceled: false, filePath: path.resolve(automatedPath) }
    : await dialog.showSaveDialog(mainWindow, {
        title: `Download generated ${artifactType.label}`,
        defaultPath,
        buttonLabel: `Save ${artifactType.label}`,
        filters: [
          { name: artifactType.filter, extensions: [extension.slice(1)] },
        ],
      });

  if (selection.canceled || !selection.filePath) {
    return { success: false, canceled: true };
  }

  const destinationPath = selection.filePath.toLowerCase().endsWith(extension)
    ? selection.filePath
    : `${selection.filePath}${extension}`;
  await fs.ensureDir(path.dirname(destinationPath));
  await fs.copy(sourcePath, destinationPath, { overwrite: true });

  return { success: true, path: destinationPath };
}

ipcMain.handle("download-apk", async (event, artifactPath) => {
  return saveArtifact(artifactPath);
});

ipcMain.handle("download-artifact", async (event, artifactPath) => {
  return saveArtifact(artifactPath);
});

ipcMain.handle("select-keystore", async () => {
  const automatedPath = process.env.PICO_AUTOMATED_KEYSTORE_PATH;
  if (automatedPath && (await fs.pathExists(automatedPath))) {
    return { success: true, path: path.resolve(automatedPath) };
  }

  const selection = await dialog.showOpenDialog(mainWindow, {
    title: "Select Android signing keystore",
    buttonLabel: "Use keystore",
    properties: ["openFile"],
    filters: [
      {
        name: "Android keystores",
        extensions: ["jks", "keystore", "p12", "pfx"],
      },
      { name: "All files", extensions: ["*"] },
    ],
  });

  if (selection.canceled || !selection.filePaths[0]) {
    return { success: false, canceled: true };
  }
  return { success: true, path: selection.filePaths[0] };
});

ipcMain.handle("discover-keystore-aliases", async (event, options = {}) => {
  const keystorePath = path.resolve(String(options.keystorePath || ""));
  const storePassword = String(options.storePassword || "");
  if (!options.keystorePath || !(await fs.pathExists(keystorePath))) {
    return { success: false, error: "Select an existing keystore file first." };
  }
  if (!storePassword) {
    return { success: false, needsPassword: true };
  }

  try {
    const { stdout } = await execFileAsync(
      "keytool",
      [
        "-J-Duser.language=en",
        "-list",
        "-v",
        "-keystore",
        keystorePath,
        "-storepass:env",
        "PICO_KEYSTORE_PASSWORD",
      ],
      {
        env: { ...process.env, PICO_KEYSTORE_PASSWORD: storePassword },
        maxBuffer: 1024 * 1024,
      },
    );
    const aliases = [...stdout.matchAll(/^Alias name:\s*(.+)$/gim)]
      .map((match) => match[1].trim())
      .filter(Boolean);
    return { success: true, aliases: [...new Set(aliases)] };
  } catch {
    return {
      success: false,
      error: "Could not read aliases. Check the keystore password.",
    };
  }
});

ipcMain.handle("copy-checksum", async (event, checksum) => {
  const normalizedChecksum = String(checksum || "")
    .trim()
    .toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalizedChecksum)) {
    return { success: false, error: "Only a SHA-256 checksum can be copied." };
  }
  clipboard.writeText(normalizedChecksum);
  return { success: true };
});

ipcMain.handle("run-app", (event, dir) => {
  const sendLog = (text) => {
    if (mainWindow) {
      mainWindow.webContents.send("log", text);
    }
  };

  sendLog("Preparing app runtime environment...");

  const hasNodeModules = fs.existsSync(path.join(dir, "node_modules"));

  let platforms = [];
  try {
    platforms =
      JSON.parse(fs.readFileSync(path.join(dir, "app-config.json"), "utf8"))
        .platforms || [];
  } catch {
    sendLog("Could not read project target settings.");
    return;
  }

  if (
    !platforms.some((platform) => ["win", "mac", "linux"].includes(platform))
  ) {
    sendLog(
      "Android projects run through an Android emulator or device. Use Compile Native Installer to create the APK.",
    );
    return;
  }

  function launchApp() {
    sendLog("Launching app...");

    let electronExe = null;
    try {
      const electronPkg = path.join(dir, "node_modules", "electron");
      electronExe = require(path.join(electronPkg, "index.js"));
    } catch (e) {
      const fallback = path.join(
        dir,
        "node_modules",
        "electron",
        "dist",
        "electron",
      );
      if (fs.existsSync(fallback)) electronExe = fallback;
    }

    if (!electronExe) {
      sendLog(
        "Could not find electron binary. Run: cd " + dir + " && npm start",
      );
      return;
    }

    const child = spawn(electronExe, ["."], {
      cwd: dir,
      detached: true,
      stdio: "ignore",
    });

    child.unref();

    child.on("error", (err) => {
      sendLog(`Launch error: ${err.message}`);
    });

    sendLog("App launched. Window should appear shortly.");
  }

  if (!hasNodeModules) {
    sendLog("Installing dependencies (npm install)...");
    const install = spawn("npm", ["install"], { cwd: dir, shell: true });

    install.stdout.on("data", (d) => sendLog(d.toString().trim()));
    install.stderr.on("data", (d) => sendLog(d.toString().trim()));

    install.on("close", (code) => {
      if (code === 0) {
        sendLog("Dependencies installed.");
        launchApp();
      } else {
        sendLog(
          `npm install failed (exit ${code}). Try running it manually in the app folder.`,
        );
      }
    });
  } else {
    launchApp();
  }
});

ipcMain.handle("build-app", async (event, dir, buildOptions = {}) => {
  const sendLog = (text) => {
    if (mainWindow) {
      mainWindow.webContents.send("log", text);
    }
  };
  const sendBuildStatus = (status) => {
    if (mainWindow) {
      mainWindow.webContents.send("build-status", status);
    }
  };
  const emitStatus = (stage, state, message, extra = {}) => {
    sendBuildStatus({ stage, state, message, ...extra });
  };
  const forwardOutput = (data, stage) => {
    const lines = data.toString().split(/\r?\n/).filter(Boolean);
    lines.forEach((line) => {
      sendLog(line);
      if (stage === "gradle" && line.startsWith("> Task")) {
        emitStatus("gradle", "running", line.replace("> Task ", "Gradle: "));
      }
    });
  };
  const runProcess = (command, args, options) =>
    new Promise((resolve) => {
      const child = spawn(command, args, {
        cwd: options.cwd,
        shell: process.platform === "win32",
        env: { ...process.env, ...options.env },
      });
      child.stdout.on("data", (data) => forwardOutput(data, options.stage));
      child.stderr.on("data", (data) => forwardOutput(data, options.stage));
      child.on("error", (error) => {
        sendLog(`${options.label} could not start: ${error.message}`);
        resolve(false);
      });
      child.on("close", (code) => {
        if (code === 0) {
          emitStatus(options.stage, "complete", options.completeMessage);
          resolve(true);
        } else {
          const message = `${options.label} failed (exit code ${code}).`;
          sendLog(message);
          emitStatus(options.stage, "failed", message);
          resolve(false);
        }
      });
    });

  let platforms = [];
  try {
    platforms =
      JSON.parse(fs.readFileSync(path.join(dir, "app-config.json"), "utf8"))
        .platforms || [];
  } catch {
    const message = "Could not read project target settings.";
    sendLog(message);
    emitStatus("complete", "failed", message);
    return { success: false, error: message };
  }

  const buildsAndroid = platforms.includes("android");
  const desktopPlatforms = platforms.filter((platform) =>
    ["win", "mac", "linux"].includes(platform),
  );
  const hasNodeModules = fs.existsSync(path.join(dir, "node_modules"));
  const includeBundle = Boolean(buildOptions.includeBundle);
  let releaseSigning = null;
  try {
    releaseSigning = normalizeReleaseSigning(buildOptions.releaseSigning);
  } catch (error) {
    const message = `Could not prepare release signing: ${error.message}`;
    sendLog(message);
    emitStatus("release-signing", "failed", message);
    return { success: false, error: message };
  }

  if (releaseSigning && !buildsAndroid) {
    const message = "Release signing is available only for Android builds.";
    sendLog(message);
    emitStatus("release-signing", "failed", message);
    return { success: false, error: message };
  }
  if (includeBundle && !releaseSigning) {
    const message =
      "Android App Bundle output requires a signed release APK build.";
    sendLog(message);
    emitStatus("app-bundle", "failed", message);
    return { success: false, error: message };
  }

  sendLog("Starting distribution build process...");
  emitStatus(
    "dependencies",
    "running",
    hasNodeModules
      ? "Checking generated dependencies."
      : "Installing generated dependencies.",
  );

  if (!hasNodeModules) {
    const installed = await runProcess("npm", ["install"], {
      cwd: dir,
      stage: "dependencies",
      label: "Dependency installation",
      completeMessage: "Dependencies are ready.",
    });
    if (!installed)
      return { success: false, error: "Dependency installation failed." };
  } else {
    emitStatus("dependencies", "complete", "Dependencies are ready.");
  }

  if (desktopPlatforms.length) {
    emitStatus("desktop", "running", "Packaging selected desktop targets.");
    const desktopBuilt = await runProcess("npm", ["run", "build:desktop"], {
      cwd: dir,
      stage: "desktop",
      label: "Desktop packaging",
      completeMessage: "Desktop package build finished.",
    });
    if (!desktopBuilt)
      return { success: false, error: "Desktop packaging failed." };
  }

  if (!buildsAndroid) {
    emitStatus("complete", "complete", "Package build finished.");
    sendLog(
      "Compilation succeeded! Check the generated project output folders for the package.",
    );
    return { success: true };
  }

  emitStatus(
    "native-project",
    "running",
    "Preparing the native Android project.",
  );
  const nativePrepared = await runProcess("npm", ["run", "android:add"], {
    cwd: dir,
    stage: "native-project",
    label: "Android project preparation",
    completeMessage: "Native Android project is ready.",
  });
  if (!nativePrepared)
    return { success: false, error: "Android project preparation failed." };

  emitStatus("sync", "running", "Synchronizing website assets with Android.");
  const synced = await runProcess("npx", ["cap", "sync", "android"], {
    cwd: dir,
    stage: "sync",
    label: "Android asset synchronization",
    completeMessage: "Website assets are synchronized.",
  });
  if (!synced)
    return { success: false, error: "Android asset synchronization failed." };

  let signingScriptPath = null;
  if (releaseSigning) {
    emitStatus(
      "release-signing",
      "running",
      "Preparing the custom keystore for this release build.",
    );
    try {
      signingScriptPath = await writeEphemeralSigningScript(releaseSigning);
      emitStatus(
        "release-signing",
        "complete",
        "Custom keystore is ready for signing.",
      );
    } catch (error) {
      const message = `Could not prepare release signing: ${error.message}`;
      sendLog(message);
      emitStatus("release-signing", "failed", message);
      return { success: false, error: message };
    }
  }

  const variant = releaseSigning ? "release" : "debug";
  emitStatus("gradle", "running", `Compiling the ${variant} APK with Gradle.`);
  const gradleCommand =
    process.platform === "win32" ? "gradlew.bat" : "./gradlew";
  const gradleArguments = signingScriptPath
    ? ["-I", signingScriptPath, "assembleRelease"]
    : ["assembleDebug"];
  const gradleBuilt = await runProcess(gradleCommand, gradleArguments, {
    cwd: path.join(dir, "android"),
    stage: "gradle",
    label: "APK compilation",
    completeMessage: `Gradle finished compiling the ${variant} APK.`,
  });
  if (!gradleBuilt) {
    if (signingScriptPath) await fs.remove(signingScriptPath);
    return { success: false, error: "APK compilation failed." };
  }

  const artifactPath = path.join(
    dir,
    "android",
    "app",
    "build",
    "outputs",
    "apk",
    variant,
    `app-${variant}.apk`,
  );
  if (!fs.existsSync(artifactPath)) {
    if (signingScriptPath) await fs.remove(signingScriptPath);
    const message = `APK compilation finished without producing app-${variant}.apk.`;
    sendLog(message);
    emitStatus("artifact", "failed", message);
    return { success: false, error: message };
  }

  const checksum = await sha256(artifactPath);
  const artifactKind = releaseSigning ? "Signed release" : "Debug";
  let bundlePath = null;
  let bundleChecksum = null;
  if (includeBundle) {
    emitStatus(
      "app-bundle",
      "running",
      "Compiling the signed Android App Bundle.",
    );
    const bundleBuilt = await runProcess(
      gradleCommand,
      ["-I", signingScriptPath, "bundleRelease"],
      {
        cwd: path.join(dir, "android"),
        stage: "app-bundle",
        label: "Android App Bundle compilation",
        completeMessage:
          "Gradle finished compiling the signed Android App Bundle.",
      },
    );
    if (!bundleBuilt) {
      if (signingScriptPath) await fs.remove(signingScriptPath);
      return {
        success: false,
        error: "Android App Bundle compilation failed.",
      };
    }
    bundlePath = path.join(
      dir,
      "android",
      "app",
      "build",
      "outputs",
      "bundle",
      "release",
      "app-release.aab",
    );
    if (!fs.existsSync(bundlePath)) {
      if (signingScriptPath) await fs.remove(signingScriptPath);
      const message =
        "App Bundle compilation finished without producing app-release.aab.";
      sendLog(message);
      emitStatus("app-bundle", "failed", message);
      return { success: false, error: message };
    }
    bundleChecksum = await sha256(bundlePath);
    emitStatus(
      "app-bundle",
      "complete",
      "Signed Android App Bundle is ready.",
      {
        bundlePath,
        bundleChecksum,
      },
    );
  }
  if (signingScriptPath) await fs.remove(signingScriptPath);
  emitStatus(
    "artifact",
    "complete",
    `${artifactKind} APK is ready to install.`,
    {
      artifactPath,
      artifactKind,
      checksum,
      bundlePath,
      bundleChecksum,
    },
  );
  emitStatus(
    "complete",
    "complete",
    `${artifactKind} APK build completed successfully.`,
    {
      artifactPath,
      artifactKind,
      checksum,
      bundlePath,
      bundleChecksum,
    },
  );
  sendLog(`${artifactKind} APK ready: ${artifactPath}`);
  return {
    success: true,
    artifactPath,
    artifactKind,
    checksum,
    bundlePath,
    bundleChecksum,
  };
});

function normalizeReleaseSigning(releaseSigning) {
  if (!releaseSigning || !releaseSigning.enabled) return null;

  const keystorePath = path.resolve(String(releaseSigning.keystorePath || ""));
  const keyAlias = String(releaseSigning.keyAlias || "").trim();
  const storePassword = String(releaseSigning.storePassword || "");
  const keyPassword = String(releaseSigning.keyPassword || storePassword);
  if (
    !releaseSigning.keystorePath ||
    !fs.existsSync(keystorePath) ||
    !fs.statSync(keystorePath).isFile()
  ) {
    throw new Error("Select an existing Android keystore file.");
  }
  if (!keyAlias || !storePassword || !keyPassword) {
    throw new Error(
      "Keystore alias, store password, and key password are required.",
    );
  }
  return { keystorePath, keyAlias, storePassword, keyPassword };
}

async function writeEphemeralSigningScript(signing) {
  const escapeGroovy = (value) =>
    String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const scriptPath = path.join(
    app.getPath("temp"),
    `pico-signing-${crypto.randomUUID()}.gradle`,
  );
  const script = `// Generated in a temporary directory and deleted after one build.\ngradle.beforeProject { picoApp ->\n  if (picoApp.path == ':app') {\n    picoApp.pluginManager.withPlugin('com.android.application') {\n      picoApp.android.signingConfigs.create('picoRelease') {\n        storeFile picoApp.file('${escapeGroovy(signing.keystorePath)}')\n        storePassword '${escapeGroovy(signing.storePassword)}'\n        keyAlias '${escapeGroovy(signing.keyAlias)}'\n        keyPassword '${escapeGroovy(signing.keyPassword)}'\n      }\n      picoApp.android.buildTypes.release.signingConfig = picoApp.android.signingConfigs.picoRelease\n    }\n  }\n}\n`;
  await fs.outputFile(scriptPath, script, { mode: 0o600 });
  return scriptPath;
}

async function sha256(filePath) {
  const data = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(data).digest("hex");
}
