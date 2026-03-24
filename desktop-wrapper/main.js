const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

const PRODUCTION_URL = 'https://yara-kids-b48ed.web.app/';
const WINDOW_ICON_PATH = path.join(__dirname, 'assets', 'icon.ico');

function createWindow() {
  const mainWindow = new BrowserWindow({
    show: false,
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    autoHideMenuBar: true,
    title: 'YARA Kids',
    icon: WINDOW_ICON_PATH,
    frame: true,
    minimizable: true,
    maximizable: false,
    closable: true,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.loadURL(PRODUCTION_URL);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
