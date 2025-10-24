const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
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

// Securely reads the all_runners.json file when the front-end requests it.
ipcMain.handle('load-runners', () => {
  // Assumes your JSON is in a 'data' folder at the root of your project
  const jsonPath = path.join(__dirname, '../data', 'all_runners.json');
  try {
    const data = fs.readFileSync(jsonPath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error("Failed to read or parse all_runners.json:", err);
    // Return an empty array or send an error message to the front-end
    return [];
  }
});