# NovaBlend Studio

Windows-native multi-track video editor built with **Tauri (Rust)**, **React**, **TypeScript**, and **Tailwind CSS**.

- Preview + timeline editing in the UI  
- Export via a bundled **FFmpeg** sidecar  
- Prefers **`h264_nvenc`** (NVIDIA GPU), with automatic **libx264** CPU fallback  

**Author / GitHub:** [Abrash-Official](https://github.com/Abrash-Official)

---

## Requirements

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

---

## Clone the repository

```bash
git clone https://github.com/Abrash-Official/NovaBlend_Studio.git
cd NovaBlend_Studio
```

---

## Setup (from start to finish)

### 1) Install Node dependencies

```bash
npm install
```

### 2) Install / verify Rust

```bash
rustc --version
cargo --version
```

If those commands fail, install Rust:

```bash
# Download and run rustup-init from https://rustup.rs
# Then reopen the terminal and confirm:
rustc --version
```

### 3) Add the FFmpeg sidecar

Tauri expects this file:

```text
src-tauri/binaries/ffmpeg-x86_64-pc-windows-msvc.exe
```

Example (PowerShell) if FFmpeg is already on your machine:

```powershell
Copy-Item "C:\path\to\your\ffmpeg.exe" `
  ".\src-tauri\binaries\ffmpeg-x86_64-pc-windows-msvc.exe"
```

More detail: [`src-tauri/binaries/README.md`](src-tauri/binaries/README.md)

### 4) (Optional) Generate app icons

```bash
npm run icons
```

This uses `icon.svg` to regenerate icons under `src-tauri/icons/`.

### 5) Run locally (development)

**Option A — launcher**

```bat
run.bat
```

Then choose:

- `1` → run locally (`npm run tauri dev`)  
- `2` → build release into `src-tauri\target\release`  
- `0` → close  

**Option B — terminal**

```bash
npm run tauri dev
```

Make sure `%USERPROFILE%\.cargo\bin` is on your PATH (or use `run.bat`, which adds it for you).

---

## Build a Windows release / installer

```bash
npm run tauri build
```

Outputs (after a successful build):

- App: `src-tauri/target/release/novablend-studio.exe`
- Bundled FFmpeg copy: `src-tauri/target/release/ffmpeg.exe`
- NSIS setup: `src-tauri/target/release/bundle/nsis/`
- MSI: `src-tauri/target/release/bundle/msi/`

Saved projects (when you use **Save** in the app) are written next to the running `.exe`, for example:

- Dev: `src-tauri/target/debug/projects/*.nbs.json`
- Release: `src-tauri/target/release/projects/*.nbs.json`

Those folders are gitignored.

---

## Everyday workflow (short)

1. Clone the repo  
2. `npm install`  
3. Put FFmpeg into `src-tauri/binaries/` with the required filename  
4. `npm run tauri dev` (or `run.bat` → `1`)  
5. Import media → wait until Media Bin says **Ready** → add to timeline → edit → **Export**  

---

## Features (high level)

- Media Bin import (video/audio), processing progress for HEVC → H.264 preview proxies  
- Multi-track timeline (V1, V2 overlay, A1)  
- Preview with playback, trim/split, effects, keyframes scaffolding  
- Export dialog: FPS (25 / 30 / 60), resolution (720p / 1080p / 2K / 4K / custom)  
- Export progress (% + ETA)  
- Project New / Open / Save (JSON next to the app executable)  

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `cargo` / `rustc` not found | Install Rust from https://rustup.rs and reopen the terminal (or use `run.bat`) |
| Port `1420` already in use | Close the other NovaBlend / Vite process, then run again |
| Preview stays black / “Processing” forever | Wait until Media Bin shows **Ready**; HEVC needs a preview proxy |
| NVENC export fails | Update NVIDIA drivers, or rely on automatic **libx264** fallback |
| Missing FFmpeg sidecar | Copy `ffmpeg.exe` to `src-tauri/binaries/ffmpeg-x86_64-pc-windows-msvc.exe` |

---

## License / notes

This project is provided as a personal/portfolio desktop video editor.  
Large binaries (`.exe`, FFmpeg, installers, `target/`) are intentionally **not** pushed to GitHub.
