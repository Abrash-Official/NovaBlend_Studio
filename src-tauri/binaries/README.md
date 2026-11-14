# FFmpeg sidecar (required)

Place a Windows x64 FFmpeg binary here with this exact name:

```text
ffmpeg-x86_64-pc-windows-msvc.exe
```

## Quick setup (PowerShell)

If you already have FFmpeg installed (for example via winget / Gyan builds):

```powershell
Copy-Item "C:\path\to\ffmpeg.exe" `
  ".\ffmpeg-x86_64-pc-windows-msvc.exe"
```

Or download a full Windows build that includes NVENC (recommended), then rename/copy it to the name above.

This folder is gitignored for `*.exe` files so large binaries are not pushed to GitHub.
