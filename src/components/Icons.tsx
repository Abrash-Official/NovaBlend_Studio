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
      <path d="M12 3v18" />
      <path d="M5 8l7 4 7-4" />
      <path d="M5 16l7-4 7 4" />
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
      <path d="M4 6h16" />
      <path d="M12 6v12" />
      <path d="M8 18h8" />
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
