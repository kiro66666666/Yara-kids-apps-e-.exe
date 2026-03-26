import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = resolve(__dirname, '../assets');
const brandingPath = resolve(assetsDir, 'branding.json');
const iconPath = resolve(assetsDir, 'icon.png');
const sidebarPath = resolve(assetsDir, 'installerSidebar.bmp');
const uninstallerSidebarPath = resolve(assetsDir, 'uninstallerSidebar.bmp');
const headerPath = resolve(assetsDir, 'installerHeader.bmp');

const fallbackBranding = {
  title: 'YARA Kids',
  description: 'Moda infantil com amor e conforto.',
  themeColor: '#ff69b4',
  logoUrl: null,
  heroImageUrl: null,
  bannerImageUrl: null,
  splashMediaUrl: null,
  siteUrl: 'https://yara-kids-b48ed.web.app/'
};

function readBranding() {
  if (!existsSync(brandingPath)) {
    return fallbackBranding;
  }

  return { ...fallbackBranding, ...JSON.parse(readFileSync(brandingPath, 'utf8')) };
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function clampText(value, maxChars, maxLines) {
  const words = String(value || '').trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (candidate.length <= maxChars) {
      currentLine = candidate;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      lines.push(word.slice(0, maxChars));
      currentLine = word.slice(maxChars);
    }

    if (lines.length === maxLines) {
      break;
    }
  }

  if (lines.length < maxLines && currentLine) {
    lines.push(currentLine);
  }

  if (lines.length > maxLines) {
    lines.length = maxLines;
  }

  if (lines.length && words.join(' ').length > lines.join(' ').length) {
    lines[lines.length - 1] = `${lines[lines.length - 1].slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
  }

  return lines;
}

function hexToRgba(hex, alpha) {
  const safeHex = String(hex || '#ff69b4').replace('#', '');
  const normalized = safeHex.length === 3
    ? safeHex.split('').map((part) => `${part}${part}`).join('')
    : safeHex.padEnd(6, '0').slice(0, 6);
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

async function fetchOptionalBuffer(url) {
  if (!url) {
    return null;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    return null;
  }
}

async function createPreparedBuffer(inputBuffer, width, height) {
  return sharp(inputBuffer)
    .resize(width, height, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer();
}

async function createPreparedCoverBuffer(inputBuffer, width, height) {
  return sharp(inputBuffer)
    .resize(width, height, {
      fit: 'cover',
      position: 'attention'
    })
    .modulate({
      brightness: 0.82,
      saturation: 1.08
    })
    .png()
    .toBuffer();
}

function isVideoUrl(url) {
  return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(String(url || ''));
}

function pickPreviewImageUrl(branding) {
  const candidates = [
    branding.heroImageUrl,
    branding.bannerImageUrl,
    branding.previewImageUrl,
    branding.ogImageUrl,
    branding.twitterImageUrl,
    branding.splashMediaUrl,
    branding.logoUrl
  ];

  return candidates.find((candidate) => candidate && !isVideoUrl(candidate)) || null;
}

function createSidebarSvg(branding, mode, hasBackdrop) {
  const isInstall = mode === 'install';
  const title = escapeXml(branding.title || fallbackBranding.title);
  const lines = clampText(branding.description, 24, 3);
  const domain = escapeXml(new URL(branding.siteUrl || fallbackBranding.siteUrl).host);
  const accent = branding.themeColor || fallbackBranding.themeColor;
  const badgeLabel = isInstall ? 'Instalador oficial' : 'Remocao segura';
  const footerLabel = isInstall ? 'Sessao local e atualizacao pronta' : 'Remove o app sem tocar no site';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="164" height="314" viewBox="0 0 164 314">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${accent}" />
        <stop offset="55%" stop-color="#ff9fcb" />
        <stop offset="100%" stop-color="#fff4fa" />
      </linearGradient>
      <linearGradient id="bgOverlay" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${accent}" stop-opacity="0.58" />
        <stop offset="55%" stop-color="#ff9fcb" stop-opacity="0.38" />
        <stop offset="100%" stop-color="#fff4fa" stop-opacity="0.78" />
      </linearGradient>
      <linearGradient id="card" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="rgba(255,255,255,0.96)" />
        <stop offset="100%" stop-color="rgba(255,255,255,0.82)" />
      </linearGradient>
    </defs>
    <rect width="164" height="314" rx="0" fill="${hasBackdrop ? 'url(#bgOverlay)' : 'url(#bg)'}" />
    <circle cx="18" cy="24" r="34" fill="${hexToRgba(accent, 0.12)}" />
    <circle cx="146" cy="64" r="42" fill="rgba(255,255,255,0.18)" />
    <circle cx="124" cy="278" r="56" fill="${hexToRgba(accent, 0.18)}" />
    <rect x="14" y="18" width="136" height="278" rx="24" fill="url(#card)" />
    <rect x="26" y="150" width="112" height="62" rx="18" fill="rgba(255,255,255,0.82)" stroke="${hexToRgba(accent, 0.18)}" />
    <rect x="36" y="162" width="56" height="8" rx="4" fill="${hexToRgba(accent, 0.22)}" />
    <rect x="36" y="176" width="88" height="8" rx="4" fill="${hexToRgba(accent, 0.14)}" />
    <rect x="36" y="190" width="72" height="8" rx="4" fill="${hexToRgba(accent, 0.1)}" />
    <text x="26" y="130" fill="${accent}" font-size="11" font-weight="700" font-family="Segoe UI, Arial, sans-serif">${badgeLabel}</text>
    <text x="26" y="236" fill="#6b7280" font-size="10" font-family="Segoe UI, Arial, sans-serif">${footerLabel}</text>
    <text x="26" y="256" fill="#6b7280" font-size="10" font-family="Segoe UI, Arial, sans-serif">${domain}</text>
    <text x="26" y="70" fill="#1f2937" font-size="26" font-weight="800" font-family="Segoe UI, Arial, sans-serif">${title}</text>
    ${lines.map((line, index) => `<text x="26" y="${92 + (index * 16)}" fill="#4b5563" font-size="11" font-family="Segoe UI, Arial, sans-serif">${escapeXml(line)}</text>`).join('')}
  </svg>`;
}

function createHeaderSvg(branding) {
  const title = escapeXml(branding.title || fallbackBranding.title);
  const accent = branding.themeColor || fallbackBranding.themeColor;
  const subtitle = escapeXml('Aplicativo Windows oficial');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="57" viewBox="0 0 150 57">
    <defs>
      <linearGradient id="headerBg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${accent}" />
        <stop offset="100%" stop-color="#ffb5d7" />
      </linearGradient>
    </defs>
    <rect width="150" height="57" rx="0" fill="url(#headerBg)" />
    <circle cx="130" cy="12" r="16" fill="rgba(255,255,255,0.16)" />
    <circle cx="144" cy="48" r="20" fill="rgba(255,255,255,0.12)" />
    <text x="42" y="24" fill="#ffffff" font-size="18" font-weight="800" font-family="Segoe UI, Arial, sans-serif">${title}</text>
    <text x="42" y="40" fill="rgba(255,255,255,0.88)" font-size="10" font-family="Segoe UI, Arial, sans-serif">${subtitle}</text>
  </svg>`;
}

async function createComposite(svgMarkup, iconBuffer, logoBuffer, mediaBuffer, options) {
  const layers = [{ input: Buffer.from(svgMarkup) }];

  if (mediaBuffer && options.media) {
    layers.push({
      input: await createPreparedCoverBuffer(mediaBuffer, options.media.width, options.media.height),
      left: options.media.left,
      top: options.media.top
    });
    layers.push({
      input: Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${options.media.width}" height="${options.media.height}" viewBox="0 0 ${options.media.width} ${options.media.height}">
          <rect width="${options.media.width}" height="${options.media.height}" rx="${options.media.radius}" fill="rgba(255,255,255,0.08)" />
          <rect width="${options.media.width}" height="${options.media.height}" rx="${options.media.radius}" fill="none" stroke="${hexToRgba(options.media.borderColor, 0.16)}" />
        </svg>`
      ),
      left: options.media.left,
      top: options.media.top
    });
  }

  if (iconBuffer) {
    layers.push({
      input: await createPreparedBuffer(iconBuffer, options.icon.width, options.icon.height),
      left: options.icon.left,
      top: options.icon.top
    });
  }

  if (logoBuffer) {
    layers.push({
      input: await createPreparedBuffer(logoBuffer, options.logo.width, options.logo.height),
      left: options.logo.left,
      top: options.logo.top
    });
  }

  return sharp({
    create: {
      width: options.canvas.width,
      height: options.canvas.height,
      channels: 4,
      background: { r: 255, g: 246, b: 251, alpha: 1 }
    }
  }).composite(layers);
}

