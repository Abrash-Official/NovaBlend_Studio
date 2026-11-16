import { useEffect, useRef } from "react";
import { saveCurrentProject } from "../lib/saveProject";
import { useEditorStore } from "../store/editorStore";

const INTERVAL_MS = 20_000;
const DEBOUNCE_MS = 4_000;

/** Periodically persist dirty projects while editing. */
export function useAutoSave(enabled: boolean) {
  const dirty = useEditorStore((s) => s.dirty);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const tick = async () => {
      const s = useEditorStore.getState();
      if (!s.dirty || s.view !== "editor" || s.exporting || saving.current) return;
      saving.current = true;
      try {
        await saveCurrentProject({ promptIfUntitled: false, silent: true });
      } finally {
        saving.current = false;
      }
    };

    const interval = setInterval(() => {
      void tick();
    }, INTERVAL_MS);

    return () => clearInterval(interval);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !dirty) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const s = useEditorStore.getState();
      if (!s.dirty || s.view !== "editor" || s.exporting || saving.current) return;
      saving.current = true;
      void saveCurrentProject({ promptIfUntitled: false, silent: true }).finally(() => {
        saving.current = false;
      });
    }, DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [enabled, dirty]);
}
