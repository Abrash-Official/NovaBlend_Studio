import { useEffect, useMemo, useState } from "react";
import { captureFilmFrame, filmCellCount } from "../lib/filmstrip";

type Props = {
  path: string;
  width: number;
  height: number;
  inPoint: number;
  outPoint: number;
  /** Optional single poster while frames load */
  fallbackThumb?: string;
};

const CELL_W = 56;

export function ClipFilmstrip({
  path,
  width,
  height,
  inPoint,
  outPoint,
  fallbackThumb,
}: Props) {
  const cells = useMemo(() => filmCellCount(width, CELL_W), [width]);
  const [frames, setFrames] = useState<(string | null)[]>([]);

  const times = useMemo(() => {
    const span = Math.max(0.05, outPoint - inPoint);
    return Array.from({ length: cells }, (_, i) => {
      const t = inPoint + ((i + 0.5) / cells) * span;
      return t;
    });
  }, [cells, inPoint, outPoint]);

  useEffect(() => {
    let alive = true;
    if (!path || width < 12 || height < 8) {
      setFrames([]);
      return;
    }
    setFrames(Array(times.length).fill(null));
    void (async () => {
      const next: (string | null)[] = [];
      for (let i = 0; i < times.length; i++) {
        if (!alive) return;
        const url = await captureFilmFrame(path, times[i]);
        next.push(url);
        if (alive && (i % 2 === 1 || i === times.length - 1)) {
          setFrames([...next]);
        }
      }
      if (alive) setFrames(next);
    })();
    return () => {
      alive = false;
    };
  }, [path, width, height, times]);

  if (!path || width < 12) return null;

  const hasAny = frames.some(Boolean);

  return (
    <div className="tl-filmstrip-strip" style={{ height }}>
      {fallbackThumb && !hasAny && (
        <div
          className="tl-filmstrip-fallback"
          style={{ backgroundImage: `url(${fallbackThumb})` }}
        />
      )}
      <div className="tl-filmstrip-cells" style={{ width }}>
        {times.map((_, i) => {
          const src = frames[i];
          return (
            <div
              key={i}
              className="tl-filmstrip-cell"
              style={{
                width: CELL_W,
                backgroundImage: src ? `url(${src})` : undefined,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