async function writeBmp(image, outputPath) {
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const rowStride = Math.floor((info.width * 3 + 3) / 4) * 4;
  const pixelArraySize = rowStride * info.height;
  const fileSize = 54 + pixelArraySize;
  const buffer = Buffer.alloc(fileSize);

  buffer.write('BM', 0, 'ascii');
  buffer.writeUInt32LE(fileSize, 2);
  buffer.writeUInt32LE(54, 10);
  buffer.writeUInt32LE(40, 14);
  buffer.writeInt32LE(info.width, 18);
  buffer.writeInt32LE(info.height, 22);
  buffer.writeUInt16LE(1, 26);
  buffer.writeUInt16LE(24, 28);
  buffer.writeUInt32LE(0, 30);
  buffer.writeUInt32LE(pixelArraySize, 34);
  buffer.writeInt32LE(2835, 38);
  buffer.writeInt32LE(2835, 42);

  let offset = 54;
  for (let y = info.height - 1; y >= 0; y -= 1) {
    const rowStart = y * info.width * 4;
    for (let x = 0; x < info.width; x += 1) {
      const pixelIndex = rowStart + (x * 4);
      buffer[offset++] = data[pixelIndex + 2];
      buffer[offset++] = data[pixelIndex + 1];
      buffer[offset++] = data[pixelIndex];
    }
    while ((offset - 54) % rowStride !== 0) {
      buffer[offset++] = 0;
    }
  }

  writeFileSync(outputPath, buffer);
}

