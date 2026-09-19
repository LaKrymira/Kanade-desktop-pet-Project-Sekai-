const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopPet', {
  moveWindow: (x, y) => ipcRenderer.send('window:move', { x, y }),
  quit: () => ipcRenderer.send('app:quit'),
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  selectLocalUpdate: () => ipcRenderer.invoke('update:select-local')
});
