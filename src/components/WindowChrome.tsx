import { getCurrentWindow } from "@tauri-apps/api/window";
import { ReactNode } from "react";

/** Frameless window drag strip + min/max/close (used on Home when Toolbar is hidden). */
export function WindowChrome({
  children,
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  async function winAction(kind: "min" | "max" | "close") {
    try {
      const win = getCurrentWindow();
      if (kind === "min") await win.minimize();
      else if (kind === "max") await win.toggleMaximize();
      else await win.close();
    } catch {
      /* permission / runtime */
    }
  }

  return (
    <div className={`titlebar home-titlebar ${className}`}>
      <div className="titlebar-brand" data-tauri-drag-region>
        <img src="/icon.svg" alt="" className="titlebar-logo-img" draggable={false} />
        <span className="titlebar-name" data-tauri-drag-region>
          NovaBlend Studio
        </span>
      </div>
      <div className="titlebar-spacer" data-tauri-drag-region />
      {children}
      <div className="window-controls">
        <button
          type="button"
          className="win-btn"
          title="Minimize"
          onClick={() => void winAction("min")}
        >
          ─
        </button>
        <button
          type="button"
          className="win-btn"
          title="Maximize"
          onClick={() => void winAction("max")}
        >
          □
        </button>
        <button
          type="button"
          className="win-btn win-close"
          title="Close"
          onClick={() => void winAction("close")}
        >
          ×
        </button>
      </div>
    </div>
  );
}
