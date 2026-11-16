import { CSSProperties, ReactNode } from "react";

type IconProps = {
  size?: number;
  className?: string;
  style?: CSSProperties;
};

function Svg({
  size = 14,
  className,
  style,
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function IconTrash(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
    </Svg>
  );
}

export function IconSplit(props: IconProps) {
  return (
    <Svg {...props}>
      {/* Professional razor / blade cut */}
      <path d="M4 4l6 6" />
      <path d="M14 14l6 6" />
      <path d="M10 4l10 10" />
      <circle cx="7.5" cy="7.5" r="2.2" />
      <circle cx="16.5" cy="16.5" r="2.2" />
      <path d="M12 2v20" strokeDasharray="2 3" />
    </Svg>
  );
}

export function IconCopy(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="9" y="9" width="11" height="11" rx="1.5" />
      <path d="M5 15V5.5A1.5 1.5 0 0 1 6.5 4H15" />
    </Svg>
  );
}

export function IconReverse(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 7h9a4 4 0 0 1 0 8h-9" />
      <path d="M10 4L7 7l3 3" />
      <path d="M14 20l3-3-3-3" />
    </Svg>
  );
}

export function IconFreeze(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 2v20" />
      <path d="M12 12l4-7" />
      <path d="M12 12l-4-7" />
      <path d="M12 12l4 7" />
      <path d="M12 12l-4 7" />
      <path d="M4.5 9.5h15" />
      <path d="M4.5 14.5h15" />
    </Svg>
  );
}

export function IconImport(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3v12" />
      <path d="M8 11l4 4 4-4" />
      <path d="M4 19h16" />
    </Svg>
  );
}

export function IconAdd(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function IconText(props: IconProps) {
  return (
    <Svg {...props}>
      {/* Professional T-box title tool */}
      <rect x="3.5" y="4" width="17" height="16" rx="2" />
      <path d="M8 9h8" strokeWidth="2" />
      <path d="M12 9v8" strokeWidth="2" />
    </Svg>
  );
}

export function IconAudio(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 18V6l10-2v12" />
      <circle cx="7" cy="18" r="2.5" />
      <circle cx="17" cy="16" r="2.5" />
    </Svg>
  );
}

export function IconMore(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconFolder(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6H9l2 2h8.5A1.5 1.5 0 0 1 21 9.5v8A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-10z" />
    </Svg>
  );
}

export function IconRename(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </Svg>
  );
}

export function IconReveal(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M14 3h7v7" />
      <path d="M10 14L21 3" />
      <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
    </Svg>
  );
}

export function IconMedia(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M10 9l5 3-5 3V9z" />
    </Svg>
  );
}

export function IconStickers(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3l2.2 4.5L19 8.2l-3.5 3.4.8 4.9L12 14.8 7.7 16.5l.8-4.9L5 8.2l4.8-.7L12 3z" />
    </Svg>
  );
}

export function IconEffects(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
      <circle cx="12" cy="12" r="4.5" />
    </Svg>
  );
}

export function IconTransitions(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h7l4 5-4 5H4" />
      <path d="M13 7h7v10h-7" />
    </Svg>
  );
}

export function IconCaptions(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 15h4M13 15h4M7 11h10" />
    </Svg>
  );
}

export function IconFilters(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 5h16l-6 7.5V19l-4-2v-4.5L4 5z" />
    </Svg>
  );
}

export function IconLock(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="11" width="14" height="10" rx="1.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Svg>
  );
}

export function IconUnlock(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="11" width="14" height="10" rx="1.5" />
      <path d="M8 11V8a4 4 0 0 1 7.5-1.8" />
    </Svg>
  );
}

export function IconEye(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

export function IconEyeOff(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a3 3 0 0 0 4.2 4.2" />
      <path d="M9.9 5.2A10.6 10.6 0 0 1 12 5c6 0 10 7 10 7a17.4 17.4 0 0 1-4.2 4.5" />
      <path d="M6.1 6.1C3.9 7.7 2 12 2 12a17.5 17.5 0 0 0 6.4 5.4" />
    </Svg>
  );
}

export function IconMute(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M11 5L6 9H3v6h3l5 4V5z" />
      <path d="M23 9l-6 6M17 9l6 6" />
    </Svg>
  );
}

export function IconVolume(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M11 5L6 9H3v6h3l5 4V5z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </Svg>
  );
}

export function IconUndo(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10a5 5 0 0 1 0 10h-3" />
    </Svg>
  );
}

export function IconRedo(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M15 14l5-5-5-5" />
      <path d="M20 9H10a5 5 0 0 0 0 10h3" />
    </Svg>
  );
}

export function IconCrop(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 3v13a2 2 0 0 0 2 2h13" />
      <path d="M18 21V8a2 2 0 0 0-2-2H3" />
    </Svg>
  );
}

export function IconKeyframe(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3l7 9-7 9-7-9 7-9z" />
    </Svg>
  );
}

export function IconMagnet(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 4v8a6 6 0 0 0 12 0V4" />
      <path d="M6 4h3v8M15 4h3v8" />
    </Svg>
  );
}

export function IconFullscreen(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 9V4h5" />
      <path d="M20 9V4h-5" />
      <path d="M4 15v5h5" />
      <path d="M20 15v5h-5" />
    </Svg>
  );
}

export function IconRemoveBg(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5" />
      <path d="M3 3l18 18" />
    </Svg>
  );
}
