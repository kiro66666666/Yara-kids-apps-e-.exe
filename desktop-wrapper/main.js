const { app, BrowserWindow, dialog, nativeImage, shell } = require('electron');
const fs = require('fs');
const path = require('path');

const PRODUCTION_URL = 'https://yara-kids-b48ed.web.app/';
const LATEST_RELEASE_API_URL = 'https://api.github.com/repos/kiro66666666/Yara-kids-apps-e-.exe/releases/latest';
const WINDOW_ICON_PATH = path.join(__dirname, 'assets', 'icon.ico');
const WINDOW_ICON_PNG_PATH = path.join(__dirname, 'assets', 'icon.png');
const BRANDING_METADATA_PATH = path.join(__dirname, 'assets', 'branding.json');
const PERSISTENT_PARTITION = 'persist:yara-kids';

const DEFAULT_BRANDING = {
  title: 'YARA Kids',
  description: 'Moda infantil com amor e conforto.',
  themeColor: '#ff69b4',
  siteUrl: PRODUCTION_URL
};

app.setName('YARA Kids');
app.setAppUserModelId('com.yarakids.desktop');
app.setPath('userData', path.join(app.getPath('appData'), 'YARA Kids Desktop'));
const RUNTIME_BRANDING_PATH = path.join(app.getPath('userData'), 'runtime-branding.json');

let mainWindow = null;
let splashWindow = null;
let hasCheckedForUpdates = false;

const singleInstanceLock = app.requestSingleInstanceLock();
if (!singleInstanceLock) {
  app.quit();
}

function loadBranding() {
  const buildBranding = readJsonFile(BRANDING_METADATA_PATH);
  const runtimeBranding = readJsonFile(RUNTIME_BRANDING_PATH);
  return { ...DEFAULT_BRANDING, ...buildBranding, ...runtimeBranding };
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return {};
  }
}

