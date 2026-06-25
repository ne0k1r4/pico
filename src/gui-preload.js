'use strict'

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('picoAPI', {
  validateUrl: (url) => ipcRenderer.invoke('validate-url', url),
  fetchFavicon: (url, name) => ipcRenderer.invoke('fetch-favicon', url, name),
  generateApp: (config) => ipcRenderer.invoke('generate-app', config),
  openFolder: (dir) => ipcRenderer.invoke('open-folder', dir),
  runApp: (dir) => ipcRenderer.invoke('run-app', dir),
  onLog: (callback) => {
    const subscription = (event, text) => callback(text)
    ipcRenderer.on('log', subscription)
    return () => ipcRenderer.removeListener('log', subscription)
  }
})
