'use strict'

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  openExternal: (url) => ipcRenderer.send('open-external', url),
  onNavigate: (cb) => ipcRenderer.on('navigate', (_, action) => cb(action))
})