function writeJsonFile(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildSplashHtml(branding) {
  const iconDataUrl = fs.existsSync(WINDOW_ICON_PNG_PATH)
    ? nativeImage.createFromPath(WINDOW_ICON_PNG_PATH).toDataURL()
    : '';
  const heroMediaUrl =
    branding.splashMediaUrl ||
    branding.heroMediaUrl ||
    branding.bannerMediaUrl ||
    branding.logoUrl ||
    branding.appIconUrl ||
    branding.faviconUrl ||
    iconDataUrl;
  const heroMediaKind =
    branding.splashMediaKind ||
    (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(String(heroMediaUrl || '')) ? 'video' : 'image');
  const title = escapeHtml(branding.title || DEFAULT_BRANDING.title);
  const description = escapeHtml(branding.description || DEFAULT_BRANDING.description);
  const themeColor = branding.themeColor || DEFAULT_BRANDING.themeColor;

  return `<!DOCTYPE html>
  <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${title}</title>
      <style>
        :root {
          color-scheme: light;
          --brand: ${themeColor};
          --bg: #fff6fb;
          --card: rgba(255, 255, 255, 0.92);
          --text: #1f2937;
          --muted: #6b7280;
        }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          min-height: 100vh;
          display: grid;
          place-items: center;
          font-family: "Segoe UI", "Poppins", sans-serif;
          background:
            radial-gradient(circle at top, rgba(255,255,255,0.95), transparent 55%),
            linear-gradient(145deg, var(--bg), #ffffff 30%, rgba(255, 105, 180, 0.14));
          color: var(--text);
        }
        .shell {
          width: min(520px, calc(100vw - 48px));
          padding: 32px;
          border-radius: 28px;
          background: var(--card);
          border: 1px solid rgba(255, 105, 180, 0.12);
          box-shadow: 0 24px 60px rgba(255, 105, 180, 0.18);
        }
        .hero {
          display: flex;
          align-items: center;
          gap: 18px;
        }
        .hero img {
          width: 78px;
          height: 78px;
          border-radius: 22px;
          box-shadow: 0 10px 25px rgba(255, 105, 180, 0.22);
        }
        h1 {
          margin: 0 0 6px;
          font-size: 28px;
          line-height: 1.1;
        }
        p {
          margin: 0;
          font-size: 14px;
          line-height: 1.5;
          color: var(--muted);
        }
        .status {
          margin-top: 28px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 18px;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.82);
          border: 1px solid rgba(255, 105, 180, 0.12);
        }
        .dot {
          width: 12px;
          height: 12px;
          border-radius: 999px;
          background: var(--brand);
          animation: pulse 1.3s ease-in-out infinite;
        }
        .foot {
          margin-top: 18px;
          font-size: 12px;
          color: var(--muted);
        }
        .preview {
          margin-top: 24px;
          border-radius: 22px;
          overflow: hidden;
          border: 1px solid rgba(255, 105, 180, 0.14);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.7);
          background: linear-gradient(135deg, rgba(255, 240, 245, 0.9), rgba(255, 255, 255, 0.98));
          min-height: 120px;
          display: grid;
          place-items: center;
        }
        .preview img {
          width: 100%;
          max-height: 170px;
          object-fit: cover;
          display: block;
        }
        .preview video {
          width: 100%;
          max-height: 190px;
          object-fit: cover;
          display: block;
          background: #000;
        }
        .audio-toggle {
          position: absolute;
          right: 12px;
          bottom: 12px;
          border: 0;
          border-radius: 999px;
          padding: 10px 14px;
          background: rgba(17, 24, 39, 0.72);
          color: #fff;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          backdrop-filter: blur(8px);
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.35); opacity: 0.55; }
        }
      </style>
    </head>
    <body>
      <div class="shell">
        <div class="hero">
          ${iconDataUrl ? `<img src="${iconDataUrl}" alt="${title}">` : ''}
          <div>
            <h1>${title}</h1>
            <p>${description}</p>
          </div>
        </div>
        <div class="status">
          <div class="dot"></div>
          <p>Carregando loja, sessão salva e serviços do aplicativo.</p>
        </div>
        <div class="preview">
          ${heroMediaUrl
            ? heroMediaKind === 'video'
              ? `<video id="heroMedia" src="${escapeHtml(heroMediaUrl)}" autoplay muted loop playsinline></video><button class="audio-toggle" onclick="const media=document.getElementById('heroMedia'); media.muted=!media.muted; this.textContent=media.muted?'Ativar som':'Mutar';">Ativar som</button>`
              : `<img src="${escapeHtml(heroMediaUrl)}" alt="${title}">`
            : '<p>Branding sincronizado com o site.</p>'}
        </div>
        <div class="foot">Versão ${escapeHtml(app.getVersion())}</div>
      </div>
    </body>
  </html>`;
}

function createSplashWindow(branding) {
  splashWindow = new BrowserWindow({
    width: 560,
    height: 320,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    closable: false,
    frame: false,
    transparent: false,
    show: true,
    center: true,
    alwaysOnTop: true,
    icon: WINDOW_ICON_PATH,
    backgroundColor: '#fff6fb',
    webPreferences: {
      contextIsolation: true,
      sandbox: true
    }
  });

  splashWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(buildSplashHtml(branding))}`);
}

function closeSplashWindow() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
  }
  splashWindow = null;
}

function versionFromText(value) {
  return String(value || '').match(/\d+\.\d+\.\d+/)?.[0] || null;
}

function compareVersions(left, right) {
  const leftParts = String(left).split('.').map((value) => Number.parseInt(value, 10) || 0);
  const rightParts = String(right).split('.').map((value) => Number.parseInt(value, 10) || 0);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftPart = leftParts[index] || 0;
    const rightPart = rightParts[index] || 0;
    if (leftPart > rightPart) return 1;
    if (leftPart < rightPart) return -1;
  }

  return 0;
}

async function checkForUpdates(parentWindow) {
  if (hasCheckedForUpdates) return;
  hasCheckedForUpdates = true;

  try {
    const response = await fetch(LATEST_RELEASE_API_URL, {
      headers: {
        'User-Agent': 'YARA-Kids-Desktop',
        Accept: 'application/vnd.github+json'
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub release feed returned ${response.status}`);
    }

    const release = await response.json();
    const windowsAsset = Array.isArray(release.assets)
      ? release.assets.find((asset) => typeof asset?.name === 'string' && asset.name.toLowerCase().endsWith('.exe'))
      : null;

    const installedVersion = app.getVersion();
    const latestVersion =
      versionFromText(windowsAsset?.name) ||
      versionFromText(release.name) ||
      versionFromText(release.tag_name);

    if (!latestVersion || compareVersions(latestVersion, installedVersion) <= 0) {
      return;
    }

    const { response: buttonIndex } = await dialog.showMessageBox(parentWindow, {
      type: 'info',
      title: 'Atualização disponível',
      buttons: ['Baixar atualização', 'Depois'],
      defaultId: 0,
      cancelId: 1,
      message: `Existe uma nova versão do YARA Kids (${latestVersion}).`,
      detail: `Versão instalada: ${installedVersion}\nVersão mais recente: ${latestVersion}\nO instalador oficial será aberto no release do GitHub para você baixar e atualizar sem perder os dados locais.`
    });

    if (buttonIndex === 0) {
      shell.openExternal(windowsAsset?.browser_download_url || release.html_url);
    }
  } catch (error) {
    console.warn(`Update check skipped: ${error.message}`);
  }
}

