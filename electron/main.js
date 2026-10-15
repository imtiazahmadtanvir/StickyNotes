const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

let hubWindow = null;
const noteWindows = new Map(); // noteId -> BrowserWindow
let nextProcess = null;

const HOSTED_URL = 'https://sticky-notes-rho-eight.vercel.app';
const APP_URL = process.env.APP_URL || HOSTED_URL;

function ensureServerRunning(callback) {
  // If using the live hosted cloud URL, we don't need any local server!
  if (!APP_URL.startsWith('http://localhost')) {
    callback();
    return;
  }

  function startNext() {
    if (nextProcess) return;
    console.log('Starting local Next.js background server on port 3000...');
    nextProcess = spawn('npx', ['next', 'dev', '-p', '3000'], {
      cwd: path.join(__dirname, '..'),
      shell: true,
      stdio: 'ignore',
    });

    const checkInterval = setInterval(() => {
      const probe = http.get(APP_URL, (res) => {
        if (res.statusCode && res.statusCode < 400) {
          clearInterval(checkInterval);
          callback();
        }
      });
      probe.on('error', () => {});
    }, 500);
  }

  const req = http.get(APP_URL, (res) => {
    if (res.statusCode && res.statusCode < 400) {
      callback();
    } else {
      startNext();
    }
  });

  req.on('error', () => {
    startNext();
  });
}

function createHubWindow() {
  if (hubWindow && !hubWindow.isDestroyed()) {
    hubWindow.focus();
    return;
  }

  const appIconPath = path.join(__dirname, '../public/app-logo.png');

  hubWindow = new BrowserWindow({
    width: 340,
    height: 580,
    minWidth: 280,
    minHeight: 360,
    title: 'Sticky Notes',
    icon: appIconPath,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  hubWindow.loadURL(`${APP_URL}/hub`);

  hubWindow.webContents.on('did-fail-load', () => {
    setTimeout(() => {
      if (hubWindow && !hubWindow.isDestroyed()) {
        hubWindow.loadURL(`${APP_URL}/hub`);
      }
    }, 1000);
  });

  hubWindow.on('closed', () => {
    hubWindow = null;
    if (noteWindows.size === 0) {
      app.quit();
    }
  });
}

function openNoteWindow(noteId, options = {}) {
  if (noteWindows.has(noteId)) {
    const existing = noteWindows.get(noteId);
    if (!existing.isDestroyed()) {
      existing.show();
      existing.focus();
      return;
    }
    noteWindows.delete(noteId);
  }

  const display = screen.getPrimaryDisplay();
  const baseOffset = (noteWindows.size % 6) * 35;
  const defaultX = Math.round(display.workAreaSize.width / 2 - 160 + baseOffset);
  const defaultY = Math.round(display.workAreaSize.height / 2 - 170 + baseOffset);
  const appIconPath = path.join(__dirname, '../public/app-logo.png');

  const width = (options && typeof options.width === 'number' && options.width >= 200) ? Math.round(options.width) : 320;
  const height = (options && typeof options.height === 'number' && options.height >= 160) ? Math.round(options.height) : 340;
  const x = (options && typeof options.x === 'number') ? Math.round(options.x) : defaultX;
  const y = (options && typeof options.y === 'number') ? Math.round(options.y) : defaultY;

  const noteWin = new BrowserWindow({
    width,
    height,
    x,
    y,
    minWidth: 220,
    minHeight: 180,
    title: 'Sticky Note',
    icon: appIconPath,
    frame: false,
    autoHideMenuBar: true,
    alwaysOnTop: !!options.isPinned,
    backgroundColor: '#fff9c4',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  noteWindows.set(noteId, noteWin);

  noteWin.loadURL(`${APP_URL}/note?id=${encodeURIComponent(noteId)}`);

  // Remember window size and position when user resizes or moves
  let boundsTimer = null;
  const notifyBounds = () => {
    if (noteWin.isDestroyed()) return;
    const b = noteWin.getBounds();
    noteWin.webContents.send('note-bounds-changed', {
      id: noteId,
      width: b.width,
      height: b.height,
      positionX: b.x,
      positionY: b.y,
    });
    if (hubWindow && !hubWindow.isDestroyed()) {
      hubWindow.webContents.send('note-bounds-changed', {
        id: noteId,
        width: b.width,
        height: b.height,
        positionX: b.x,
        positionY: b.y,
      });
    }
  };

  noteWin.on('resize', () => {
    clearTimeout(boundsTimer);
    boundsTimer = setTimeout(notifyBounds, 200);
  });

  noteWin.on('moved', () => {
    clearTimeout(boundsTimer);
    boundsTimer = setTimeout(notifyBounds, 200);
  });

  noteWin.webContents.on('did-fail-load', () => {
    setTimeout(() => {
      if (!noteWin.isDestroyed()) {
        noteWin.loadURL(`${APP_URL}/note?id=${encodeURIComponent(noteId)}`);
      }
    }, 1000);
  });

  noteWin.on('closed', () => {
    noteWindows.delete(noteId);
    broadcastChange();
    if (noteWindows.size === 0 && (!hubWindow || hubWindow.isDestroyed())) {
      app.quit();
    }
  });
}

function broadcastChange() {
  if (hubWindow && !hubWindow.isDestroyed()) {
    hubWindow.webContents.send('notes-updated');
  }
  for (const win of noteWindows.values()) {
    if (!win.isDestroyed()) {
      win.webContents.send('notes-updated');
    }
  }
}

// IPC Handlers
ipcMain.on('open-note-window', (event, noteId, options) => {
  openNoteWindow(noteId, options);
});

ipcMain.on('close-note-window', (event, noteId) => {
  if (noteWindows.has(noteId)) {
    const win = noteWindows.get(noteId);
    if (!win.isDestroyed()) {
      win.close();
    }
    noteWindows.delete(noteId);
  }
});

ipcMain.on('set-always-on-top', (event, { id, isPinned }) => {
  if (noteWindows.has(id)) {
    const win = noteWindows.get(id);
    if (!win.isDestroyed()) {
      win.setAlwaysOnTop(isPinned);
    }
  }
});

ipcMain.on('broadcast-note-change', () => {
  broadcastChange();
});

ipcMain.on('create-new-note', () => {
  if (hubWindow && !hubWindow.isDestroyed()) {
    hubWindow.webContents.send('trigger-new-note');
  }
});

ipcMain.on('open-hub-window', () => {
  createHubWindow();
});

ipcMain.on('minimize-window', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) {
    win.minimize();
  }
});

ipcMain.on('close-window', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) {
    win.close();
  }
});

app.whenReady().then(() => {
  ensureServerRunning(() => {
    createHubWindow();
  });

  app.on('activate', () => {
    if (!hubWindow || hubWindow.isDestroyed()) {
      createHubWindow();
    }
  });
});

app.on('will-quit', () => {
  if (nextProcess) {
    try {
      nextProcess.kill();
    } catch {}
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
