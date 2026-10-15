const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  openNoteWindow: (id, options) => ipcRenderer.send('open-note-window', id, options),
  closeNoteWindow: (id) => ipcRenderer.send('close-note-window', id),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  setAlwaysOnTop: (id, isPinned) => ipcRenderer.send('set-always-on-top', { id, isPinned }),
  createNewNote: () => ipcRenderer.send('create-new-note'),
  openHubWindow: () => ipcRenderer.send('open-hub-window'),
  broadcastNoteChange: () => ipcRenderer.send('broadcast-note-change'),
  onNotesUpdated: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('notes-updated', handler);
    return () => ipcRenderer.removeListener('notes-updated', handler);
  },
  onWindowBoundsUpdated: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('note-bounds-changed', handler);
    return () => ipcRenderer.removeListener('note-bounds-changed', handler);
  },
});
