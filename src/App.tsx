import { ExportDialog } from "./components/ExportDialog";
import { HomeScreen } from "./components/HomeScreen";
import { MediaBin } from "./components/MediaBin";
import { PreviewPlayer } from "./components/PreviewPlayer";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { Timeline } from "./components/Timeline";
import { Toolbar } from "./components/Toolbar";
import { useEditorStore } from "./store/editorStore";

export default function App() {
  const view = useEditorStore((s) => s.view);
  const status = useEditorStore((s) => s.status);
  const processingCount = useEditorStore((s) => s.processingCount);
  const exporting = useEditorStore((s) => s.exporting);
  const exportPercent = useEditorStore((s) => s.exportPercent);
  const projectName = useEditorStore((s) => s.projectName);
  const dirty = useEditorStore((s) => s.dirty);
  const projectPath = useEditorStore((s) => s.projectPath);

  if (view === "home") {
    return <HomeScreen />;
  }

  return (
    <div className="app-shell">
      <Toolbar />
      <ExportDialog />

      <main className="grid min-h-0 grid-cols-[240px_1fr_280px] gap-2 p-2 pb-0">
        <MediaBin />
        <PreviewPlayer />
        <PropertiesPanel />
      </main>

      <Timeline />

      <footer className="flex items-center gap-2 border-t border-[var(--line)] bg-[var(--bg-1)] px-2 text-[10px] text-[var(--muted)]">
        <span className="truncate">
          {processingCount > 0 || exporting ? (
            <span className="text-[var(--warn)]">
              {exporting ? `Export ${exportPercent.toFixed(0)}% · ${status}` : status}
            </span>
          ) : (
            status
          )}
        </span>
        <span className="ml-auto shrink-0 truncate" title={projectPath || undefined}>
          {projectName}
          {dirty ? "*" : ""}
          {projectPath ? " · saved" : " · unsaved"}
        </span>
      </footer>
    </div>
  );
}
