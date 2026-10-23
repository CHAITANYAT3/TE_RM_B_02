const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vulnex', {
  // File pickers
  selectZip:    ()     => ipcRenderer.invoke('select-zip'),
  selectFolder: ()     => ipcRenderer.invoke('select-folder'),

  // Scans
  scanZip:      (p)    => ipcRenderer.invoke('scan-zip', p),
  scanFolder:   (p)    => ipcRenderer.invoke('scan-folder', p),
  scanGithub:   (url)  => ipcRenderer.invoke('scan-github', url),
  scanCode:     (code) => ipcRenderer.invoke('scan-code', code),

  // Report
  saveReport:   (c)    => ipcRenderer.invoke('save-report', c),

  // Progress stream
  onProgress:   (cb)   => ipcRenderer.on('scan-progress', (_, data) => cb(data)),

  // History
  historyList:   ()   => ipcRenderer.invoke('history-list'),
  historyGet:    (id) => ipcRenderer.invoke('history-get', id),
  historyDelete: (id) => ipcRenderer.invoke('history-delete', id),
  historyClear:  ()   => ipcRenderer.invoke('history-clear'),

  // Settings
  settingsGet: ()      => ipcRenderer.invoke('settings-get'),
  settingsSet: (patch) => ipcRenderer.invoke('settings-set', patch),

  // AI
  aiCheck:   ()      => ipcRenderer.invoke('ai-check'),
  aiExplain: (issue) => ipcRenderer.invoke('ai-explain', issue),
  onAiChunk: (cb)    => ipcRenderer.on('ai-chunk', (_, data) => cb(data))
});