async function syncRuntimeBranding() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  try {
    const runtimeBranding = await mainWindow.webContents.executeJavaScript(`
      (() => {
        const parseJson = (value) => {
          try {
            return JSON.parse(value || 'null') || {};
          } catch (error) {
            return {};
          }
        };

        const cached = parseJson(localStorage.getItem('yarakids_branding'));
        const icon = document.getElementById('appIcon');
        const appleIcon = document.getElementById('appAppleIcon');
        const shortcutIcon = document.getElementById('appShortcutIcon');
        const themeColor = document.querySelector('meta[name="theme-color"]')?.getAttribute('content');
        const description = document.querySelector('meta[name="description"]')?.getAttribute('content');
        const appTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]')?.getAttribute('content') || document.title;

        return {
          ...cached,
          title: appTitle || null,
          description: description || null,
          themeColor: themeColor || null,
          faviconUrl: icon?.href || shortcutIcon?.href || cached.faviconUrl || null,
          appIconUrl: cached.appIconUrl || appleIcon?.href || null,
          logoUrl: cached.logoUrl || null,
          splashMediaUrl:
            cached.splashMediaUrl ||
            cached.heroMediaUrl ||
            cached.bannerMediaUrl ||
            cached.bannerVideoUrl ||
            cached.bannerImageUrl ||
            cached.heroVideoUrl ||
            cached.heroImageUrl ||
            (Array.isArray(cached.banners) ? cached.banners.flatMap((item) => {
              if (!item) return [];
              if (typeof item === 'string') return [item];
              return [item.videoUrl, item.imageUrl, item.mediaUrl, item.url];
            }).find(Boolean) : null) ||
            (Array.isArray(cached.slides) ? cached.slides.flatMap((item) => {
              if (!item) return [];
              if (typeof item === 'string') return [item];
              return [item.videoUrl, item.imageUrl, item.mediaUrl, item.url];
            }).find(Boolean) : null) ||
            null,
          splashMediaKind:
            cached.splashMediaKind ||
            (Array.isArray(cached.banners) ? (cached.banners.some((item) => item?.videoUrl) ? 'video' : null) : null) ||
            (Array.isArray(cached.slides) ? (cached.slides.some((item) => item?.videoUrl) ? 'video' : null) : null) ||
            null,
          iconVersion: cached.iconVersion || 0,
          siteUrl: location.origin + '/'
        };
      })();
    `);

    if (!runtimeBranding || typeof runtimeBranding !== 'object') return;

    const mergedBranding = { ...loadBranding(), ...runtimeBranding };
    writeJsonFile(RUNTIME_BRANDING_PATH, mergedBranding);

    if (mergedBranding.title && !mainWindow.isDestroyed()) {
      mainWindow.setTitle(mergedBranding.title);
    }
  } catch (error) {
    console.warn(`Runtime branding sync skipped: ${error.message}`);
  }
}

async function handleLoadFailure(errorCode, errorDescription) {
  if (!mainWindow || errorCode === -3) return;

  closeSplashWindow();
  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }

  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title: 'Falha ao carregar a loja',
    buttons: ['Tentar novamente', 'Fechar aplicativo'],
    defaultId: 0,
    cancelId: 1,
    message: 'O aplicativo não conseguiu abrir o site da YARA Kids.',
    detail: `Detalhe técnico: ${errorDescription || 'erro desconhecido'}`
  });

  if (response === 0) {
    mainWindow.loadURL(PRODUCTION_URL);
    return;
  }

  app.quit();
}

function createMainWindow(branding) {
  mainWindow = new BrowserWindow({
    show: false,
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    autoHideMenuBar: true,
    title: branding.title || DEFAULT_BRANDING.title,
    icon: WINDOW_ICON_PATH,
    frame: true,
    minimizable: true,
    maximizable: true,
    closable: true,
    backgroundColor: branding.themeColor || '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: PERSISTENT_PARTITION
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('did-finish-load', () => {
    closeSplashWindow();
    if (!mainWindow.isVisible()) {
      mainWindow.maximize();
      mainWindow.show();
    }
    syncRuntimeBranding();
    setTimeout(() => checkForUpdates(mainWindow), 1500);
  });

  mainWindow.webContents.on('did-fail-load', (_, errorCode, errorDescription, __, isMainFrame) => {
    if (!isMainFrame) return;
    handleLoadFailure(errorCode, errorDescription);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.loadURL(PRODUCTION_URL);
}

if (singleInstanceLock) {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    const branding = loadBranding();
    createSplashWindow(branding);
    createMainWindow(branding);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        const nextBranding = loadBranding();
        createSplashWindow(nextBranding);
        createMainWindow(nextBranding);
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