async function main() {
  mkdirSync(assetsDir, { recursive: true });

  const branding = readBranding();
  const iconBuffer = existsSync(iconPath) ? readFileSync(iconPath) : null;
  const logoSource = await fetchOptionalBuffer(branding.logoUrl);
  const logoBuffer = logoSource ? await sharp(logoSource).png().toBuffer() : null;
  const previewSource = await fetchOptionalBuffer(pickPreviewImageUrl(branding));
  const previewBuffer = previewSource ? await sharp(previewSource).png().toBuffer() : null;

  const sidebar = await createComposite(
    createSidebarSvg(branding, 'install', Boolean(previewBuffer)),
    iconBuffer,
    logoBuffer,
    previewBuffer,
    {
      canvas: { width: 164, height: 314 },
      icon: { left: 28, top: 24, width: 54, height: 54 },
      logo: { left: 86, top: 28, width: 52, height: 40 },
      media: { left: 32, top: 154, width: 100, height: 54, radius: 18, borderColor: branding.themeColor || fallbackBranding.themeColor }
    }
  );

  const uninstallerSidebar = await createComposite(
    createSidebarSvg(branding, 'uninstall', Boolean(previewBuffer)),
    iconBuffer,
    logoBuffer,
    previewBuffer,
    {
      canvas: { width: 164, height: 314 },
      icon: { left: 28, top: 24, width: 54, height: 54 },
      logo: { left: 86, top: 28, width: 52, height: 40 },
      media: { left: 32, top: 154, width: 100, height: 54, radius: 18, borderColor: branding.themeColor || fallbackBranding.themeColor }
    }
  );

  const header = await createComposite(
    createHeaderSvg(branding),
    iconBuffer,
    null,
    previewBuffer,
    {
      canvas: { width: 150, height: 57 },
      icon: { left: 10, top: 10, width: 24, height: 24 },
      logo: { left: 0, top: 0, width: 0, height: 0 },
      media: null
    }
  );

  await writeBmp(sidebar, sidebarPath);
  await writeBmp(uninstallerSidebar, uninstallerSidebarPath);
  await writeBmp(header, headerPath);

  console.log(`Generated ${sidebarPath}`);
  console.log(`Generated ${uninstallerSidebarPath}`);
  console.log(`Generated ${headerPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
