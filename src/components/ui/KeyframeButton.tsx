/** CapCut-style diamond keyframe toggle. */
export function KeyframeButton({
  active,
  disabled,
  onClick,
  title,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      className={`kf-diamond ${active ? "active" : ""}`}
      disabled={disabled}
      title={title || (active ? "Remove keyframe" : "Add keyframe at playhead")}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-pressed={active}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
        <path d="M5 0.8 L9.2 5 L5 9.2 L0.8 5 Z" fill="currentColor" />
      </svg>
    </button>
  );
}
