const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { spawn } = require('child_process');
const { createHash } = require('crypto');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');

const DEFAULT_SITE_URL = 'https://yara-kids-b48ed.web.app/';
const NATIVE_APPS_REPO = 'https://github.com/kiro66666666/Yara-kids-apps-e-.exe';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRraGt2ZGF5ZHZqamtxdXZ6aGl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExMjk4MTgsImV4cCI6MjA4NjcwNTgxOH0.-MsZ6nqqFZp2z2Joa__fIiLNWJV18DDxx-zmZvhwh2w';
const PUBLIC_CONFIG_URL = 'https://dkhkvdaydvjjkquvzhit.supabase.co/functions/v1/launcher-config';
const PUBLIC_MANIFEST_URL = `${NATIVE_APPS_REPO}/releases/latest/download/YARA-Kids.windows.manifest.json`;
const LATEST_RELEASE_API_URL = 'https://api.github.com/repos/kiro66666666/Yara-kids-apps-e-.exe/releases/latest';

const WINDOW_ICON_PATH = path.join(__dirname, 'assets', 'icon.ico');
const BRANDING_METADATA_PATH = path.join(__dirname, 'assets', 'branding.json');
const LAUNCHER_HTML_PATH = path.join(__dirname, 'assets', 'launcher.html');
const PRELOAD_PATH = path.join(__dirname, 'preload.js');
const PERSISTENT_PARTITION = 'persist:yara-kids';

const DEFAULT_BRANDING = {
  title: 'YARA Kids',
  description: 'Moda infantil com amor e conforto.',
  themeColor: '#ff69b4',
  siteUrl: DEFAULT_SITE_URL,
  splashMediaUrl: null,
  splashMediaKind: 'image'
};

const DEFAULT_WINDOWS_CONFIG = {
  schemaVersion: 1,
  siteUrl: DEFAULT_SITE_URL,
  manifestUrl: PUBLIC_MANIFEST_URL,
  launcher: {
    title: DEFAULT_BRANDING.title,
    description: DEFAULT_BRANDING.description,
    themeColor: DEFAULT_BRANDING.themeColor,
    mediaUrl: null,
    mediaKind: 'image',
    posterUrl: null,
    accentLabel: 'Windows launcher',
    footnote: 'Aplicativo oficial Windows',
    readyTimeoutMs: 12000,
    bootstrapTimeoutMs: 4500,
    handoffDelayMs: 360
  }
};

app.setName('YARA Kids');
app.setAppUserModelId('com.yarakids.desktop');
app.setPath('userData', path.join(app.getPath('appData'), 'YARA Kids Desktop'));

const RUNTIME_BRANDING_PATH = path.join(app.getPath('userData'), 'runtime-branding.json');
const RUNTIME_CONFIG_PATH = path.join(app.getPath('userData'), 'runtime-config.json');
const RUNTIME_MANIFEST_PATH = path.join(app.getPath('userData'), 'runtime-manifest.json');

let launcherWindow = null;
let mainWindow = null;
let launcherDidLoad = false;
let launcherState = null;
let runtimeContext = null;
let readyFallbackTimer = null;
let bootstrapInFlight = false;
let updateInProgress = false;
let releaseApiManifestChecked = false;
let siteReadyHandled = false;

const singleInstanceLock = app.requestSingleInstanceLock();
if (!singleInstanceLock) {
  app.quit();
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return null;
  }
}

function writeJsonFile(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function firstString(...values) {
  return values.find((value) => typeof value === 'string' && value.trim()) || null;
}

function clampNumber(value, min, max, fallbackValue) {
  const numericValue = Number.parseInt(value, 10);
  if (!Number.isFinite(numericValue)) return fallbackValue;
  return Math.min(max, Math.max(min, numericValue));
}

function detectMediaKind(url) {
  return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(String(url || '')) ? 'video' : 'image';
}

function normalizeUrl(value, baseUrl) {
  if (!value || typeof value !== 'string') return null;

  try {
    return new URL(value, baseUrl || DEFAULT_SITE_URL).toString();
  } catch (error) {
    return null;
  }
}

function sanitizeThemeColor(value, fallbackValue = DEFAULT_BRANDING.themeColor) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(value || '').trim())
    ? String(value).trim()
    : fallbackValue;
}

