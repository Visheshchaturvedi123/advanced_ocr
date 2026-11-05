const { contextBridge, ipcRenderer } = require('electron');

const subscribe = (channel, callback) => {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

contextBridge.exposeInMainWorld('screenOcr', {
  capture: () => ipcRenderer.send('capture:start'),
  repeat: () => ipcRenderer.send('capture:repeat'),
  cancelCapture: () => ipcRenderer.send('overlay:cancel'),
  selectRegion: (rect) => ipcRenderer.send('overlay:selection', rect),
  onCapture: (callback) => subscribe('capture:result', callback),
  ocr: (image, language, math = false, table = false) => ipcRenderer.invoke('ocr:run', { image, language, math, table }),
  onProgress: (callback) => subscribe('ocr:progress', callback),
  copyText: (text) => ipcRenderer.invoke('clipboard:write', text),
  readClipboardImage: () => ipcRenderer.invoke('clipboard:read-image'),
  openImage: () => ipcRenderer.invoke('dialog:open-image'),
  saveText: (text, extension) => ipcRenderer.invoke('dialog:save', { text, extension }),
  info: () => ipcRenderer.invoke('app:info'),
});
