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
  return html.match(/<link[^>]+rel=["'][^"']*manifest[^"']*["'][^>]+href=["']([^"']+)["']/i)?.[1] || null;
}

function pickLargestManifestIcon(manifestJson) {
  const icons = Array.isArray(manifestJson?.icons) ? manifestJson.icons : [];
  if (!icons.length) return null;

  return icons
    .filter((icon) => typeof icon?.src === 'string' && icon.src.trim())
    .map((icon) => {
      const maxSize = String(icon.sizes || '')
        .split(/\s+/)
        .map((entry) => Number.parseInt(entry.split('x')[0], 10) || 0)
        .reduce((largest, current) => Math.max(largest, current), 0);
      return { src: icon.src, maxSize };
    })
    .sort((left, right) => right.maxSize - left.maxSize)[0]?.src || null;
}

function extractTagContent(html, pattern) {
  return html.match(pattern)?.[1]?.trim() || null;
}

function extractMetaContent(html, kind, name) {
  const pattern = new RegExp(`<meta[^>]+${kind}=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i');
  return extractTagContent(html, pattern);
}

function extractConfigValue(html, key) {
  return extractTagContent(html, new RegExp(`${key}\\s*:\\s*['"]([^'"]+)['"]`, 'i'));
}

function resolveSiteUrl(value) {
  if (!value) return null;

  try {
    return new URL(value, SITE_URL).toString();
  } catch (error) {
    return null;
  }
}

function firstDefined(...values) {
  return values.find((value) => typeof value === 'string' && value.trim()) || null;
}

function detectMediaKind(url) {
  return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(String(url || '')) ? 'video' : 'image';
}

async function main() {
  mkdirSync(assetsDir, { recursive: true });

  const home = await fetchBuffer(SITE_URL);
  const html = home.buffer.toString('utf8');

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
  const iconUrl = resolveSiteUrl(iconHref);
  const { buffer } = await fetchBuffer(iconUrl);

  const pngBuffer = await sharp(buffer)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const explicitSplashMediaUrl = firstDefined(
    extractConfigValue(html, 'splashMediaUrl'),
    extractConfigValue(html, 'heroMediaUrl'),
    extractConfigValue(html, 'bannerMediaUrl'),
    extractConfigValue(html, 'heroVideoUrl'),
    extractConfigValue(html, 'bannerVideoUrl'),
    extractMetaContent(html, 'property', 'og:video'),
    extractMetaContent(html, 'name', 'twitter:player')
  );

  const previewImageUrl = firstDefined(
    extractConfigValue(html, 'heroImageUrl'),
    extractConfigValue(html, 'bannerImageUrl'),
    extractConfigValue(html, 'previewImageUrl'),
    extractMetaContent(html, 'property', 'og:image'),
    extractMetaContent(html, 'name', 'twitter:image'),
    extractConfigValue(html, 'logoUrl')
  );

  const splashMediaUrl = firstDefined(explicitSplashMediaUrl, previewImageUrl);

  const branding = {
    title:
      extractMetaContent(html, 'name', 'apple-mobile-web-app-title') ||
      extractTagContent(html, /<title>([^<]+)<\/title>/i) ||
      'YARA Kids',
    description:
      extractMetaContent(html, 'name', 'description') ||
      'Moda infantil com amor e conforto.',
    themeColor:
      extractMetaContent(html, 'name', 'theme-color') ||
      '#ff69b4',
    iconUrl,
    faviconUrl: resolveSiteUrl(firstDefined(extractConfigValue(html, 'faviconUrl'), iconHref)),
    appIconUrl: resolveSiteUrl(firstDefined(extractConfigValue(html, 'appIconUrl'), iconHref)),
    logoUrl: resolveSiteUrl(extractConfigValue(html, 'logoUrl')),
    heroImageUrl: resolveSiteUrl(previewImageUrl),
    bannerImageUrl: resolveSiteUrl(firstDefined(extractConfigValue(html, 'bannerImageUrl'), previewImageUrl)),
    ogImageUrl: resolveSiteUrl(extractMetaContent(html, 'property', 'og:image')),
    twitterImageUrl: resolveSiteUrl(extractMetaContent(html, 'name', 'twitter:image')),
    heroVideoUrl: resolveSiteUrl(firstDefined(extractConfigValue(html, 'heroVideoUrl'), extractMetaContent(html, 'property', 'og:video'))),
    bannerVideoUrl: resolveSiteUrl(extractConfigValue(html, 'bannerVideoUrl')),
    splashMediaUrl: resolveSiteUrl(splashMediaUrl),
    splashMediaKind: detectMediaKind(splashMediaUrl),
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