function versionFromText(value) {
  return String(value || '').match(/\d+\.\d+\.\d+/)?.[0] || null;
}

function compareVersions(left, right) {
  const leftParts = String(left || '')
    .split('.')
    .map((value) => Number.parseInt(value, 10) || 0);
  const rightParts = String(right || '')
    .split('.')
    .map((value) => Number.parseInt(value, 10) || 0);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftPart = leftParts[index] || 0;
    const rightPart = rightParts[index] || 0;
    if (leftPart > rightPart) return 1;
    if (leftPart < rightPart) return -1;
  }

  return 0;
}

function loadBuildBranding() {
  const buildBranding = readJsonFile(BRANDING_METADATA_PATH) || {};
  const runtimeBranding = readJsonFile(RUNTIME_BRANDING_PATH) || {};
  return { ...DEFAULT_BRANDING, ...buildBranding, ...runtimeBranding };
}

function normalizeWindowsConfig(rawConfig, fallbackBranding = DEFAULT_BRANDING) {
  const source = rawConfig && typeof rawConfig === 'object' ? rawConfig : {};
  const launcherSource = source.launcher && typeof source.launcher === 'object' ? source.launcher : {};
  const brandingSource = source.branding && typeof source.branding === 'object' ? source.branding : {};
  const windowsSource = source.windows && typeof source.windows === 'object' ? source.windows : {};
  const primaryMedia = Array.isArray(source.media)
    ? source.media.find((item) => typeof item?.url === 'string' && item.url.trim())
    : null;
  const siteUrl = normalizeUrl(firstString(source.siteUrl, source.appUrl, brandingSource.siteUrl), DEFAULT_SITE_URL) || DEFAULT_SITE_URL;
  const manifestUrl =
    normalizeUrl(
      firstString(
        source.manifestUrl,
        source.updateManifestUrl,
        windowsSource.manifestUrl,
        launcherSource.windowsManifestUrl
      ),
      siteUrl
    )
    || PUBLIC_MANIFEST_URL;
  const mediaUrl = normalizeUrl(
    firstString(
      primaryMedia?.url,
      launcherSource.mediaUrl,
      launcherSource.splashMediaUrl,
      launcherSource.heroMediaUrl,
      source.splashMediaUrl,
      source.heroMediaUrl,
      fallbackBranding.splashMediaUrl,
      fallbackBranding.heroImageUrl,
      fallbackBranding.bannerImageUrl,
      fallbackBranding.logoUrl
    ),
    siteUrl
  );

  return {
    schemaVersion: Number.parseInt(source.schemaVersion, 10) || 1,
    siteUrl,
    manifestUrl,
    launcher: {
      title: firstString(
        launcherSource.title,
        brandingSource.title,
        source.title,
        fallbackBranding.title,
        DEFAULT_BRANDING.title
      ),
      description: firstString(
        launcherSource.description,
        launcherSource.subtitle,
        brandingSource.subtitle,
        source.description,
        fallbackBranding.description,
        DEFAULT_BRANDING.description
      ),
      themeColor: sanitizeThemeColor(
        firstString(launcherSource.themeColor, brandingSource.themeColor, source.themeColor, fallbackBranding.themeColor),
        DEFAULT_BRANDING.themeColor
      ),
      mediaUrl,
      mediaKind: firstString(primaryMedia?.kind, launcherSource.mediaKind, source.mediaKind) || detectMediaKind(mediaUrl),
      posterUrl: normalizeUrl(firstString(primaryMedia?.posterUrl, launcherSource.posterUrl, source.posterUrl), siteUrl),
      accentLabel: firstString(launcherSource.accentLabel, launcherSource.ctaLabel, brandingSource.ctaLabel, source.accentLabel, 'Windows launcher'),
      footnote: firstString(launcherSource.footnote, windowsSource.currentVersion && `Versao remota ${windowsSource.currentVersion}`, source.footnote, 'Aplicativo oficial Windows'),
      readyTimeoutMs: clampNumber(
        firstString(launcherSource.readyTimeoutMs, source.readyTimeoutMs),
        4000,
        30000,
        DEFAULT_WINDOWS_CONFIG.launcher.readyTimeoutMs
      ),
      bootstrapTimeoutMs: clampNumber(
        firstString(launcherSource.bootstrapTimeoutMs, source.bootstrapTimeoutMs),
        2000,
        12000,
        DEFAULT_WINDOWS_CONFIG.launcher.bootstrapTimeoutMs
      ),
      handoffDelayMs: clampNumber(
        firstString(launcherSource.handoffDelayMs, source.handoffDelayMs),
        120,
        1800,
        DEFAULT_WINDOWS_CONFIG.launcher.handoffDelayMs
      )
    }
  };
}

