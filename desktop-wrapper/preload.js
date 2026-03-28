const { contextBridge, ipcRenderer } = require('electron');

const ALLOWED_ORIGINS = new Set([
  'https://yara-kids-b48ed.web.app',
  'https://yara-kids-b48ed.firebaseapp.com'
]);

function sendSiteReady(detail = {}) {
  ipcRenderer.send('yara-kids:site-ready', detail && typeof detail === 'object' ? detail : {});
}

function sendLauncherConfig(detail = {}) {
  ipcRenderer.send('yara-kids:launcher-config', detail && typeof detail === 'object' ? detail : {});
}

function forwardWindowMessage(event) {
  const message = event?.data;
  if (!message || typeof message !== 'object') {
    return;
  }

  if (event?.origin && !ALLOWED_ORIGINS.has(event.origin)) {
    return;
  }

  if (message.type === 'YARA_KIDS_APP_READY' || message.type === 'yara-kids:app-ready') {
    sendSiteReady(message.detail || {});
  }

  if (message.type === 'YARA_KIDS_LAUNCHER_CONFIG' || message.type === 'yara-kids:launcher-config') {
    sendLauncherConfig(message.detail || {});
  }
}

window.addEventListener('message', forwardWindowMessage);
window.addEventListener('yara-kids:app-ready', (event) => sendSiteReady(event.detail || {}));
window.addEventListener('yara-kids:launcher-config', (event) => sendLauncherConfig(event.detail || {}));

contextBridge.exposeInMainWorld('yaraKidsNative', {
  platform: 'windows-desktop',
  wrapper: 'electron',
  markAppReady: (detail) => sendSiteReady(detail),
  updateLauncherConfig: (detail) => sendLauncherConfig(detail),
  sendLauncherAction: (actionId) => ipcRenderer.send('yara-kids:launcher-action', actionId),
  onLauncherState: (listener) => {
    if (typeof listener !== 'function') {
      return;
    }

    const subscription = (_event, state) => listener(state);
    ipcRenderer.on('yara-kids:launcher-state', subscription);
  }
});
