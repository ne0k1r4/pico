const { app, BrowserWindow, clipboard } = require("electron");
const { existsSync } = require("node:fs");
const { rm } = require("node:fs/promises");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const outputRoot = path.join("/tmp", "pico-gui-apk-e2e");
const releaseMode = process.env.PICO_E2E_RELEASE === "1";
const bundleMode = process.env.PICO_E2E_BUNDLE === "1";
const downloadedApk = path.join(
  "/home/ubuntu/Downloads",
  releaseMode
    ? "pico-gui-e2e-release-download.apk"
    : "pico-gui-e2e-download.apk",
);
const downloadedAab = path.join(
  "/home/ubuntu/Downloads",
  "pico-gui-e2e-release-download.aab",
);

process.env.PICO_AUTOMATED_DOWNLOAD_PATH = downloadedApk;
process.env.PICO_AUTOMATED_BUNDLE_DOWNLOAD_PATH = downloadedAab;

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
  await rm(downloadedAab, { force: true });

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

  console.log(
    `E2E: GUI ready; submitting ${releaseMode ? "signed release" : "debug"} Android project`,
  );
  const result = await window.webContents.executeJavaScript(`
    (async () => {
      const form = document.getElementById("pico-generator-form");
      document.getElementById("url").value = "https://sujalinfo.in";
      document.getElementById("name").value = "Pico GUI E2E";
      document.getElementById("outputDir").value = ${JSON.stringify(outputRoot)};
      document.querySelector('input[name="platforms"][value="linux"]').checked = false;
      const androidTarget = document.querySelector('input[name="platforms"][value="android"]');
      androidTarget.checked = true;
      androidTarget.dispatchEvent(new Event("change"));
      if (${JSON.stringify(releaseMode)}) {
        document.getElementById("releaseApk").checked = true;
        document.getElementById("releaseApk").dispatchEvent(new Event("change"));
        document.getElementById("select-keystore-btn").click();
        await new Promise((resolve, reject) => {
          const startedAt = Date.now();
          const poll = () => {
            if (!document.getElementById("keystore-path").textContent.includes("No keystore")) return resolve();
            if (Date.now() - startedAt > 5000) return reject(new Error("Automated keystore selection did not complete."));
            setTimeout(poll, 50);
          };
          poll();
        });
        document.getElementById("keystore-password").value = "changeit";
        document.getElementById("key-password").value = "changeit";
        document.getElementById("keystore-password").dispatchEvent(new Event("input"));
        await new Promise((resolve, reject) => {
          const startedAt = Date.now();
          const poll = () => {
            if (document.getElementById("keystore-alias-suggestions").options.length) return resolve();
            if (Date.now() - startedAt > 5000) return reject(new Error("Keystore alias discovery did not complete."));
            setTimeout(poll, 50);
          };
          poll();
        });
        const discoveredAliases = Array.from(document.getElementById("keystore-alias-suggestions").options, (option) => option.value);
        if (!discoveredAliases.includes("pico-e2e") || !discoveredAliases.includes("second-key")) {
          throw new Error("The keystore aliases were not suggested to the user.");
        }
        document.getElementById("keystore-alias").value = "pico-e2e";
        if (${JSON.stringify(bundleMode)}) document.getElementById("includeAppBundle").checked = true;
      }
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
      await waitForDom(() => !document.getElementById("apk-artifact-actions").hidden || document.getElementById("apk-build-state").textContent === "Failed", 240000);
      if (document.getElementById("apk-build-state").textContent === "Failed") {
        throw new Error(document.getElementById("apk-build-message").textContent);
      }
      document.getElementById("copy-checksum-btn").click();
      await waitForDom(() => document.getElementById("copy-checksum-btn").textContent.includes("Copied"), 5000);
      document.getElementById("download-apk-btn").click();
      await waitForDom(() => document.getElementById("apk-build-message").textContent.includes("download completed"), 30000);
      if (${JSON.stringify(bundleMode)}) {
        await waitForDom(() => !document.getElementById("aab-artifact").hidden, 30000);
        document.getElementById("copy-aab-checksum-btn").click();
        await waitForDom(() => document.getElementById("copy-aab-checksum-btn").textContent.includes("Copied"), 5000);
        document.getElementById("download-aab-btn").click();
        await waitForDom(() => document.getElementById("download-aab-btn").textContent.includes("Saved"), 30000);
      }

      return {
        status: document.getElementById("apk-build-state").textContent,
        message: document.getElementById("apk-build-message").textContent,
        artifact: document.getElementById("apk-artifact-path").textContent,
        checksum: document.getElementById("apk-checksum").textContent,
        downloadLabel: document.getElementById("download-apk-btn").textContent,
        bundle: document.getElementById("aab-artifact-path").textContent,
        bundleChecksum: document.getElementById("aab-checksum").textContent,
        bundleDownloadLabel: document.getElementById("download-aab-btn").textContent
      };
    })()
  `);

  if (!existsSync(downloadedApk)) {
    throw new Error("GUI reported success but did not save the APK.");
  }
  if (bundleMode && !existsSync(downloadedAab)) {
    throw new Error(
      "GUI reported App Bundle success but did not save the AAB.",
    );
  }
  const displayedChecksum = (
    bundleMode ? result.bundleChecksum : result.checksum
  ).replace(/^SHA-256:\s*/, "");
  if (clipboard.readText() !== displayedChecksum) {
    throw new Error("GUI did not copy the displayed SHA-256 checksum.");
  }

  console.log(
    JSON.stringify({
      ...result,
      downloadedApk,
      downloadedAab: bundleMode ? downloadedAab : null,
    }),
  );
}

runWorkflow()
  .then(() => app.quit())
  .catch((error) => {
    console.error(`E2E failed: ${error.stack || error.message}`);
    app.exit(1);
  });
