import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const SITE_URL = 'https://yara-kids-b48ed.web.app/';
const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = resolve(__dirname, '../assets');
const iconPngPath = resolve(assetsDir, 'icon.png');
const iconIcoPath = resolve(assetsDir, 'icon.ico');

async function fetchBuffer(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get('content-type') || ''
  };
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
  mkdirSync(assetsDir, { recursive: true });

  const home = await fetchBuffer(SITE_URL);
  const html = home.buffer.toString('utf8');
  const iconHref = extractPreferredIconHref(html) || '/icon-192.png';
  const iconUrl = new URL(iconHref, SITE_URL).toString();
  const { buffer } = await fetchBuffer(iconUrl);

  const pngBuffer = await sharp(buffer)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  writeFileSync(iconPngPath, pngBuffer);
  writeFileSync(iconIcoPath, await pngToIco(pngBuffer));
  console.log(`Resolved site icon ${iconUrl}`);
  console.log(`Generated ${iconPngPath} and ${iconIcoPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