function normalizeManifest(rawManifest, manifestUrl) {
  if (!rawManifest || typeof rawManifest !== 'object') {
    return null;
  }

  const version = versionFromText(rawManifest.version || rawManifest.tag || rawManifest.tag_name);
  const installerUrl = normalizeUrl(
    firstString(rawManifest.installer?.url, rawManifest.installerUrl, rawManifest.url),
    manifestUrl || PUBLIC_MANIFEST_URL
  );

  if (!version || !installerUrl) {
    return null;
  }

  return {
    schemaVersion: Number.parseInt(rawManifest.schemaVersion, 10) || 1,
    version,
    manifestUrl: manifestUrl || null,
    publishedAt: firstString(rawManifest.publishedAt, rawManifest.createdAt, rawManifest.releaseDate),
    notes: firstString(rawManifest.notes, rawManifest.releaseNotes),
    installer: {
      name: firstString(rawManifest.installer?.name, rawManifest.installerName, 'YARA-Kids-Setup.exe'),
      url: installerUrl,
      sha256: firstString(rawManifest.installer?.sha256, rawManifest.sha256),
      size: Number.parseInt(rawManifest.installer?.size || rawManifest.size, 10) || null
    }
  };
}

function composeLauncherBranding(buildBranding, config) {
  return {
    title: config.launcher.title || buildBranding.title || DEFAULT_BRANDING.title,
    description: config.launcher.description || buildBranding.description || DEFAULT_BRANDING.description,
    themeColor: sanitizeThemeColor(config.launcher.themeColor, buildBranding.themeColor || DEFAULT_BRANDING.themeColor),
    mediaUrl: config.launcher.mediaUrl || normalizeUrl(buildBranding.splashMediaUrl, config.siteUrl),
    mediaKind: config.launcher.mediaKind || detectMediaKind(config.launcher.mediaUrl),
    posterUrl: config.launcher.posterUrl || null,
    accentLabel: config.launcher.accentLabel,
    footnote: config.launcher.footnote,
    siteUrl: config.siteUrl,
    version: app.getVersion()
  };
}

function validateConfigPayload(payload) {
  return Boolean(payload && typeof payload === 'object');
}

