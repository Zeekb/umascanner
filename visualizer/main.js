const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises; // For async loadSkillTypes
const fsSync = require('fs'); // For sync loadRunners
const { spawn } = require('child_process');

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
  ipcMain.handle('save-runners', async (event, runnersData) => {
  // Assumes 'python' or 'python3' is in the system's PATH.
  // You may need to change 'python' to 'python3' depending on your system.
  const pythonExecutable = 'python'; 

  // Path to the new helper script
  const scriptPath = path.join(__dirname, '..', 'image processor', 'save_formatted_json.py');

  // Convert the runner data from a JS object to a JSON string
  const dataString = JSON.stringify(runnersData);

  // Return a Promise that resolves/rejects based on the Python script's exit
  return new Promise((resolve, reject) => {

    // Spawn the python process
    const pyProcess = spawn(pythonExecutable, [scriptPath], {
        // Set the Current Working Directory to the script's location
        // so it can correctly import 'data_updater'
        cwd: path.join(__dirname, '..', 'image processor'),
        stdio: ['pipe', 'pipe', 'pipe'], // stdin, stdout, stderr
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
        reject(new Error(`Failed to start Python process: ${err.message}`));
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