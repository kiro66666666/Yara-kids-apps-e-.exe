import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJsonPath = resolve(rootDir, 'package.json');
const buildGradlePath = resolve(rootDir, 'android/app/build.gradle');

function semverToVersionCode(version) {
  const [major, minor, patch] = String(version)
    .split('.')
    .map((value) => Number.parseInt(value, 10) || 0);
  return (major * 10000) + (minor * 100) + patch;
}

const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const versionName = packageJson.version || '1.0.0';
const versionCode = semverToVersionCode(versionName);

const currentBuildGradle = readFileSync(buildGradlePath, 'utf8');
const nextBuildGradle = currentBuildGradle
  .replace(/versionCode\s+\d+/u, `versionCode ${versionCode}`)
  .replace(/versionName\s+"[^"]+"/u, `versionName "${versionName}"`);

writeFileSync(buildGradlePath, nextBuildGradle);

console.log(`Updated Android build.gradle to versionName=${versionName} and versionCode=${versionCode}`);
