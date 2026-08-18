'use strict'

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  openExternal: (url) => {
    if (typeof url === 'string' && url.trim()) {
      ipcRenderer.send('open-external', url.trim())
    }
  },
  onNavigate: (cb) => ipcRenderer.on('nav', (_, action) => cb(action)),
  onOpenFind: (cb) => ipcRenderer.on('open-find', () => cb()),
  onZoom: (cb) => ipcRenderer.on('zoom-action', (_, action) => cb(action))
})

window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    ipcRenderer.send('shortcut-find')
  }
})
