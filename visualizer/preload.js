const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadRunners: () => ipcRenderer.invoke('load-runners'),
  loadSkills: () => ipcRenderer.invoke('load-skills'),
  loadRunnerSkills: () => ipcRenderer.invoke('load-runner-skills'),
  loadAffinityData: () => ipcRenderer.invoke('load-affinity-data'),
  loadOrderedSparks: () => ipcRenderer.invoke('load-ordered-sparks'),
  saveRunners: (runnersData) => ipcRenderer.invoke('save-runners', runnersData)
});