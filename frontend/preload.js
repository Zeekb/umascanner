const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadRunners: () => ipcRenderer.invoke('load-runners'),
  loadSkillTypes: () => ipcRenderer.invoke('load-skill-types'),
  loadOrderedSkills: () => ipcRenderer.invoke('load-ordered-skills'),
  loadRunnerSkills: () => ipcRenderer.invoke('load-runner-skills'),
  loadOrderedSparks: () => ipcRenderer.invoke('load-ordered-sparks')
});