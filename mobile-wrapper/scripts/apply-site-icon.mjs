import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const SITE_URL = 'https://yara-kids-b48ed.web.app/';
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const androidResDir = resolve(rootDir, 'android/app/src/main/res');

const sizes = [
  ['mipmap-mdpi', 48],
  ['mipmap-hdpi', 72],
  ['mipmap-xhdpi', 96],
  ['mipmap-xxhdpi', 144],
  ['mipmap-xxxhdpi', 192]
];

async function fetchBuffer(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

function extractManifestHref(html) {
  const match = html.match(/<link[^>]+rel=["']manifest["'][^>]+href=["']([^"']+)["']/i);
  return match?.[1] || null;
}

function pickLargestManifestIcon(manifest) {
  if (!manifest?.icons?.length) return null;
  const sorted = [...manifest.icons].sort((a, b) => {
    const aSize = parseInt(a.sizes?.split('x')[0], 10) || 0;
    const bSize = parseInt(b.sizes?.split('x')[0], 10) || 0;
    return bSize - aSize;
  });
  return sorted[0].src;
}

function extractPreferredIconHref(html) {
  const appleTouchMatch = html.match(/<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]+href=["']([^"']+)["']/i);
  if (appleTouchMatch?.[1]) return appleTouchMatch[1];

  const iconMatches = [...html.matchAll(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/gi)]
    .map((match) => match[1])
    .filter(Boolean);

  const preferredRaster = iconMatches.find((href) => /\.(png|webp)(\?|$)/i.test(href));
  return preferredRaster || iconMatches[0] || null;
}

async function main() {
  // 1. Fetch site icon from the live site, preferring manifest icons
  const homeBuffer = await fetchBuffer(SITE_URL);
  const html = homeBuffer.toString('utf8');

  let iconHref = null;
  const manifestHref = extractManifestHref(html);
  if (manifestHref) {
    try {
      const manifestUrl = new URL(manifestHref, SITE_URL).toString();
      const manifestBuffer = await fetchBuffer(manifestUrl);
      const manifestJson = JSON.parse(manifestBuffer.toString('utf8'));
      iconHref = pickLargestManifestIcon(manifestJson);
    } catch (error) {
      console.warn(`Failed to resolve icon from site manifest: ${error}`);
    }
  }

  iconHref = iconHref || extractPreferredIconHref(html) || '/icon-192.png';
  const iconUrl = new URL(iconHref, SITE_URL).toString();
  const iconBuffer = await fetchBuffer(iconUrl);

  // 2. Generate standard PNG icons for pre-API 26 devices
  for (const [dirName, size] of sizes) {
    const targetDir = resolve(androidResDir, dirName);
    mkdirSync(targetDir, { recursive: true });

    const pngBuffer = await sharp(iconBuffer)
      .resize(size, size, { fit: 'contain', background: { r: 255, g: 240, b: 245, alpha: 0 } })
      .png()
      .toBuffer();

    writeFileSync(resolve(targetDir, 'ic_launcher.png'), pngBuffer);
    writeFileSync(resolve(targetDir, 'ic_launcher_round.png'), pngBuffer);
  }

  // 3. Generate adaptive icon foreground for API 26+
  // Using 70% of the safe zone area (the inner 66% circle of the adaptive icon)
  const foregroundSize = 512;
  const foregroundBuffer = await sharp(iconBuffer)
    .resize(Math.round(foregroundSize * 0.7), Math.round(foregroundSize * 0.7), {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer();

  const anydpiDir = resolve(androidResDir, 'mipmap-anydpi-v26');
  mkdirSync(anydpiDir, { recursive: true });
  writeFileSync(resolve(anydpiDir, 'ic_launcher_foreground.png'), foregroundBuffer);

  // 4. Create background drawable (light pink to match site theme #FFF0F5)
  const drawableDir = resolve(androidResDir, 'drawable');
  mkdirSync(drawableDir, { recursive: true });

  const backgroundXml = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="rectangle">
  <solid android:color="#FFF0F5" />
</shape>`;
  writeFileSync(resolve(drawableDir, 'ic_launcher_background.xml'), backgroundXml);

  // 5. Create adaptive icon XML (normal + round) referencing background + foreground
  const adaptiveIconXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
  <background android:drawable="@drawable/ic_launcher_background" />
  <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>`;

  writeFileSync(resolve(anydpiDir, 'ic_launcher.xml'), adaptiveIconXml);
  writeFileSync(resolve(anydpiDir, 'ic_launcher_round.xml'), adaptiveIconXml);

  // 6. Also place foreground PNG in standard mipmap folders for broader compat
  for (const [dirName] of sizes) {
    const targetDir = resolve(androidResDir, dirName);
    mkdirSync(targetDir, { recursive: true });
    const foregroundScaled = await sharp(iconBuffer)
      .resize(192, 192, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    writeFileSync(resolve(targetDir, 'ic_launcher_foreground.png'), foregroundScaled);
  }

  console.log(`Applied site icon ${iconUrl} to Android launcher resources`);
  console.log('Generated adaptive icons with light background (#FFF0F5)');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
