const { contextBridge, ipcRenderer } = require('electron');

// Expose a secure API to the renderer process (your front-end javascript)
contextBridge.exposeInMainWorld('api', {
  loadRunners: () => ipcRenderer.invoke('load-runners')
});