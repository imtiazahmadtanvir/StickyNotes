const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  openNoteWindow: (id) => ipcRenderer.send('open-note-window', id),
  closeNoteWindow: (id) => ipcRenderer.send('close-note-window', id),
  setAlwaysOnTop: (id, isPinned) => ipcRenderer.send('set-always-on-top', { id, isPinned }),
  createNewNote: () => ipcRenderer.send('create-new-note'),
  broadcastNoteChange: () => ipcRenderer.send('broadcast-note-change'),
  onNotesUpdated: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('notes-updated', handler);
    return () => ipcRenderer.removeListener('notes-updated', handler);
  },
});
