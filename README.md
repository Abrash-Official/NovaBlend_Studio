# NovaBlend Studio

Multi-track video editor by **[Abrash-Official](https://github.com/Abrash-Official)**.

This repository contains **two apps**:

| App | Folder | Stack | Platforms |
|-----|--------|-------|-----------|
| **Desktop** | repo root (`src/`, `src-tauri/`) | Tauri + React + TypeScript + Tailwind | Windows |
| **Mobile** | [`NovaBlend Studio Mobile/`](./NovaBlend%20Studio%20Mobile/) | Expo + React Native | iOS & Android |

---

## Desktop (Windows)

Windows-native editor with:

- Preview + timeline editing in the UI  
- Export via a bundled **FFmpeg** sidecar  
- Prefers **`h264_nvenc`** (NVIDIA GPU), with automatic **libx264** CPU fallback  

### Requirements

Install these on Windows **before** cloning and running:

| Tool | Why | Notes |
|------|-----|--------|
| [Node.js](https://nodejs.org/) 20+ (LTS) | Frontend + Tauri CLI | Includes `npm` |
| [Rust](https://rustup.rs/) (stable) | Tauri backend | Install via `rustup` |
| [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) | MSVC linker for Rust | Workload: **Desktop development with C++** |
| WebView2 Runtime | Tauri UI shell | Usually already on Windows 10/11 |
| FFmpeg Windows x64 binary | Sidecar for probe / preview / export | See [FFmpeg sidecar](#3-add-the-ffmpeg-sidecar) |

Optional but recommended:

- An NVIDIA GPU + current drivers if you want **NVENC** hardware export  
- Without NVENC, export still works using **CPU (libx264)**

### Clone

```bash
git clone https://github.com/Abrash-Official/NovaBlend_Studio.git
cd NovaBlend_Studio
```

### Setup

#### 1) Install Node dependencies

```bash
npm install
```

#### 2) Install / verify Rust

```bash
rustc --version
cargo --version
```

If those commands fail, install Rust from https://rustup.rs, reopen the terminal, and confirm `rustc --version`.

#### 3) Add the FFmpeg sidecar

Tauri expects:

```text
src-tauri/binaries/ffmpeg-x86_64-pc-windows-msvc.exe
```

Example (PowerShell):

```powershell
Copy-Item "C:\path\to\your\ffmpeg.exe" `
  ".\src-tauri\binaries\ffmpeg-x86_64-pc-windows-msvc.exe"
```

More detail: [`src-tauri/binaries/README.md`](src-tauri/binaries/README.md)

#### 4) (Optional) Generate app icons

```bash
npm run icons
```

#### 5) Run locally (development)

**Option A — launcher**

```bat
run.bat
```

- `1` → run locally (`npm run tauri dev`)  
- `2` → build release into `src-tauri\target\release`  
- `0` → close  

**Option B — terminal**

```bash
npm run tauri dev
```

### Build a Windows release / installer

```bash
npm run tauri build
```

Outputs (after a successful build):

- App: `src-tauri/target/release/novablend-studio.exe`
- Bundled FFmpeg copy: `src-tauri/target/release/ffmpeg.exe`
- NSIS setup: `src-tauri/target/release/bundle/nsis/`
- MSI: `src-tauri/target/release/bundle/msi/`

Saved projects (when you use **Save**) are written next to the running `.exe` (e.g. `projects/*.nbs.json`). Those folders are gitignored.

### Desktop features (high level)

- Media Bin import (video/audio), HEVC → H.264 preview proxies  
- Multi-track timeline, preview, effects, keyframes  
- Export dialog: FPS / resolution presets + progress  
- Project New / Open / Save  

### Desktop troubleshooting

| Problem | Fix |
|---------|-----|
| `cargo` / `rustc` not found | Install Rust from https://rustup.rs and reopen the terminal (or use `run.bat`) |
| Port `1420` already in use | Close the other NovaBlend / Vite process, then run again |
| Preview stays black / “Processing” forever | Wait until Media Bin shows **Ready**; HEVC needs a preview proxy |
| NVENC export fails | Update NVIDIA drivers, or rely on automatic **libx264** fallback |
| Missing FFmpeg sidecar | Copy `ffmpeg.exe` to `src-tauri/binaries/ffmpeg-x86_64-pc-windows-msvc.exe` |

---

## Mobile (iOS & Android)

Phone-first editor in **`NovaBlend Studio Mobile/`** (same repo). Full details: [`NovaBlend Studio Mobile/README.md`](./NovaBlend%20Studio%20Mobile/README.md).

### Run (development)

```bash
cd "NovaBlend Studio Mobile"
npm install
npx expo start
```

Then use Expo Go, an iOS simulator, or an Android emulator.

### Mobile builds

- **Android APK (local):** `NovaBlend Studio Mobile/dist/app-release.apk`  
- **iOS:** requires `npx eas-cli login` then `npx eas-cli build --platform ios --profile preview` (cloud; cannot compile iOS on Windows)

See [`NovaBlend Studio Mobile/README.md`](./NovaBlend%20Studio%20Mobile/README.md) for full build notes.

### Notes

- In-app **update banner** can point at GitHub Releases (free notice; install is still manual on iOS)  
- Project package share works now; native **MP4 export** is planned for a later mobile step  

---

## License / notes

This project is provided as a personal/portfolio video editor (desktop + mobile).
