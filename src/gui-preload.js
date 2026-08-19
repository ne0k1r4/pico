"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("picoAPI", {
  validateUrl: (url) => ipcRenderer.invoke("validate-url", url),
  fetchFavicon: (url, name) =>
    ipcRenderer.invoke("fetch-favicon", { url, name }),
  generateApp: (config) => ipcRenderer.invoke("generate-app", config),
  openFolder: (dir) => ipcRenderer.invoke("open-folder", dir),
  runApp: (dir) => ipcRenderer.invoke("run-app", dir),
  buildApp: (dir, buildOptions) =>
    ipcRenderer.invoke("build-app", dir, buildOptions),
  selectKeystore: () => ipcRenderer.invoke("select-keystore"),
  discoverKeystoreAliases: (options) =>
    ipcRenderer.invoke("discover-keystore-aliases", options),
  copyChecksum: (checksum) => ipcRenderer.invoke("copy-checksum", checksum),
  downloadApk: (artifactPath) =>
    ipcRenderer.invoke("download-apk", artifactPath),
  downloadArtifact: (artifactPath) =>
    ipcRenderer.invoke("download-artifact", artifactPath),
  onLog: (callback) => {
    const subscription = (event, text) => callback(text);
    ipcRenderer.on("log", subscription);
    return () => ipcRenderer.removeListener("log", subscription);
  },
  onBuildStatus: (callback) => {
    const subscription = (event, status) => callback(status);
    ipcRenderer.on("build-status", subscription);
    return () => ipcRenderer.removeListener("build-status", subscription);
  },
});