async function fetchJson(url, options = {}) {
  const {
    timeoutMs = 5000,
    headers = {},
    accept = 'application/json'
  } = options;
  const signal = AbortSignal.timeout(timeoutMs);
  const isLauncherConfigRequest = url === PUBLIC_CONFIG_URL;
  const response = await fetch(url, {
    headers: {
      Accept: accept,
      'User-Agent': 'YARA-Kids-Desktop',
      ...(isLauncherConfigRequest
        ? {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`
          }
        : {}),
      ...headers
    },
    signal
  });

  if (!response.ok) {
    throw new Error(`Fetch failed (${response.status}) for ${url}`);
  }

  return response.json();
}

async function fetchJsonWithCache({ url, cachePath, timeoutMs, fallbackValue, normalize }) {
  try {
    const networkPayload = await fetchJson(url, { timeoutMs });
    const normalizedNetworkPayload = normalize(networkPayload, url);
    if (normalizedNetworkPayload) {
      writeJsonFile(cachePath, normalizedNetworkPayload);
      return { data: normalizedNetworkPayload, source: 'network' };
    }
  } catch (error) {
    console.warn(`Network fetch skipped for ${url}: ${error.message}`);
  }

  const cachedPayload = normalize(readJsonFile(cachePath), url);
  if (cachedPayload) {
    return { data: cachedPayload, source: 'cache' };
  }

  return { data: fallbackValue, source: fallbackValue ? 'default' : 'missing' };
}

async function resolveReleaseApiManifest() {
  if (releaseApiManifestChecked) {
    return null;
  }

  releaseApiManifestChecked = true;

  try {
    const release = await fetchJson(LATEST_RELEASE_API_URL, { timeoutMs: 5000, accept: 'application/vnd.github+json' });
    const manifestAsset = Array.isArray(release.assets)
      ? release.assets.find((asset) => asset?.name === 'YARA-Kids.windows.manifest.json')
      : null;
    if (!manifestAsset?.browser_download_url) {
      return null;
    }

    const manifestJson = await fetchJson(manifestAsset.browser_download_url, { timeoutMs: 5000 });
    const normalizedManifest = normalizeManifest(manifestJson, manifestAsset.browser_download_url);
    if (!normalizedManifest) {
      return null;
    }

    writeJsonFile(RUNTIME_MANIFEST_PATH, normalizedManifest);
    return normalizedManifest;
  } catch (error) {
    console.warn(`Release API manifest skipped: ${error.message}`);
    return null;
  }
}

async function resolveRuntimeContext() {
  const buildBranding = loadBuildBranding();
  const fallbackConfig = normalizeWindowsConfig(readJsonFile(RUNTIME_CONFIG_PATH) || DEFAULT_WINDOWS_CONFIG, buildBranding);

  const configResult = await fetchJsonWithCache({
    url: PUBLIC_CONFIG_URL,
    cachePath: RUNTIME_CONFIG_PATH,
    timeoutMs: fallbackConfig.launcher.bootstrapTimeoutMs,
    fallbackValue: fallbackConfig,
    normalize: (payload) => (validateConfigPayload(payload) ? normalizeWindowsConfig(payload, buildBranding) : null)
  });

  const config = configResult.data || fallbackConfig;
  const branding = composeLauncherBranding(buildBranding, config);

  const manifestResult = await fetchJsonWithCache({
    url: config.manifestUrl || PUBLIC_MANIFEST_URL,
    cachePath: RUNTIME_MANIFEST_PATH,
    timeoutMs: config.launcher.bootstrapTimeoutMs,
    fallbackValue: normalizeManifest(readJsonFile(RUNTIME_MANIFEST_PATH), config.manifestUrl || PUBLIC_MANIFEST_URL),
    normalize: (payload, manifestUrl) => normalizeManifest(payload, manifestUrl)
  });

  const manifest = manifestResult.data || await resolveReleaseApiManifest();

  return {
    branding,
    config,
    manifest,
    sources: {
      config: configResult.source,
      manifest: manifestResult.source
    }
  };
}

function createInitialLauncherState(branding) {
  return {
    mode: 'booting',
    headline: 'Preparando YARA Kids',
    detail: 'Iniciando o launcher Windows e sincronizando a configuracao publica.',
    progressPercent: 12,
    statusTone: 'info',
    closing: false,
    actions: [
      { id: 'quit', label: 'Fechar', variant: 'secondary' }
    ],
    branding
  };
}

function dispatchLauncherState() {
  if (!launcherWindow || launcherWindow.isDestroyed() || !launcherDidLoad || !launcherState) {
    return;
  }

  launcherWindow.webContents.send('yara-kids:launcher-state', launcherState);
}

function setLauncherState(patch) {
  const nextBranding = patch?.branding
    ? { ...(launcherState?.branding || {}), ...patch.branding }
    : (launcherState?.branding || {});

  launcherState = {
    ...(launcherState || {}),
    ...(patch || {}),
    branding: nextBranding
  };

  if (!Array.isArray(launcherState.actions)) {
    launcherState.actions = [];
  }

  dispatchLauncherState();
}

function createLauncherWindow(branding) {
  launcherWindow = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 980,
    minHeight: 680,
    center: true,
    autoHideMenuBar: true,
    title: branding.title || DEFAULT_BRANDING.title,
    icon: WINDOW_ICON_PATH,
    backgroundColor: '#fff7fb',
    show: true,
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      sandbox: true
    }
  });

  launcherDidLoad = false;
  launcherState = createInitialLauncherState(branding);

  launcherWindow.on('closed', () => {
    launcherDidLoad = false;
    launcherWindow = null;
    if (!mainWindow || !mainWindow.isVisible()) {
      app.quit();
    }
  });

  launcherWindow.webContents.on('did-finish-load', () => {
    launcherDidLoad = true;
    dispatchLauncherState();
  });

  launcherWindow.loadFile(LAUNCHER_HTML_PATH);
}

function closeLauncherWindow() {
  if (launcherWindow && !launcherWindow.isDestroyed()) {
    launcherWindow.destroy();
  }
  launcherWindow = null;
  launcherDidLoad = false;
}

function clearReadyFallbackTimer() {
  clearTimeout(readyFallbackTimer);
  readyFallbackTimer = null;
}

function revealMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (!mainWindow.isVisible()) {
    mainWindow.maximize();
    mainWindow.show();
  }
  mainWindow.focus();
}

function finishLauncherHandoff(detail) {
  if (siteReadyHandled) {
    return;
  }

  siteReadyHandled = true;
  clearReadyFallbackTimer();

  const handoffDelayMs = runtimeContext?.config?.launcher?.handoffDelayMs || DEFAULT_WINDOWS_CONFIG.launcher.handoffDelayMs;
  setLauncherState({
    mode: 'handoff',
    headline: 'Abrindo a loja',
    detail,
    progressPercent: 100,
    statusTone: 'success',
    actions: [],
    closing: true
  });

  revealMainWindow();
  setTimeout(() => {
    closeLauncherWindow();
  }, handoffDelayMs);
}

function armReadyFallback(reasonLabel) {
  clearReadyFallbackTimer();
  const timeoutMs = runtimeContext?.config?.launcher?.readyTimeoutMs || DEFAULT_WINDOWS_CONFIG.launcher.readyTimeoutMs;
  readyFallbackTimer = setTimeout(() => {
    finishLauncherHandoff(`A loja nao enviou o sinal de pronto a tempo; abrindo com contingencia (${reasonLabel}).`);
  }, timeoutMs);
}

function persistRuntimeBranding(patch) {
  if (!patch || typeof patch !== 'object') {
    return;
  }

  const currentBranding = readJsonFile(RUNTIME_BRANDING_PATH) || {};
  writeJsonFile(RUNTIME_BRANDING_PATH, { ...currentBranding, ...patch });
}

async function syncRuntimeBrandingFromSite() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  try {
    const runtimeBranding = await mainWindow.webContents.executeJavaScript(`
      (() => {
        const safeParse = (value) => {
          try {
            return JSON.parse(value || 'null') || {};
          } catch (error) {
            return {};
          }
        };
        const cached = safeParse(localStorage.getItem('yarakids_branding'));
        const themeColor = document.querySelector('meta[name="theme-color"]')?.getAttribute('content');
        const description = document.querySelector('meta[name="description"]')?.getAttribute('content');
        const title = document.querySelector('meta[name="apple-mobile-web-app-title"]')?.getAttribute('content') || document.title;

        return {
          ...cached,
          title: title || null,
          description: description || null,
          themeColor: themeColor || null,
          siteUrl: location.origin + '/'
        };
      })();
    `);

    if (!runtimeBranding || typeof runtimeBranding !== 'object') {
      return;
    }

    persistRuntimeBranding(runtimeBranding);

    if (runtimeBranding.title) {
      mainWindow.setTitle(runtimeBranding.title);
    }
  } catch (error) {
    console.warn(`Runtime branding sync skipped: ${error.message}`);
  }
}

function normalizeLauncherConfigPatch(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const baseSiteUrl = runtimeContext?.config?.siteUrl || DEFAULT_SITE_URL;
  const mediaUrl = normalizeUrl(
    firstString(payload.mediaUrl, payload.splashMediaUrl, payload.heroMediaUrl),
    baseSiteUrl
  );

  return {
    title: firstString(payload.title),
    description: firstString(payload.description),
    themeColor: sanitizeThemeColor(firstString(payload.themeColor), runtimeContext?.branding?.themeColor || DEFAULT_BRANDING.themeColor),
    mediaUrl,
    mediaKind: firstString(payload.mediaKind) || detectMediaKind(mediaUrl),
    posterUrl: normalizeUrl(firstString(payload.posterUrl), baseSiteUrl),
    accentLabel: firstString(payload.accentLabel),
    footnote: firstString(payload.footnote)
  };
}

function createMainWindow(runtime) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return;
  }

  mainWindow = new BrowserWindow({
    show: false,
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    autoHideMenuBar: true,
    title: runtime.branding.title || DEFAULT_BRANDING.title,
    icon: WINDOW_ICON_PATH,
    backgroundColor: runtime.branding.themeColor || '#ffffff',
    webPreferences: {
      preload: PRELOAD_PATH,
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

  mainWindow.webContents.on('did-start-loading', () => {
    if (!siteReadyHandled) {
      setLauncherState({
        mode: 'loading',
        headline: 'Carregando a loja',
        detail: 'Abrindo sessao salva, assets do site e integracoes do wrapper.',
        progressPercent: 72,
        statusTone: 'info',
        actions: [{ id: 'quit', label: 'Fechar', variant: 'secondary' }]
      });
    }
  });

  mainWindow.webContents.on('did-finish-load', async () => {
    if (!siteReadyHandled) {
      setLauncherState({
        mode: 'waiting-site-ready',
        headline: 'Aguardando sinal da loja',
        detail: 'O site carregou. Esperando o evento explicito de app ready ou o timeout de contingencia.',
        progressPercent: 88,
        statusTone: 'info',
        actions: [{ id: 'quit', label: 'Fechar', variant: 'secondary' }]
      });
      armReadyFallback('did-finish-load');
    }

    await syncRuntimeBrandingFromSite();
  });

  mainWindow.webContents.on('did-stop-loading', () => {
    if (!siteReadyHandled && !readyFallbackTimer) {
      armReadyFallback('did-stop-loading');
    }
  });

  mainWindow.webContents.on('did-fail-load', (_, errorCode, errorDescription, __, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) {
      return;
    }

    clearReadyFallbackTimer();
    mainWindow.hide();
    setLauncherState({
      mode: 'offline',
      headline: 'Nao foi possivel abrir a loja',
      detail: `Falha de carregamento: ${errorDescription || 'erro desconhecido'}. Voce pode tentar novamente.`,
      progressPercent: null,
      statusTone: 'error',
      actions: [
        { id: 'retry', label: 'Tentar novamente', variant: 'primary' },
        { id: 'quit', label: 'Fechar', variant: 'secondary' }
      ]
    });
  });

  mainWindow.on('closed', () => {
    clearReadyFallbackTimer();
    mainWindow = null;
    if (launcherWindow && !launcherWindow.isDestroyed()) {
      closeLauncherWindow();
    }
  });
}

function loadMainSite() {
  if (!runtimeContext) {
    return;
  }

  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow(runtimeContext);
  }

  siteReadyHandled = false;
  clearReadyFallbackTimer();
  setLauncherState({
    branding: runtimeContext.branding,
    mode: 'loading',
    headline: 'Entrando na loja',
    detail: 'Carregando a experiencia principal do produto.',
    progressPercent: 56,
    statusTone: 'info',
    actions: [{ id: 'quit', label: 'Fechar', variant: 'secondary' }]
  });
  mainWindow.loadURL(runtimeContext.config.siteUrl);
}

async function downloadAssetToFile(url, destinationPath, onProgress) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/octet-stream',
      'User-Agent': 'YARA-Kids-Desktop'
    }
  });

  if (!response.ok || !response.body) {
    throw new Error(`Falha no download do instalador (${response.status})`);
  }

  const totalBytes = Number.parseInt(response.headers.get('content-length') || '0', 10);
  const writer = fs.createWriteStream(destinationPath);
  const bodyStream = Readable.fromWeb(response.body);
  let downloadedBytes = 0;

  return new Promise((resolve, reject) => {
    bodyStream.on('data', (chunk) => {
      downloadedBytes += chunk.length;
      if (typeof onProgress === 'function') {
        onProgress(downloadedBytes, totalBytes);
      }
    });

    bodyStream.on('error', reject);
    writer.on('error', reject);
    writer.on('finish', resolve);
    bodyStream.pipe(writer);
  });
}

async function computeSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const input = fs.createReadStream(filePath);

    input.on('error', reject);
    input.on('data', (chunk) => hash.update(chunk));
    input.on('end', () => resolve(hash.digest('hex')));
  });
}

function launchSilentInstaller(installerPath) {
  const scriptPath = path.join(app.getPath('temp'), `yara-kids-update-${Date.now()}.cmd`);
  const normalizedInstallerPath = installerPath.replaceAll('/', '\\');
  const script = [
    '@echo off',
    'setlocal',
    'ping 127.0.0.1 -n 4 > nul',
    `"${normalizedInstallerPath}" /S`,
    'ping 127.0.0.1 -n 4 > nul',
    `del "${normalizedInstallerPath}"`,
    'del "%~f0"'
  ].join('\r\n');

  fs.writeFileSync(scriptPath, script, 'utf8');
  const child = spawn('cmd.exe', ['/c', scriptPath], {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
}

async function installAvailableUpdate(manifest) {
  if (!manifest?.installer?.url || updateInProgress) {
    return;
  }

  updateInProgress = true;
  const downloadPath = path.join(app.getPath('temp'), `YARA-Kids-Setup-${manifest.version}.exe`);

  try {
    setLauncherState({
      mode: 'downloading-update',
      headline: `Baixando versao ${manifest.version}`,
      detail: 'Transferindo o instalador oficial do Windows.',
      progressPercent: 0,
      statusTone: 'info',
      actions: [{ id: 'quit', label: 'Fechar', variant: 'secondary' }]
    });

    await downloadAssetToFile(manifest.installer.url, downloadPath, (downloadedBytes, totalBytes) => {
      const progressPercent = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : null;
      setLauncherState({
        mode: 'downloading-update',
        headline: `Baixando versao ${manifest.version}`,
        detail: totalBytes > 0
          ? `${(downloadedBytes / (1024 * 1024)).toFixed(1)} MB de ${(totalBytes / (1024 * 1024)).toFixed(1)} MB`
          : 'Recebendo o instalador oficial.',
        progressPercent,
        statusTone: 'info'
      });
    });

    if (manifest.installer.sha256) {
      setLauncherState({
        mode: 'validating-update',
        headline: 'Validando instalador',
        detail: 'Conferindo a integridade do arquivo baixado antes da instalacao.',
        progressPercent: 100,
        statusTone: 'info',
        actions: []
      });

      const actualSha256 = await computeSha256(downloadPath);
      if (actualSha256.toLowerCase() !== String(manifest.installer.sha256).trim().toLowerCase()) {
        throw new Error('Checksum do instalador nao confere com o manifesto publicado.');
      }
    }

    setLauncherState({
      mode: 'installing-update',
      headline: 'Instalando atualizacao',
      detail: 'O launcher vai abrir o instalador silencioso e encerrar esta instancia.',
      progressPercent: 100,
      statusTone: 'success',
      actions: []
    });

    launchSilentInstaller(downloadPath);
    setTimeout(() => app.quit(), 350);
  } catch (error) {
    updateInProgress = false;
    setLauncherState({
      mode: 'update-failed',
      headline: 'Falha na atualizacao',
      detail: error.message || 'Nao foi possivel baixar ou instalar a atualizacao.',
      progressPercent: null,
      statusTone: 'error',
      actions: [
        { id: 'retry-update', label: 'Tentar atualizar de novo', variant: 'primary' },
        { id: 'continue-current', label: 'Abrir esta versao', variant: 'secondary' }
      ]
    });
    return;
  }
}

async function maybeHandleAvailableUpdate() {
  if (!runtimeContext?.manifest || !app.isPackaged) {
    return false;
  }

  const availableManifest = runtimeContext.manifest;
  if (compareVersions(availableManifest.version, app.getVersion()) <= 0) {
    return false;
  }

  setLauncherState({
    mode: 'update-available',
    headline: `Atualizacao ${availableManifest.version} disponivel`,
    detail: 'O launcher encontrou um manifesto Windows mais novo. Voce pode instalar agora ou abrir a versao atual.',
    progressPercent: null,
    statusTone: 'success',
    actions: [
      { id: 'update-now', label: 'Atualizar agora', variant: 'primary' },
      { id: 'continue-current', label: 'Abrir esta versao', variant: 'secondary' },
      { id: 'quit', label: 'Fechar', variant: 'ghost' }
    ]
  });

  return true;
}

async function bootstrapApplication() {
  if (bootstrapInFlight) {
    return;
  }

  bootstrapInFlight = true;

  try {
    runtimeContext = await resolveRuntimeContext();
    setLauncherState({
      branding: runtimeContext.branding,
      mode: 'checking-update',
      headline: 'Launcher sincronizado',
      detail: `Config: ${runtimeContext.sources.config}. Manifesto: ${runtimeContext.sources.manifest}.`,
      progressPercent: 34,
      statusTone: 'info',
      actions: [{ id: 'quit', label: 'Fechar', variant: 'secondary' }]
    });

    const updateBlockedFlow = await maybeHandleAvailableUpdate();
    if (!updateBlockedFlow) {
      loadMainSite();
    }
  } catch (error) {
    setLauncherState({
      mode: 'offline',
      headline: 'Falha ao iniciar o launcher',
      detail: error.message || 'Nao foi possivel preparar a configuracao do wrapper.',
      progressPercent: null,
      statusTone: 'error',
      actions: [
        { id: 'retry', label: 'Tentar novamente', variant: 'primary' },
        { id: 'quit', label: 'Fechar', variant: 'secondary' }
      ]
    });
  } finally {
    bootstrapInFlight = false;
  }
}

async function retryBootstrapAndReload() {
  clearReadyFallbackTimer();
  siteReadyHandled = false;
  setLauncherState({
    mode: 'booting',
    headline: 'Tentando novamente',
    detail: 'Revalidando config publica, manifesto e carregamento da loja.',
    progressPercent: 18,
    statusTone: 'info',
    actions: [{ id: 'quit', label: 'Fechar', variant: 'secondary' }]
  });
  await bootstrapApplication();
}

function handleLauncherAction(actionId) {
  switch (actionId) {
    case 'update-now':
    case 'retry-update':
      if (runtimeContext?.manifest) {
        installAvailableUpdate(runtimeContext.manifest);
      }
      break;
    case 'continue-current':
      loadMainSite();
      break;
    case 'retry':
      retryBootstrapAndReload();
      break;
    case 'quit':
      app.quit();
      break;
    default:
      break;
  }
}

function registerIpcHandlers() {
  ipcMain.on('yara-kids:launcher-action', (_, actionId) => {
    handleLauncherAction(actionId);
  });

  ipcMain.on('yara-kids:site-ready', (_event, payload) => {
    if (payload?.branding && typeof payload.branding === 'object') {
      const configPatch = normalizeLauncherConfigPatch(payload.branding);
      if (configPatch) {
        persistRuntimeBranding(configPatch);
        setLauncherState({ branding: configPatch });
      }
    }

    finishLauncherHandoff('A loja confirmou que a interface principal esta pronta.');
  });

  ipcMain.on('yara-kids:launcher-config', (_event, payload) => {
    const configPatch = normalizeLauncherConfigPatch(payload);
    if (!configPatch) {
      return;
    }

    persistRuntimeBranding(configPatch);
    setLauncherState({ branding: configPatch });
  });
}

if (singleInstanceLock) {
  app.on('second-instance', () => {
    if (launcherWindow && !launcherWindow.isDestroyed()) {
      launcherWindow.focus();
      return;
    }

    if (!mainWindow) {
      return;
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    registerIpcHandlers();
    const buildBranding = loadBuildBranding();
    createLauncherWindow(composeLauncherBranding(buildBranding, normalizeWindowsConfig(DEFAULT_WINDOWS_CONFIG, buildBranding)));
    bootstrapApplication();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        const branding = loadBuildBranding();
        createLauncherWindow(composeLauncherBranding(branding, normalizeWindowsConfig(DEFAULT_WINDOWS_CONFIG, branding)));
        bootstrapApplication();
      }
    });
  });
}

app.on('window-all-closed', () => {
  clearReadyFallbackTimer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
