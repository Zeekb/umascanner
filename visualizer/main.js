const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const { spawn } = require('child_process');

const isPackaged = app.isPackaged;
const basePath = isPackaged ? path.dirname(app.getPath('exe')) : path.join(__dirname, '..', '..');
const dataFilePath = path.join(basePath, 'all_runners.json');

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
  ipcMain.handle('load-runners', async () => {
    try {
    const data = fsSync.readFileSync(dataFilePath, 'utf-8');
    console.log(`Loading runners from: ${dataFilePath}`); // Optional: for debugging
    return JSON.parse(data);
  } catch (err) {
    console.error(`Failed to read or parse runners file at ${dataFilePath}:`, err);
    return [];
  }
  });
  ipcMain.handle('load-skills', async () => {
    try {
      const filePath = path.join(__dirname, '../data', 'game_data', 'skills.json');
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to load skills_ordered.json:', error);
      return null;
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
  ipcMain.handle('save-runners', async (event, runnersData) => {
  // Assumes 'python' or 'python3' is in the system's PATH.
  // You may need to change 'python' to 'python3' depending on your system.
  const pythonExecutable = 'python'; 

  const resourcesPath = isPackaged
      ? path.join(process.resourcesPath, 'python_scripts') // Path when packaged
      : path.join(__dirname, '..', 'image processor');    // Path during development
  
  const scriptPath = path.join(resourcesPath, 'save_formatted_json.py');
  const dataUpdaterPath = path.join(resourcesPath, 'data_updater.py'); // Needed by save_formatted_json

  if (!fsSync.existsSync(scriptPath) || !fsSync.existsSync(dataUpdaterPath)) {
    console.error(`Error: Python save scripts not found at expected location: ${resourcesPath}`);
    return Promise.reject(new Error('Required Python save script(s) not found.'));
  }

  const dataString = JSON.stringify(runnersData);

  return new Promise((resolve, reject) => {
    const pyProcess = spawn(pythonExecutable, [scriptPath, dataFilePath], { // <-- Pass dataFilePath here
      cwd: resourcesPath, // Keep CWD so it can import data_updater
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONIOENCODING: 'UTF-8' }
    });

    let stdout = '';
    let stderr = '';

    pyProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pyProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Handle the script's exit
    pyProcess.on('close', (code) => {
      if (code === 0) {
        // Success
        console.log(`Python script stdout: ${stdout}`);
        resolve({ success: true, message: stdout });
      } else {
        // Failure
        console.error(`Python script exited with code ${code}`);
        console.error(`Python script stderr: ${stderr}`);
        // Reject the promise, which will be caught by renderer.js
        reject(new Error(`Save failed (Python script error): ${stderr}`));
      }
    });

    // Handle errors in spawning the process itself
    pyProcess.on('error', (err) => {
        console.error('Failed to start Python process:', err);
        // Provide a more user-friendly error if Python isn't found
        if (err.code === 'ENOENT') {
            reject(new Error(`Failed to save: Python executable ('${pythonExecutable}') not found in PATH. Please ensure Python is installed and accessible.`));
        } else {
            reject(new Error(`Failed to start Python process: ${err.message}`));
        }
    });

    // Write the JSON data string to the Python script's standard input
    pyProcess.stdin.write(dataString, 'utf-8');
    pyProcess.stdin.end();
  });
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
  
  
}