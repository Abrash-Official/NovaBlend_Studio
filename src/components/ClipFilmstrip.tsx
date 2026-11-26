import { useEffect, useMemo, useRef, useState } from "react";
import { captureFilmFrame, planFilmstrip } from "../lib/filmstrip";

type Props = {
  path: string;
  width: number;
  height: number;
  inPoint: number;
  outPoint: number;
  zoom: number;
  clipLeftPx: number;
  scrollLeft: number;
  viewportWidth: number;
  fallbackThumb?: string;
};

export function ClipFilmstrip({
  path,
  width,
  height,
  inPoint,
  outPoint,
  zoom,
  clipLeftPx,
  scrollLeft,
  viewportWidth,
  fallbackThumb,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  const visiblePx = useMemo(() => {
    const start = scrollLeft - clipLeftPx;
    const end = start + Math.max(160, viewportWidth);
    return { start, end };
  }, [scrollLeft, clipLeftPx, viewportWidth]);

  const plan = useMemo(
    () => planFilmstrip(width, zoom, inPoint, outPoint, visiblePx),
    [width, zoom, inPoint, outPoint, visiblePx],
  );

  const [frames, setFrames] = useState<Record<string, string>>({});

  useEffect(() => {
    const el = hostRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) setVisible(e.isIntersecting);
      },
      { root: null, rootMargin: "100px", threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    let alive = true;
    if (!path || width < 12 || height < 8 || !visible) return;

    void (async () => {
      for (let i = 0; i < plan.times.length; i++) {
        if (!alive) return;
        const t = plan.times[i];
        const key = t.toFixed(1);
        const url = await captureFilmFrame(path, t);
        if (!alive || !url) continue;
        setFrames((prev) => {
          if (prev[key] === url) return prev;
          return { ...prev, [key]: url };
        });
      }
    })();

    return () => {
      alive = false;
    };
  }, [path, width, height, visible, plan]);

  if (!path || width < 12) return null;

  const hasAny = Object.keys(frames).length > 0;

  return (
    <div ref={hostRef} className="tl-filmstrip-strip" style={{ height, width }}>
      {fallbackThumb && !hasAny && (
        <div
          className="tl-filmstrip-fallback"
          style={{ backgroundImage: `url(${fallbackThumb})` }}
        />
      )}
      <div className="tl-filmstrip-cells" style={{ width, height }}>
        {plan.times.map((t, i) => {
          const src = frames[t.toFixed(1)];
          return (
            <div
              key={`${t.toFixed(1)}-${plan.offsets[i]}`}
              className="tl-filmstrip-cell"
              style={{
                left: plan.offsets[i],
                width: plan.cellW,
                height: "100%",
              }}
            >
              {src ? (
                <img src={src} alt="" draggable={false} />
              ) : (
                <div className="tl-filmstrip-cell-ph" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
