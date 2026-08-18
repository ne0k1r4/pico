const { app, BrowserWindow } = require("electron");
const { existsSync } = require("node:fs");
const { rm } = require("node:fs/promises");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const outputRoot = path.join("/tmp", "pico-gui-apk-e2e");
const downloadedApk = path.join(
  "/home/ubuntu/Downloads",
  "pico-gui-e2e-download.apk",
);

process.env.PICO_AUTOMATED_DOWNLOAD_PATH = downloadedApk;

function waitFor(condition, timeoutMs = 240_000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const poll = async () => {
      if (await condition()) return resolve();
      if (Date.now() - startedAt > timeoutMs) {
        return reject(new Error("Timed out waiting for GUI APK workflow."));
      }
      setTimeout(poll, 250);
    };
    poll();
  });
}

async function runWorkflow() {
  await rm(outputRoot, { recursive: true, force: true });
  await rm(downloadedApk, { force: true });

  console.log("E2E: starting Pico GUI");
  require(path.join(repoRoot, "src", "gui.js"));
  await app.whenReady();
  await waitFor(() => BrowserWindow.getAllWindows().length === 1, 15_000);

  const window = BrowserWindow.getAllWindows()[0];
  await waitFor(
    () => window.webContents.getURL().endsWith("/src/gui.html"),
    15_000,
  );
  await waitFor(
    () =>
      window.webContents.executeJavaScript(
        "Boolean(window.picoAPI && document.getElementById('pico-generator-form'))",
      ),
    15_000,
  );

  console.log("E2E: GUI ready; submitting Android project");
  const result = await window.webContents.executeJavaScript(`
    (async () => {
      const form = document.getElementById("pico-generator-form");
      document.getElementById("url").value = "https://sujalinfo.in";
      document.getElementById("name").value = "Pico GUI E2E";
      document.getElementById("outputDir").value = ${JSON.stringify(outputRoot)};
      document.querySelector('input[name="platforms"][value="linux"]').checked = false;
      document.querySelector('input[name="platforms"][value="android"]').checked = true;
      form.requestSubmit();

      const waitForDom = (condition, timeoutMs = 240000) => new Promise((resolve, reject) => {
        const startedAt = Date.now();
        const poll = () => {
          if (condition()) return resolve();
          if (Date.now() - startedAt > timeoutMs) return reject(new Error("Timed out waiting for GUI state."));
          setTimeout(poll, 250);
        };
        poll();
      });

      await waitForDom(() => document.getElementById("success-view").classList.contains("active"), 30000);
      document.getElementById("build-installer-btn").click();
      await waitForDom(() => !document.getElementById("download-apk-btn").hidden, 240000);
      document.getElementById("download-apk-btn").click();
      await waitForDom(() => document.getElementById("apk-build-message").textContent.includes("download completed"), 30000);

      return {
        status: document.getElementById("apk-build-state").textContent,
        message: document.getElementById("apk-build-message").textContent,
        artifact: document.getElementById("apk-artifact-path").textContent
      };
    })()
  `);

  if (!existsSync(downloadedApk)) {
    throw new Error("GUI reported success but did not save the APK.");
  }

  console.log(JSON.stringify({ ...result, downloadedApk }));
}

runWorkflow()
  .then(() => app.quit())
  .catch((error) => {
    console.error(`E2E failed: ${error.stack || error.message}`);
    app.exit(1);
  });
