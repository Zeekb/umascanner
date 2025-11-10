const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const { spawn } = require('child_process');

const isPackaged = app.isPackaged;


const dataDir = isPackaged
  ? path.join(process.resourcesPath, 'data')
  : path.join(__dirname, '..', 'data');

const dataFilePath = path.join(dataDir, 'all_runners.json');

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    icon: path.join(__dirname, './assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile('index.html');
  
  
}

app.whenReady().then(() => {
  ipcMain.handle('load-runners', async () => {
    try {
      const data = fsSync.readFileSync(dataFilePath, 'utf-8');
      console.log(`Loading runners from: ${dataFilePath}`); 
      return JSON.parse(data);
    } catch (err) {
      console.error(`Failed to read or parse runners file at ${dataFilePath}:`, err);
      return [];
    }
  });

  ipcMain.handle('load-skills', async () => {
    try {
      const filePath = path.join(dataDir, 'game_data', 'skills.json');
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to load skills.json:', error);
      return null;
    }
  });

  ipcMain.handle('load-runner-skills', async () => {
    try {
      const filePath = path.join(dataDir, 'game_data', 'runner_skills.json');
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to load runner_skills.json:', error);
      return null; 
    }
  });

  ipcMain.handle('load-ordered-sparks', async () => {
    try {
      const filePath = path.join(dataDir, 'game_data', 'sparks.json');
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to load sparks.json:', error);
      return null; 
    }
  });

  ipcMain.handle('load-affinity-data', async () => {
    try {
      const filePath = path.join(dataDir, 'game_data', 'runner_affinity.json');
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to load runner_affinity.json:', error);
      return null; 
    }
  });
  ipcMain.handle('save-runners', async (event, runnersData) => {
  
  
  const pythonExecutable = 'python'; 

  const resourcesPath = isPackaged
      ? path.join(process.resourcesPath, 'python_scripts') 
      : path.join(__dirname, '..', 'image processor');    
  
  const scriptPath = path.join(resourcesPath, 'save_formatted_json.py');
  const dataUpdaterPath = path.join(resourcesPath, 'data_updater.py'); 

  if (!fsSync.existsSync(scriptPath) || !fsSync.existsSync(dataUpdaterPath)) {
    console.error(`Error: Python save scripts not found at expected location: ${resourcesPath}`);
    return Promise.reject(new Error('Required Python save script(s) not found.'));
  }

  const dataString = JSON.stringify(runnersData);

  return new Promise((resolve, reject) => {
    const pyProcess = spawn(pythonExecutable, [scriptPath, dataFilePath], { 
      cwd: resourcesPath, 
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

    
    pyProcess.on('close', (code) => {
      if (code === 0) {
        
        console.log(`Python script stdout: ${stdout}`);
        resolve({ success: true, message: stdout });
      } else {
        
        console.error(`Python script exited with code ${code}`);
        console.error(`Python script stderr: ${stderr}`);
        
        reject(new Error(`Save failed (Python script error): ${stderr}`));
      }
    });

    
    pyProcess.on('error', (err) => {
        console.error('Failed to start Python process:', err);
        
        if (err.code === 'ENOENT') {
            reject(new Error(`Failed to save: Python executable ('${pythonExecutable}') not found in PATH. Please ensure Python is installed and accessible.`));
        } else {
            reject(new Error(`Failed to start Python process: ${err.message}`));
        }
    });

    
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




function loadRunners() {
  
  
}
