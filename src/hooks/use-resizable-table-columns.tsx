import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';

const DEFAULT_MIN = 64;
const DEFAULT_MAX = 560;

function loadMergedWidths(
  storageKey: string,
  defaults: Record<string, number>,
): Record<string, number> {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out = { ...defaults };
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    }
    return out;
  } catch {
    return { ...defaults };
  }
}

export function TableColumnResizeHandle({
  onPointerDown,
}: {
  onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label="Resize column"
      className="absolute top-0 right-0 z-20 h-full w-3 -translate-x-1/2 cursor-col-resize touch-none border-0 bg-transparent p-0 hover:bg-primary/15 active:bg-primary/25"
      onPointerDown={onPointerDown}
    />
  );
}

export function useResizableTableColumns(
  storageKey: string,
  defaultWidths: Record<string, number>,
  options?: { min?: number; max?: number },
) {
  const min = options?.min ?? DEFAULT_MIN;
  const max = options?.max ?? DEFAULT_MAX;

  const [widths, setWidths] = useState<Record<string, number>>(() =>
    loadMergedWidths(storageKey, defaultWidths),
  );

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(widths));
    } catch {
      /* ignore quota */
    }
  }, [storageKey, widths]);

  const getWidth = useCallback(
    (key: string) => {
      const w = widths[key] ?? defaultWidths[key];
      if (w == null || !Number.isFinite(w)) return min;
      return w;
    },
    [widths, defaultWidths, min],
  );

  const createResizePointerDown = useCallback(
    (columnKey: string) => (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startW = getWidth(columnKey);

      const onMove = (ev: PointerEvent) => {
        const dw = ev.clientX - startX;
        const next = Math.min(max, Math.max(min, startW + dw));
        setWidths((prev) => ({ ...prev, [columnKey]: next }));
      };
      const onEnd = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onEnd);
        window.removeEventListener('pointercancel', onEnd);
        document.body.style.removeProperty('cursor');
        document.body.style.removeProperty('user-select');
      };

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onEnd);
      window.addEventListener('pointercancel', onEnd);
    },
    [getWidth, min, max],
  );

  const thStyle = useCallback(
    (key: string): CSSProperties => ({
      width: getWidth(key),
      minWidth: min,
      maxWidth: getWidth(key),
    }),
    [getWidth, min],
  );

  const tdStyle = thStyle;

  return {
    getWidth,
    createResizePointerDown,
    thStyle,
    tdStyle,
    minWidthPx: min,
  };
}
