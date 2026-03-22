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
  const homeBuffer = await fetchBuffer(SITE_URL);
  const iconHref = extractPreferredIconHref(homeBuffer.toString('utf8')) || '/icon-192.png';
  const iconUrl = new URL(iconHref, SITE_URL).toString();
  const iconBuffer = await fetchBuffer(iconUrl);

  for (const [dirName, size] of sizes) {
    const targetDir = resolve(androidResDir, dirName);
    mkdirSync(targetDir, { recursive: true });
    const pngBuffer = await sharp(iconBuffer)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    writeFileSync(resolve(targetDir, 'ic_launcher.png'), pngBuffer);
    writeFileSync(resolve(targetDir, 'ic_launcher_round.png'), pngBuffer);
  }

  console.log(`Applied site icon ${iconUrl} to Android launcher resources`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
