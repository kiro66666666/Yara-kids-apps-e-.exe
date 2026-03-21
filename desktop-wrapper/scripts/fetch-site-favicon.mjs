import { mkdirSync, writeFileSync } from 'node:fs';
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
