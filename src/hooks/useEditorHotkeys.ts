import { useEffect } from "react";
import { saveCurrentProject } from "../lib/saveProject";
import { useEditorStore } from "../store/editorStore";

function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return false;
}

/** Global editor shortcuts while the project editor is open. */
export function useEditorHotkeys(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.metaKey) return;

      const s = useEditorStore.getState();
      const mod = e.ctrlKey;
      const key = e.key;

      // Ctrl+S — save project (works even while typing in fields)
      if (mod && (key === "s" || key === "S")) {
        e.preventDefault();
        void saveCurrentProject();
        return;
      }

      if (isTypingTarget(e.target)) return;

      // Space — play / pause
      if (key === " " || e.code === "Space") {
        e.preventDefault();
        s.setPlaying(!s.isPlaying);
        return;
      }

      // Delete / Backspace — remove selected clip
      if (key === "Delete" || key === "Backspace") {
        if (!s.selectedClipId) {
          s.setStatus("Select a clip to delete");
          return;
        }
        e.preventDefault();
        s.removeSelectedClip();
        return;
      }

      // Escape — deselect
      if (key === "Escape") {
        e.preventDefault();
        s.selectClip(null);
        s.setPlaying(false);
        return;
      }

      // S — split at playhead
      if (!mod && (key === "s" || key === "S")) {
        e.preventDefault();
        s.splitSelectedAtPlayhead();
        return;
      }

      // Ctrl+D — duplicate
      if (mod && (key === "d" || key === "D")) {
        e.preventDefault();
        if (!s.selectedClipId) {
          s.setStatus("Select a clip to duplicate");
          return;
        }
        s.duplicateClip(s.selectedClipId);
        return;
      }

      // Ctrl+Shift+S — also split (backup)
      if (mod && (key === "b" || key === "B")) {
        e.preventDefault();
        s.splitSelectedAtPlayhead();
        return;
      }

      // Arrow Left / Right — nudge playhead (±1 frame or ±0.1s with Shift)
      if (key === "ArrowLeft" || key === "ArrowRight") {
        e.preventDefault();
        const dir = key === "ArrowLeft" ? -1 : 1;
        const step = e.shiftKey ? 1 : 1 / Math.max(1, s.fps);
        s.setPlaying(false);
        s.setPlayhead(Math.max(0, s.playhead + dir * step));
        return;
      }

      // Home — jump to start
      if (key === "Home") {
        e.preventDefault();
        s.setPlaying(false);
        s.setPlayhead(0);
        return;
      }

      // J / L — scrub backward / forward 1s (K pause)
      if (!mod && (key === "j" || key === "J")) {
        e.preventDefault();
        s.setPlaying(false);
        s.setPlayhead(Math.max(0, s.playhead - 1));
        return;
      }
      if (!mod && (key === "k" || key === "K")) {
        e.preventDefault();
        s.setPlaying(false);
        return;
      }
      if (!mod && (key === "l" || key === "L")) {
        e.preventDefault();
        s.setPlaying(false);
        s.setPlayhead(s.playhead + 1);
        return;
      }

      // [ / ] — trim selected in/out by 0.1s
      if (!mod && key === "[") {
        if (!s.selectedClipId) return;
        e.preventDefault();
        s.trimSelected("in", 0.1);
        return;
      }
      if (!mod && key === "]") {
        if (!s.selectedClipId) return;
        e.preventDefault();
        s.trimSelected("out", 0.1);
        return;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
