"use strict";

const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs-extra");
const { spawn } = require("child_process");
const { generateApp } = require("./generator");
const { validateUrl, fetchFavicon } = require("./utils");

let mainWindow = null;

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

ipcMain.handle("download-apk", async (event, artifactPath) => {
  const sourcePath = path.resolve(String(artifactPath || ""));
  if (path.extname(sourcePath).toLowerCase() !== ".apk") {
    return { success: false, error: "Only APK artifacts can be downloaded." };
  }
  if (!(await fs.pathExists(sourcePath))) {
    return { success: false, error: "The generated APK could not be found." };
  }

  const defaultPath = path.join(
    app.getPath("downloads"),
    path.basename(sourcePath),
  );
  const automatedPath = process.env.PICO_AUTOMATED_DOWNLOAD_PATH;
  const selection = automatedPath
    ? { canceled: false, filePath: path.resolve(automatedPath) }
    : await dialog.showSaveDialog(mainWindow, {
        title: "Download generated APK",
        defaultPath,
        buttonLabel: "Save APK",
        filters: [{ name: "Android packages", extensions: ["apk"] }],
      });

  if (selection.canceled || !selection.filePath) {
    return { success: false, canceled: true };
  }

  const destinationPath = selection.filePath.toLowerCase().endsWith(".apk")
    ? selection.filePath
    : `${selection.filePath}.apk`;
  await fs.ensureDir(path.dirname(destinationPath));
  await fs.copy(sourcePath, destinationPath, { overwrite: true });

  return { success: true, path: destinationPath };
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

ipcMain.handle("build-app", async (event, dir) => {
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
        shell: true,
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

  // Capacitor's setup script is safe to repeat and preserves a prepared Android project.
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

  emitStatus("gradle", "running", "Compiling the debug APK with Gradle.");
  const gradleCommand =
    process.platform === "win32" ? "gradlew.bat" : "./gradlew";
  const gradleBuilt = await runProcess(gradleCommand, ["assembleDebug"], {
    cwd: path.join(dir, "android"),
    stage: "gradle",
    label: "APK compilation",
    completeMessage: "Gradle finished compiling the debug APK.",
  });
  if (!gradleBuilt) return { success: false, error: "APK compilation failed." };

  const artifactPath = path.join(
    dir,
    "android",
    "app",
    "build",
    "outputs",
    "apk",
    "debug",
    "app-debug.apk",
  );
  if (!fs.existsSync(artifactPath)) {
    const message = "APK compilation finished without producing app-debug.apk.";
    sendLog(message);
    emitStatus("artifact", "failed", message);
    return { success: false, error: message };
  }

  emitStatus("artifact", "complete", "Debug APK is ready to install.", {
    artifactPath,
  });
  emitStatus("complete", "complete", "APK build completed successfully.", {
    artifactPath,
  });
  sendLog(`APK ready: ${artifactPath}`);
  return { success: true, artifactPath };
});
