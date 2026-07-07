import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const androidResDir = resolve(rootDir, 'android/app/src/main/res');
const androidManifestPath = resolve(rootDir, 'android/app/src/main/AndroidManifest.xml');

// =============================================================================
// NETWORK SECURITY CONFIG — forbids cleartext (HTTP), trusts system + user CAs
// =============================================================================

const NETWORK_SECURITY_CONFIG_XML = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <!-- Block all cleartext (HTTP) traffic by default -->
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <!-- System certificates (production CAs) -->
            <certificates src="system" />
            <!-- User-installed certificates (for debugging with proxy tools) -->
            <certificates src="user" />
        </trust-anchors>
    </base-config>

    <!-- Allow the YARA Kids domain explicitly with HTTPS -->
    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="true">yara-kids-b48ed.web.app</domain>
        <domain includeSubdomains="true">yarakids.com.br</domain>
        <trust-anchors>
            <certificates src="system" />
            <certificates src="user" />
        </trust-anchors>
    </domain-config>
</network-security-config>`;

// =============================================================================
// APPLY NETWORK SECURITY CONFIG
// =============================================================================

function applyNetworkSecurityConfig() {
  const xmlDir = resolve(androidResDir, 'xml');
  mkdirSync(xmlDir, { recursive: true });
  writeFileSync(resolve(xmlDir, 'network_security_config.xml'), NETWORK_SECURITY_CONFIG_XML, 'utf8');
  console.log(`Created ${resolve(xmlDir, 'network_security_config.xml')}`);
}

// =============================================================================
// UPDATE ANDROID MANIFEST
// =============================================================================

function applyAndroidManifestChanges() {
  if (!existsSync(androidManifestPath)) {
    console.log('Android project not yet generated — skipping manifest changes.');
    return;
  }
  let manifest = readFileSync(androidManifestPath, 'utf8');

  // 1. Set usesCleartextTraffic to false
  manifest = manifest.replace(
    /android:usesCleartextTraffic="(true|false)"/,
    'android:usesCleartextTraffic="false"'
  );

  // 2. Add networkSecurityConfig if not already present
  if (!manifest.includes('android:networkSecurityConfig')) {
    manifest = manifest.replace(
      'android:usesCleartextTraffic="false"',
      'android:usesCleartextTraffic="false"\n            android:networkSecurityConfig="@xml/network_security_config"'
    );
  }

  writeFileSync(androidManifestPath, manifest, 'utf8');
  console.log(`Updated ${androidManifestPath}`);
}

// =============================================================================
// MAIN
// =============================================================================

function main() {
  try {
    // Check if Android project exists before applying changes
    if (!existsSync(androidResDir) || !existsSync(androidManifestPath)) {
      console.log('Android project not found — skipping security config. Run `npx cap add android && npx cap sync android` first.');
      return;
    }
    applyNetworkSecurityConfig();
    applyAndroidManifestChanges();
    console.log('✓ Android security config applied successfully');
  } catch (error) {
    console.error('✗ Failed to apply Android security config:', error.message);
    process.exit(1);
  }
}

main();
