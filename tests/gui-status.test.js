const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = (fileName) =>
  fs.readFileSync(path.join(__dirname, "..", "src", fileName), "utf8");

test("GUI exposes structured real-time APK build status", () => {
  const preload = source("gui-preload.js");
  const main = source("gui.js");
  const page = source("gui.html");

  assert.match(preload, /onBuildStatus/);
  assert.match(preload, /downloadApk/);
  assert.match(preload, /selectKeystore/);
  assert.match(preload, /copyChecksum/);
  assert.match(main, /build-status/);
  assert.match(main, /download-apk/);
  assert.match(main, /select-keystore/);
  assert.match(main, /assembleRelease/);
  assert.match(main, /sha256/);
  assert.match(main, /copy-checksum/);
  assert.match(main, /showSaveDialog/);
  assert.match(main, /artifactPath/);
  assert.match(main, /assembleDebug/);
  assert.match(page, /id="apk-build-status"/);
  assert.match(page, /data-stage="gradle"/);
  assert.match(page, /id="apk-artifact-path"/);
  assert.match(page, /id="download-apk-btn"/);
  assert.match(page, /id="copy-checksum-btn"/);
  assert.match(page, /id="releaseApk"/);
  assert.match(page, /copyChecksum/);
});
