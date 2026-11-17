# NovaBlend Studio (iOS & Android)

Mobile editor for **NovaBlend Studio** — Expo + React Native, tuned for phones.

Folder: `NovaBlend Studio Mobile` (iOS and Android in one Expo app).

This folder lives in the **same GitHub repo** as the Windows desktop app. Use the **root** `.gitignore` (there is no nested `.gitignore` here).

## What’s included

- Home / saved projects (on-device)
- Import video & audio from the device
- Multi-track timeline (video / audio / text / FX)
- Preview with playhead, Blur fill, aspect presets
- Transform (scale, position, rotation, opacity)
- Text, stickers, captions, effects, filters, transitions
- Layer forward/back, split, duplicate, undo/redo, keyframes
- In-app **update banner** from GitHub Releases (free notice; install is manual)
- Project package share (JSON). Full **MP4 FFmpeg export** waits for the native build step.

## Requirements

- Node.js 20+
- Expo Go (dev) or Xcode / Android Studio when you build later

## Run (dev — no production build)

From the repo root:

```bash
cd "NovaBlend Studio Mobile"
npm install
npx expo start
```

Then press `i` (iOS simulator), `a` (Android emulator), or scan the QR code with Expo Go on a device.

## Update notice (free)

The app calls your GitHub Releases API (configured in `app.json` → `extra.githubReleasesApi`).  
When a newer tag exists, users see an in-app banner with an **Open** link.  
- **Android:** they can download a new APK from the release  
- **iOS:** they still reinstall / re-sideload manually (no free silent auto-install)

## Builds

### Android APK (done locally)

A release APK was produced on this machine:

```text
NovaBlend Studio Mobile/dist/app-release.apk
```

(~28 MB, signed with the debug keystore for sideload testing — fine for friends / GitHub Releases, not Play Store.)

Rebuild later (Windows tip: username/SDK paths with spaces break NDK; we used `C:\AndroidSdk` junction + short build path):

```bash
cd "NovaBlend Studio Mobile"
npx expo prebuild --platform android
# then from a short path copy if Windows path-length errors appear
cd android
gradlew.bat assembleRelease
```

### iOS (needs Expo login — cannot finish on Windows alone)

iOS **cannot** be compiled on Windows. Use **EAS cloud**:

1. Create a free Expo account: https://expo.dev/signup  
2. In the mobile folder:

```bash
cd "NovaBlend Studio Mobile"
npx eas-cli login
npx eas-cli build --platform ios --profile preview
```

- `preview` profile builds an **iOS Simulator** build (no paid Apple Developer account).  
- For a real iPhone install without App Store, you still need Apple signing (paid Apple Developer) or a sideload workaround.

### EAS Android (optional cloud)

```bash
npx eas-cli login
npx eas-cli build --platform android --profile preview
```

### Still planned after builds

- Native **MP4 / FFmpeg** export on mobile  
- Production signing keystore for Play Store (if you ever want it)
