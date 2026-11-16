export function ShortcutsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  const rows: { keys: string; action: string }[] = [
    { keys: "Ctrl + S", action: "Save project" },
    { keys: "Space", action: "Play / pause" },
    { keys: "Delete / Backspace", action: "Delete selected clip" },
    { keys: "S", action: "Split clip at playhead" },
    { keys: "Ctrl + D", action: "Duplicate selected clip" },
    { keys: "← / →", action: "Nudge playhead (Shift = 1s)" },
    { keys: "J / K / L", action: "Scrub back / pause / scrub forward" },
    { keys: "[ / ]", action: "Trim in / out by 0.1s" },
    { keys: "Home", action: "Jump playhead to start" },
    { keys: "Esc", action: "Deselect clip" },
  ];

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal-card"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Keyboard shortcuts"
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold">Keyboard Shortcuts</div>
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="shortcuts-table">
          {rows.map((r) => (
            <div key={r.keys} className="shortcuts-row">
              <kbd className="shortcuts-kbd">{r.keys}</kbd>
              <span className="text-[12px]">{r.action}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
