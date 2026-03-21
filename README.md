# YARA Kids Native Wrapper Automation

This repository contains two lightweight native wrapper projects and a GitHub Actions workflow:

- `desktop-wrapper/`: Electron configuration for generating a Windows executable that opens the production site in a fullscreen, chromeless window.
- `mobile-wrapper/`: Capacitor configuration for generating an Android APK that loads the production site as a live webview wrapper.
- `.github/workflows/build-apps.yml`: CI pipeline that builds both wrappers and publishes them to a GitHub Release.

## Triggering the workflow

1. Push these files to the `main` branch, or run the workflow manually from the **Actions** tab using **Build Native Wrappers**.
2. After the workflow completes, open the created GitHub Release tagged `native-wrapper-build-<run_number>`.
3. Download the generated `.exe` and `.apk` assets from that release page.
