const { app, BrowserWindow, globalShortcut, ipcMain, screen } = require('electron');
const path = require('path');
const { LcuConnector } = require('./lcu_connector');

let overlayWindow = null;
let isClickThrough = true;
let isVisible = true;
let demoMode = process.env.DEMO_MODE === 'true' ? 'champSelect' : null;
let pollTick = 0;
const connector = new LcuConnector();

function createOverlayWindow() {
  // On macOS, hiding the Dock icon (NSApplicationActivationPolicyAccessory) combined with
  // type: 'panel' allows the transparent overlay window to float over Fullscreen games & Spaces!
  if (process.platform === 'darwin' && app.dock) {
    app.dock.hide();
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { x, y, width, height } = primaryDisplay.bounds;

  overlayWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    type: 'panel',
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Ensure it floats above Fullscreen & Borderless games on macOS across all Spaces
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1);

  // CRITICAL: Start in click-through mode so the rest of the screen is NEVER blocked!
  // forward: true still sends mousemove events to the renderer so hovering topbar buttons works!
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });

  overlayWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });
}

function toggleOverlayVisibility() {
  if (!overlayWindow) return;
  if (isVisible) {
    overlayWindow.hide();
    isVisible = false;
  } else {
    overlayWindow.showInactive();
    overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    isVisible = true;
  }
}

function setClickThrough(enabled) {
  if (!overlayWindow) return;
  isClickThrough = enabled;
  if (isClickThrough) {
    overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  } else {
    overlayWindow.setIgnoreMouseEvents(false);
  }
  overlayWindow.webContents.send('overlay-mode-changed', {
    isClickThrough,
    demoMode
  });
}

async function pollLeagueState() {
  if (!overlayWindow || !isVisible) return;
  pollTick++;

  // Periodically re-assert macOS Fullscreen Space & Always-On-Top level so switching into LoL never hides the HUD
  if (pollTick % 3 === 1) {
    overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  }

  // If user enabled Demo Mode in UI, serve interactive demo data
  if (demoMode) {
    const data = connector.getDemoData(demoMode, pollTick);
    overlayWindow.webContents.send('league-state-update', {
      connected: true,
      demoMode,
      isClickThrough,
      ...data
    });
    return;
  }

  // 1. Check if an active Live Match is running on Port 2999
  try {
    const liveData = await connector.getLiveGameData();
    overlayWindow.webContents.send('league-state-update', {
      connected: true,
      demoMode: null,
      isClickThrough,
      ...liveData
    });
    return;
  } catch (e) {
    // Port 2999 not responding yet or not in an active match
  }

  // 2. Check League Client (LCU) Gameflow Phase
  try {
    const phase = await connector.lcuRequest('/lol-gameflow/v1/gameflow-phase');

    if (phase === 'ChampSelect') {
      const champSelectData = await connector.getChampSelectData();
      overlayWindow.webContents.send('league-state-update', {
        connected: true,
        demoMode: null,
        isClickThrough,
        ...champSelectData
      });
      return;
    }

    // Fallback if LCU reports InProgress / GameStart while Port 2999 is still initializing (Loading Screen)
    if (phase === 'InProgress' || phase === 'GameStart') {
      const fallbackData = await connector.getLcuInProgressFallback();
      overlayWindow.webContents.send('league-state-update', {
        connected: true,
        demoMode: null,
        isClickThrough,
        ...fallbackData
      });
      return;
    }

    // Connected to League Client, e.g. Lobby / Matchmaking / None
    const currentSummoner = await connector.lcuRequest('/lol-summoner/v1/current-summoner').catch(() => null);
    overlayWindow.webContents.send('league-state-update', {
      connected: true,
      demoMode: null,
      isClickThrough,
      phase: phase || 'Lobby',
      summoner: currentSummoner
        ? `${currentSummoner.gameName || currentSummoner.displayName}#${currentSummoner.tagLine || ''}`
        : 'Connected'
    });
  } catch (err) {
    // Neither Live Game nor LCU running
    overlayWindow.webContents.send('league-state-update', {
      connected: false,
      demoMode: null,
      isClickThrough,
      phase: 'Disconnected'
    });
  }
}

app.whenReady().then(() => {
  createOverlayWindow();

  // Global Hotkeys for macOS
  // Command+Shift+O -> Show / Hide Overlay
  globalShortcut.register('CommandOrControl+Shift+O', () => {
    toggleOverlayVisibility();
  });

  // Command+Shift+L -> Lock / Unlock Click-Through Mode (so clicks pass into LoL)
  globalShortcut.register('CommandOrControl+Shift+L', () => {
    setClickThrough(!isClickThrough);
  });

  // IPC handlers from Renderer UI
  ipcMain.on('set-demo-mode', (_event, mode) => {
    demoMode = mode; // 'champSelect' | 'inGame' | null
    pollLeagueState();
  });

  ipcMain.on('toggle-click-through', () => {
    setClickThrough(!isClickThrough);
  });

  ipcMain.on('set-ignore-mouse-events', (_event, ignore) => {
    if (!overlayWindow) return;
    // Only dynamically toggle when global lock isn't forced off
    if (ignore) {
      overlayWindow.setIgnoreMouseEvents(true, { forward: true });
    } else {
      overlayWindow.setIgnoreMouseEvents(false);
    }
  });

  ipcMain.on('quit-app', () => {
    app.quit();
  });

  // Start polling loop every 2 seconds
  setInterval(pollLeagueState, 2000);
  setTimeout(pollLeagueState, 600);
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
