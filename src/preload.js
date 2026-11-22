const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('poromac', {
  onLeagueStateUpdate: (callback) => {
    ipcRenderer.on('league-state-update', (_event, data) => callback(data));
  },
  onOverlayModeChanged: (callback) => {
    ipcRenderer.on('overlay-mode-changed', (_event, data) => callback(data));
  },
  setDemoMode: (mode) => {
    ipcRenderer.send('set-demo-mode', mode);
  },
  toggleClickThrough: () => {
    ipcRenderer.send('toggle-click-through');
  },
  setIgnoreMouseEvents: (ignore) => {
    ipcRenderer.send('set-ignore-mouse-events', ignore);
  },
  quitApp: () => {
    ipcRenderer.send('quit-app');
  }
});
