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
const brandingJsonPath = resolve(assetsDir, 'branding.json');

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

function extractManifestHref(html) {
  const regex = /<link[^>]+rel=["'][^"']*manifest[^"']*["'][^>]+href=["']([^"']+)["']/i;
  return html.match(regex)?.[1] || null;
}

function pickLargestManifestIcon(manifestJson) {
  const icons = Array.isArray(manifestJson?.icons) ? manifestJson.icons : [];
  if (!icons.length) return null;

  const scoredIcons = icons
    .filter((icon) => typeof icon?.src === 'string' && icon.src.trim())
    .map((icon) => {
      const sizes = String(icon.sizes || '')
        .split(/\s+/)
        .map((entry) => entry.toLowerCase())
        .filter(Boolean);
      const maxSize = sizes.reduce((largest, entry) => {
        const [width] = entry.split('x');
        const parsed = Number.parseInt(width, 10);
        return Number.isFinite(parsed) ? Math.max(largest, parsed) : largest;
      }, 0);
      return { src: icon.src, maxSize };
    })
    .sort((left, right) => right.maxSize - left.maxSize);

  return scoredIcons[0]?.src || null;
}

function extractTagContent(html, pattern) {
  return html.match(pattern)?.[1]?.trim() || null;
}

function extractTitle(html) {
  return extractTagContent(html, /<title>([^<]+)<\/title>/i);
}

function extractDefaultBranding(html) {
  return {
    logoUrl: extractTagContent(html, /logoUrl:\s*['"]([^'"]+)['"]/i),
    faviconUrl: extractTagContent(html, /faviconUrl:\s*['"]([^'"]+)['"]/i),
    appIconUrl: extractTagContent(html, /appIconUrl:\s*['"]([^'"]+)['"]/i)
  };
}

async function main() {
  mkdirSync(assetsDir, { recursive: true });

  const home = await fetchBuffer(SITE_URL);
  const html = home.buffer.toString('utf8');
  const defaultBranding = extractDefaultBranding(html);
  let iconHref = null;

  const manifestHref = extractManifestHref(html);
  if (manifestHref) {
    try {
      const manifestUrl = new URL(manifestHref, SITE_URL).toString();
      const { buffer: manifestBuffer } = await fetchBuffer(manifestUrl);
      const manifestJson = JSON.parse(manifestBuffer.toString('utf8'));
      iconHref = pickLargestManifestIcon(manifestJson);
    } catch (error) {
      console.warn(`Failed to resolve icon from site manifest: ${error}`);
    }
  }

  iconHref = iconHref || extractPreferredIconHref(html) || '/icon-192.png';
  const iconUrl = new URL(iconHref, SITE_URL).toString();
  const { buffer } = await fetchBuffer(iconUrl);

  const pngBuffer = await sharp(buffer)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const branding = {
    title:
      extractTagContent(html, /<meta[^>]+name=["']apple-mobile-web-app-title["'][^>]+content=["']([^"']+)["']/i) ||
      extractTitle(html) ||
      'YARA Kids',
    description:
      extractTagContent(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
      'Moda infantil com amor e conforto.',
    themeColor:
      extractTagContent(html, /<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i) ||
      '#ff69b4',
    iconUrl,
    faviconUrl: new URL(defaultBranding.faviconUrl || iconHref, SITE_URL).toString(),
    logoUrl: defaultBranding.logoUrl ? new URL(defaultBranding.logoUrl, SITE_URL).toString() : null,
    siteUrl: SITE_URL
  };

  writeFileSync(iconPngPath, pngBuffer);
  writeFileSync(iconIcoPath, await pngToIco(pngBuffer));
  writeFileSync(brandingJsonPath, `${JSON.stringify(branding, null, 2)}\n`);
  console.log(`Resolved site icon ${iconUrl}`);
  console.log(`Generated ${iconPngPath} and ${iconIcoPath}`);
  console.log(`Saved branding metadata to ${brandingJsonPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
