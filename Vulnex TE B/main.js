const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');
const AdmZip = require('adm-zip');
const { scanProject } = require('./src/scanner');

let mainWindow;

// ---------- Storage ----------
const DATA_DIR = app.getPath('userData');
const HISTORY_DIR = path.join(DATA_DIR, 'vulnex-history');
const HISTORY_FILE = path.join(HISTORY_DIR, 'scans.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const REPOS_DIR = path.join(os.tmpdir(), 'vulnex-repos');

function ensureDirs() {
  if (!fs.existsSync(HISTORY_DIR)) fs.mkdirSync(HISTORY_DIR, { recursive: true });
  if (!fs.existsSync(REPOS_DIR)) fs.mkdirSync(REPOS_DIR, { recursive: true });
}

function readJSON(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) { return fallback; }
}

function writeJSON(file, data) {
  ensureDirs();
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function readHistory()    { return readJSON(HISTORY_FILE, []); }
function writeHistory(h)  { writeJSON(HISTORY_FILE, h); }
function readSettings()   { return readJSON(SETTINGS_FILE, { historyEnabled: true }); }
function writeSettings(s) { writeJSON(SETTINGS_FILE, s); }

// ---------- Constants ----------
const SCANNABLE_EXT = ['.js', '.jsx', '.ts', '.tsx', '.py', '.php',
                       '.java', '.rb', '.go', '.json', '.env',
                       '.yaml', '.yml', '.sh', '.bash'];

const SKIP_DIRS = ['node_modules', '.git', 'dist', 'build', 'coverage',
                   '.next', '.nuxt', 'vendor', '__pycache__', '.venv',
                   'venv', 'env', '.idea', '.vscode', 'out', 'target',
                   '.cache', '.parcel-cache'];

// ---------- Read directory ----------
function readDir(dirPath, baseDir = dirPath, files = [], depth = 0) {
  if (depth > 8) return files;
  if (files.length > 500) return files;

  let entries = [];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch (e) { return files; }

  for (const entry of entries) {
    if (files.length > 500) break;

    if (entry.isDirectory()) {
      if (SKIP_DIRS.includes(entry.name)) continue;
      readDir(path.join(dirPath, entry.name), baseDir, files, depth + 1);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      const isEnv = entry.name.startsWith('.env');

      if (!SCANNABLE_EXT.includes(ext) && !isEnv) continue;
      if (entry.name.endsWith('.min.js') || entry.name.endsWith('.min.css')) continue;

      try {
        const fullPath = path.join(dirPath, entry.name);
        const stat = fs.statSync(fullPath);
        if (stat.size > 500 * 1024) continue;

        const content = fs.readFileSync(fullPath, 'utf8').slice(0, 100000);
        const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
        files.push({ path: relativePath, content });
      } catch (e) { /* skip */ }
    }
  }

  return files;
}

function saveToHistory(name, results) {
  const settings = readSettings();
  if (!settings.historyEnabled) return;

  const history = readHistory();
  const record = {
    id: Date.now(),
    date: new Date().toISOString(),
    zipName: name,
    score: results.score,
    totalIssues: results.totalIssues,
    totalFiles: results.totalFiles,
    bySeverity: results.bySeverity,
    issues: results.issues.slice(0, 200)
  };

  history.unshift(record);
  if (history.length > 50) history.length = 50;
  writeHistory(history);
}

// ---------- Window ----------
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#000000',
    title: 'VULNEX',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  Menu.setApplicationMenu(null);
  mainWindow.loadFile('src/index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---------- IPC: file pickers ----------
ipcMain.handle('select-zip', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Archives', extensions: ['zip'] }]
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

// ---------- Scan ZIP ----------
ipcMain.handle('scan-zip', async (event, zipPath) => {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  const files = [];

  entries.forEach(entry => {
    if (entry.isDirectory) return;
    const ext = path.extname(entry.entryName).toLowerCase();
    const isEnv = entry.entryName.includes('.env');
    if (!SCANNABLE_EXT.includes(ext) && !isEnv) return;

    files.push({
      path: entry.entryName,
      content: entry.getData().toString('utf8').slice(0, 100000)
    });
  });

  const results = await scanProject(files, (progress) => {
    event.sender.send('scan-progress', progress);
  });

  saveToHistory(path.basename(zipPath), results);
  return results;
});

// ---------- Scan Folder ----------
ipcMain.handle('scan-folder', async (event, folderPath) => {
  const files = readDir(folderPath);
  const results = await scanProject(files, (progress) => {
    event.sender.send('scan-progress', progress);
  });
  saveToHistory(path.basename(folderPath) + '/', results);
  return results;
});

// ---------- Scan GitHub ----------
ipcMain.handle('scan-github', async (event, repoUrl) => {
  let url = repoUrl.trim();
  if (!url.startsWith('http')) url = 'https://' + url;

  const match = url.match(/github\.com\/([^\/]+)\/([^\/\s?#]+)/i);
  if (!match) {
    throw new Error('Invalid GitHub URL. Format: https://github.com/user/repo');
  }

  const [, owner, repoRaw] = match;
  const repo = repoRaw.replace(/\.git$/, '').replace(/\/$/, '');
  const repoName = `${owner}-${repo}`;
  const clonePath = path.join(REPOS_DIR, repoName);

  event.sender.send('scan-progress', {
    current: 0, total: 1, currentFile: `Cloning ${owner}/${repo}...`,
    issuesFound: 0, percent: 5
  });

  try {
    if (fs.existsSync(clonePath)) {
      fs.rmSync(clonePath, { recursive: true, force: true });
    }
  } catch (e) { /* ignore */ }

  try {
    execSync(`git clone --depth 1 "${url}" "${clonePath}"`, {
      stdio: 'pipe',
      timeout: 90000
    });
  } catch (err) {
    const msg = (err.stderr && err.stderr.toString()) || err.message || '';
    if (msg.includes('not found') || msg.includes('does not exist') || msg.includes('404')) {
      throw new Error('Repo not found or is private. Only public repos are supported.');
    }
    if (msg.includes('git: command not found') || msg.includes('not recognized')) {
      throw new Error('Git is not installed. Get it from https://git-scm.com');
    }
    throw new Error('Failed to clone repo: ' + msg.slice(0, 200));
  }

  event.sender.send('scan-progress', {
    current: 0, total: 1, currentFile: `Scanning ${owner}/${repo}...`,
    issuesFound: 0, percent: 15
  });

  const files = readDir(clonePath);
  const results = await scanProject(files, (progress) => {
    event.sender.send('scan-progress', progress);
  });

  saveToHistory(`github:${owner}/${repo}`, results);
  return results;
});

// ---------- Scan Raw Code (LIVE EDITOR) ----------
ipcMain.handle('scan-code', async (event, code) => {
  console.log('[VULNEX] scan-code called with', (code || '').length, 'chars');

  try {
    const file = { path: 'live-editor.js', content: code || '' };

    // Run through the full scanner (which enriches with details)
    const results = await scanProject([file], null);

    // Results already contain score, bySeverity, issues with details
    // Just rename the file path to something friendlier for the UI
    const cleanIssues = results.issues.map(issue => ({
      ...issue,
      file: 'live-editor.js'
    }));

    const output = {
      score: results.score,
      issues: cleanIssues,
      bySeverity: results.bySeverity,
      totalIssues: results.totalIssues
    };

    console.log('[VULNEX] scan-code returning:', output.totalIssues, 'issues, score', output.score);
    return output;

  } catch (err) {
    console.error('[VULNEX] scan-code FATAL:', err);
    return {
      score: 100,
      issues: [],
      bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
      totalIssues: 0,
      error: err.message
    };
  }
});

// ---------- Save report ----------
ipcMain.handle('save-report', async (event, content) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save VULNEX Report',
    defaultPath: `vulnex-report-${Date.now()}.txt`,
    filters: [{ name: 'Text Report', extensions: ['txt'] }]
  });
  if (result.canceled) return null;
  fs.writeFileSync(result.filePath, content, 'utf8');
  return result.filePath;
});

// ---------- History ----------
ipcMain.handle('history-list', async () => {
  const history = readHistory();
  return history.map(h => ({
    id: h.id, date: h.date, zipName: h.zipName,
    score: h.score, totalIssues: h.totalIssues,
    totalFiles: h.totalFiles, bySeverity: h.bySeverity
  }));
});

ipcMain.handle('history-get', async (event, id) => {
  const history = readHistory();
  const record = history.find(h => h.id === id);
  if (!record) return null;
  return {
    totalFiles: record.totalFiles, totalIssues: record.totalIssues,
    score: record.score, issues: record.issues,
    bySeverity: record.bySeverity, zipName: record.zipName
  };
});

ipcMain.handle('history-delete', async (event, id) => {
  const history = readHistory();
  writeHistory(history.filter(h => h.id !== id));
  return true;
});

ipcMain.handle('history-clear', async () => {
  writeHistory([]);
  return true;
});

// ---------- Settings ----------
ipcMain.handle('settings-get', async () => readSettings());
ipcMain.handle('settings-set', async (event, patch) => {
  const next = { ...readSettings(), ...patch };
  writeSettings(next);
  return next;
});

// ---------- AI ----------
ipcMain.handle('ai-check', async () => {
  const { checkOllama } = require('./src/scanner/ai');
  return await checkOllama();
});

ipcMain.handle('ai-explain', async (event, issue) => {
  const { explainIssue } = require('./src/scanner/ai');
  return new Promise((resolve, reject) => {
    let fullText = '';
    explainIssue(
      issue,
      (chunk) => { fullText += chunk; event.sender.send('ai-chunk', chunk); },
      () => resolve(fullText),
      (err) => reject(err)
    );
  });
});