import { mkdirSync, writeFileSync } from 'node:fs';
<<<<<<< HEAD
import { dirname, extname, resolve } from 'node:path';
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

function extractIconHref(html) {
  const regex = /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i;
  const match = html.match(regex);
  if (!match) throw new Error('Could not find a favicon link in site HTML');
  return match[1];
}

async function main() {
  mkdirSync(assetsDir, { recursive: true });

  const home = await fetch(SITE_URL);
  const html = home.buffer.toString('utf8');
  const iconHref = extractIconHref(html);
  const iconUrl = new URL(iconHref, SITE_URL).toString();
  const { buffer } = await fetchBuffer(iconUrl);

  const pngBuffer = await sharp(buffer)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  writeFileSync(iconPngPath, pngBuffer);
  writeFileSync(iconIcoPath, await pngToIco(pngBuffer));
  console.log(`Resolved site icon ${iconUrl}${extname(iconUrl) ? '' : ''}`);
  console.log(`Generated ${iconPngPath} and ${iconIcoPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
=======
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconUrl = 'https://yara-kids-b48ed.web.app/favicon.ico';
const iconPath = resolve(__dirname, '../assets/icon.ico');

mkdirSync(resolve(__dirname, '../assets'), { recursive: true });

https
  .get(iconUrl, (response) => {
    if (response.statusCode !== 200) {
      throw new Error(`Failed to download favicon: ${response.statusCode}`);
    }

    const chunks = [];
    response.on('data', (chunk) => chunks.push(chunk));
    response.on('end', () => {
      writeFileSync(iconPath, Buffer.concat(chunks));
      console.log(`Downloaded site favicon to ${iconPath}`);
    });
  })
  .on('error', (error) => {
    throw error;
  });
>>>>>>> origin/main
