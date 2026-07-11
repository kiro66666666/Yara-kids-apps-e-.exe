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
  description: 'Aplicativo oficial Windows para abrir a loja com launcher proprio e atualizacao controlada.',
  themeColor: '#ff69b4',
  siteUrl: 'https://yara-kids-b48ed.web.app/'
};

function readBranding() {
  if (!existsSync(brandingPath)) {
    return fallbackBranding;
  }

  try {
    return { ...fallbackBranding, ...JSON.parse(readFileSync(brandingPath, 'utf8')) };
  } catch (error) {
    return fallbackBranding;
  }
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

function createSidebarSvg(branding, mode) {
  const accent = branding.themeColor || fallbackBranding.themeColor;
  const titleLines = clampText(branding.title || fallbackBranding.title, 12, 2);
  const descriptionLines = clampText(
    branding.description || fallbackBranding.description,
    18,
    4
  );
  const domain = escapeXml(new URL(branding.siteUrl || fallbackBranding.siteUrl).host);
  const eyebrow = mode === 'install' ? 'Instalador Windows' : 'Desinstalador';
  const footer = mode === 'install' ? 'Launcher, update e loja' : 'Remove somente o app local';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="164" height="314" viewBox="0 0 164 314">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${accent}" />
        <stop offset="100%" stop-color="#ffd7ea" />
      </linearGradient>
    </defs>
    <rect width="164" height="314" fill="url(#bg)" />
    <rect x="14" y="14" width="136" height="286" rx="30" fill="rgba(255,255,255,0.90)" />
    <rect x="24" y="24" width="116" height="26" rx="13" fill="${hexToRgba(accent, 0.14)}" />
    <text x="82" y="41" text-anchor="middle" fill="${accent}" font-size="10" font-weight="700" font-family="Segoe UI, Arial, sans-serif">${eyebrow}</text>
    <circle cx="82" cy="92" r="38" fill="${hexToRgba(accent, 0.10)}" />
    ${titleLines.map((line, index) => `<text x="82" y="${152 + (index * 20)}" text-anchor="middle" fill="#1f2937" font-size="${index === 0 ? 22 : 20}" font-weight="800" font-family="Segoe UI, Arial, sans-serif">${escapeXml(line)}</text>`).join('')}
    ${descriptionLines.map((line, index) => `<text x="82" y="${190 + (index * 15)}" text-anchor="middle" fill="#4b5563" font-size="10.5" font-family="Segoe UI, Arial, sans-serif">${escapeXml(line)}</text>`).join('')}
    <rect x="24" y="246" width="116" height="34" rx="17" fill="rgba(17,24,39,0.05)" />
    <text x="82" y="267" text-anchor="middle" fill="#374151" font-size="10" font-family="Segoe UI, Arial, sans-serif">${footer}</text>
    <text x="82" y="295" text-anchor="middle" fill="rgba(31,41,55,0.72)" font-size="9" font-family="Segoe UI, Arial, sans-serif">${domain}</text>
  </svg>`;
}

function createHeaderSvg(branding) {
  const accent = branding.themeColor || fallbackBranding.themeColor;
  const title = escapeXml(clampText(branding.title || fallbackBranding.title, 14, 1)[0] || fallbackBranding.title);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="57" viewBox="0 0 150 57">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${accent}" />
        <stop offset="100%" stop-color="#ffbedb" />
      </linearGradient>
    </defs>
    <rect width="150" height="57" fill="url(#bg)" />
    <circle cx="132" cy="10" r="16" fill="rgba(255,255,255,0.16)" />
    <circle cx="144" cy="48" r="18" fill="rgba(255,255,255,0.12)" />
    <text x="42" y="22" fill="#ffffff" font-size="15" font-weight="800" font-family="Segoe UI, Arial, sans-serif">${title}</text>
    <text x="42" y="39" fill="rgba(255,255,255,0.92)" font-size="9.5" font-family="Segoe UI, Arial, sans-serif">Aplicativo oficial Windows</text>
  </svg>`;
}

async function loadPreparedIcon(size) {
  if (!existsSync(iconPath)) {
    return null;
  }

  return sharp(readFileSync(iconPath))
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer();
}

async function renderComposite(svgMarkup, iconBuffer, { width, height, left, top }) {
  const layers = [{ input: Buffer.from(svgMarkup) }];

  if (iconBuffer) {
    layers.push({
      input: iconBuffer,
      left,
      top
    });
  }

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 255, g: 247, b: 251, alpha: 1 }
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
  const sidebarIconBuffer = await loadPreparedIcon(68);
  const headerIconBuffer = await loadPreparedIcon(30);

  const sidebar = await renderComposite(
    createSidebarSvg(branding, 'install'),
    sidebarIconBuffer,
    { width: 164, height: 314, left: 48, top: 58 }
  );

  const uninstallerSidebar = await renderComposite(
    createSidebarSvg(branding, 'uninstall'),
    sidebarIconBuffer,
    { width: 164, height: 314, left: 48, top: 58 }
  );

  const header = await renderComposite(
    createHeaderSvg(branding),
    headerIconBuffer,
    { width: 150, height: 57, left: 8, top: 13 }
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
