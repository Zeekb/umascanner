const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises; // For async loadSkillTypes
const fsSync = require('fs'); // For sync loadRunners

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    icon: path.join(__dirname, '../assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile('index.html');
  // Optional: Open DevTools for debugging
  // win.webContents.openDevTools();
}

app.whenReady().then(() => {
  ipcMain.handle('load-runners', loadRunners);
  ipcMain.handle('load-skill-types', loadSkillTypes);
  ipcMain.handle('load-ordered-skills', async () => {
    try {
      const filePath = path.join(__dirname, '../data', 'game_data', 'skills_ordered.json');
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to load skills_ordered.json:', error);
      return null; // Return null on error
    }
  });
  ipcMain.handle('load-runner-skills', async () => {
    try {
      const filePath = path.join(__dirname, '../data', 'game_data', 'runner_skills.json');
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to load runner_skills.json:', error);
      return null; // Return null on error
    }
  });
  ipcMain.handle('load-ordered-sparks', async () => {
    try {
      const filePath = path.join(__dirname, '../data', 'game_data', 'sparks.json');
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to load sparks.json:', error);
      return null; // Return null on error
    }
  });
  ipcMain.handle('load-affinity-data', async () => {
    try {
      const filePath = path.join(__dirname, '../data', 'game_data', 'runner_affinity.json');
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to load runner_affinity.json:', error);
      return null; // Return null on error
    }
  });
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// --- Function Definitions ---

// This is your original 'load-runners' handler, now as a named function
function loadRunners() {
  const jsonPath = path.join(__dirname, '../data', 'all_runners.json');
  try {
    const data = fsSync.readFileSync(jsonPath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error("Failed to read or parse all_runners.json:", err);
    return [];
  }
}

// This is your 'loadSkillTypes' function
async function loadSkillTypes() {
  const skillTypesPath = path.join(__dirname, '..', 'data', 'game_data', 'skill_types.json');
  try {
    const data = await fs.readFile(skillTypesPath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading skill_types.json:', err);
    return {}; // Return empty object on error
  }
}