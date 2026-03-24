const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('yaraKidsNative', {
  platform: 'windows-desktop',
  wrapper: 'electron'
});
