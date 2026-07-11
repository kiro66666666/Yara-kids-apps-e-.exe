import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const distDir = resolve(rootDir, 'dist');
const packageJsonPath = resolve(rootDir, 'package.json');
const manifestOutputPath = process.env.YARA_KIDS_WINDOWS_MANIFEST_PATH
  ? resolve(process.cwd(), process.env.YARA_KIDS_WINDOWS_MANIFEST_PATH)
  : resolve(distDir, 'YARA-Kids.windows.manifest.json');

const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const installerName = 'YARA-Kids-Setup.exe';
const installerPath = resolve(distDir, installerName);
const installerUrl = process.env.YARA_KIDS_WINDOWS_INSTALLER_URL || `./${installerName}`;

function detectInstallerSha256() {
  try {
    return createHash('sha256').update(readFileSync(installerPath)).digest('hex');
  } catch (error) {
    return null;
  }
}

function detectInstallerSize() {
  try {
    return statSync(installerPath).size;
  } catch (error) {
    return null;
  }
}

const manifest = {
  schemaVersion: 1,
  appId: 'com.yarakids.desktop',
  productName: 'YARA Kids',
  channel: 'stable',
  version: packageJson.version,
  publishedAt: process.env.YARA_KIDS_WINDOWS_PUBLISHED_AT || new Date().toISOString(),
  releaseUrl: process.env.YARA_KIDS_WINDOWS_RELEASE_URL || null,
  notes: process.env.YARA_KIDS_WINDOWS_RELEASE_NOTES || null,
  installer: {
    name: installerName,
    url: installerUrl,
    sha256: process.env.YARA_KIDS_WINDOWS_INSTALLER_SHA256 || detectInstallerSha256(),
    size: Number.parseInt(process.env.YARA_KIDS_WINDOWS_INSTALLER_SIZE || '', 10) || detectInstallerSize()
  }
};

mkdirSync(dirname(manifestOutputPath), { recursive: true });
writeFileSync(manifestOutputPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Generated ${manifestOutputPath}`);
