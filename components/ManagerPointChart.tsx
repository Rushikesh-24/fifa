// components/ManagerPointsChart.tsx
"use client";

import { useMemo, useState, type PointerEvent } from "react";

export type ManagerSeries = {
  id: number | string;
  name: string;
  color: string;
  /** Cumulative points after each date in the shared `dates` array — same length as `dates`. */
  points: number[];
};

const VB_W = 760;
const VB_H = 380;
const PAD = { top: 16, right: 16, bottom: 32, left: 44 };
const PLOT_W = VB_W - PAD.left - PAD.right;
const PLOT_H = VB_H - PAD.top - PAD.bottom;


function fmtDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function ManagerPointsChart({ dates, series }: { dates: string[]; series: ManagerSeries[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<string | number>>(new Set());
  const [highlightId, setHighlightId] = useState<string | number | null>(null);

  const maxY = useMemo(() => {
    const m = Math.max(1, ...series.flatMap((s) => s.points));
    return Math.max(1, Math.ceil(m * 1.1));
  }, [series]);

  const xScale = (i: number) => PAD.left + (dates.length <= 1 ? 0 : (i / (dates.length - 1)) * PLOT_W);
  const yScale = (v: number) => PAD.top + PLOT_H - (v / maxY) * PLOT_H;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxY * f));

  const xTickIndices = useMemo(() => {
    const count = Math.min(6, dates.length);
    if (count <= 1) return [0];
    const idxs = new Set<number>();
    for (let i = 0; i < count; i++) idxs.add(Math.round((i / (count - 1)) * (dates.length - 1)));
    return [...idxs].sort((a, b) => a - b);
  }, [dates.length]);

  function indexFromClientX(clientX: number, currentTarget: SVGRectElement) {
    const rect = currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (!rect) return null;
    const scaleX = VB_W / rect.width;
    const localX = (clientX - rect.left) * scaleX;
    const clamped = Math.min(Math.max(localX, PAD.left), PAD.left + PLOT_W);
    const ratio = PLOT_W === 0 ? 0 : (clamped - PAD.left) / PLOT_W;
    return Math.min(Math.max(Math.round(ratio * (dates.length - 1)), 0), dates.length - 1);
  }

  function handlePointerMove(e: PointerEvent<SVGRectElement>) {
    const idx = indexFromClientX(e.clientX, e.currentTarget);
    if (idx !== null) setHoverIndex(idx);
  }

  function handlePointerDown(e: PointerEvent<SVGRectElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    handlePointerMove(e);
  }

  const toggleHidden = (id: string | number) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const visibleSeries = series.filter((s) => !hiddenIds.has(s.id));
  const activeIndex = hoverIndex ?? dates.length - 1;
  const snapshot = visibleSeries
    .map((s) => ({ id: s.id, name: s.name, color: s.color, points: s.points[activeIndex] ?? 0 }))
    .sort((a, b) => b.points - a.points);
  const legendSorted = [...series].sort(
    (a, b) => (b.points[b.points.length - 1] ?? 0) - (a.points[a.points.length - 1] ?? 0)
  );

  if (dates.length <= 1) {
    return (
      <div className="border border-[#1B2D21] bg-[#0A1610] py-14 flex flex-col items-center gap-3 text-center px-4">
        <p className="text-sm text-[#93A696]">Not enough match data yet to chart manager progress.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="border border-[#1B2D21] bg-[#0A1610] p-3 md:p-5">
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="w-full h-auto"
          role="img"
          aria-label="Manager cumulative points over time"
        >
          {/* Gridlines + Y labels */}
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={PAD.left + PLOT_W} y1={yScale(t)} y2={yScale(t)} stroke="#1B2D21" strokeWidth="1" />
              <text
                x={PAD.left - 8}
                y={yScale(t)}
                textAnchor="end"
                dominantBaseline="middle"
                fill="#93A696"
                fontSize="10"
                fontFamily="monospace"
              >
                {t}
              </text>
            </g>
          ))}

          {/* X labels */}
          {xTickIndices.map((i) => (
            <text key={i} x={xScale(i)} y={VB_H - PAD.bottom + 18} textAnchor="middle" fill="#93A696" fontSize="10" fontFamily="monospace">
              {fmtDate(dates[i])}
            </text>
          ))}

          {/* Lines */}
          {series.map((s) => {
            if (hiddenIds.has(s.id)) return null;
            const d = s.points.map((v, i) => `${i === 0 ? "M" : "L"} ${xScale(i)},${yScale(v)}`).join(" ");
            const dimmed = highlightId !== null && highlightId !== s.id;
            return (
              <path
                key={s.id}
                d={d}
                fill="none"
                stroke={s.color}
                strokeWidth={highlightId === s.id ? 3 : 2}
                opacity={dimmed ? 0.2 : 1}
                strokeLinejoin="round"
                strokeLinecap="round"
                className="transition-opacity duration-150"
              />
            );
          })}

          {/* Crosshair + dots on hover/drag */}
          {hoverIndex !== null && (
            <g>
              <line
                x1={xScale(hoverIndex)}
                x2={xScale(hoverIndex)}
                y1={PAD.top}
                y2={PAD.top + PLOT_H}
                stroke="#2ED47E"
                strokeWidth="1"
                strokeDasharray="3 3"
                opacity="0.5"
              />
              {visibleSeries.map((s) => (
                <circle
                  key={s.id}
                  cx={xScale(hoverIndex)}
                  cy={yScale(s.points[hoverIndex] ?? 0)}
                  r="3.5"
                  fill={s.color}
                  stroke="#060D09"
                  strokeWidth="1.5"
                />
              ))}
            </g>
          )}

          {/* Pointer capture layer — mouse hover or touch drag to scrub */}
          <rect
            x={PAD.left}
            y={PAD.top}
            width={PLOT_W}
            height={PLOT_H}
            fill="transparent"
            className="cursor-crosshair touch-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setHoverIndex(null)}
          />
        </svg>
      </div>

      {/* Legend — click to isolate/hide a line, sorted by current total */}
      <div className="flex flex-wrap gap-2 mt-3">
        {legendSorted.map((s) => {
          const hidden = hiddenIds.has(s.id);
          return (
            <button
              key={s.id}
              onClick={() => toggleHidden(s.id)}
              onMouseEnter={() => setHighlightId(s.id)}
              onMouseLeave={() => setHighlightId(null)}
              className={`flex items-center gap-2 text-[11px] font-semibold px-2.5 py-1.5 border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2ED47E] ${
                hidden ? "border-[#1B2D21] text-[#2D3F33]" : "border-[#1B2D21] text-[#93A696] hover:border-[#2ED47E]/40"
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: hidden ? "#2D3F33" : s.color }} />
              <span className={hidden ? "line-through" : ""}>{s.name}</span>
              <span className="font-mono text-[#2ED47E]">{s.points[s.points.length - 1] ?? 0}</span>
            </button>
          );
        })}
      </div>

      {/* Standings snapshot at the currently scrubbed (or latest) date */}
      <div className="border border-[#1B2D21] mt-4">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1B2D21] bg-[#0A1610]">
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#93A696]">
            Standings <span className="text-[#2D3F33]">as of</span> {fmtDate(dates[activeIndex])}
          </p>
          {hoverIndex !== null && (
            <button
              onClick={() => setHoverIndex(null)}
              className="text-[10px] font-bold uppercase tracking-widest text-[#2ED47E] hover:underline focus:outline-none"
            >
              Back to latest
            </button>
          )}
        </div>
        <div className="divide-y divide-[#1B2D21]">
          {snapshot.map((s, i) => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-2 text-sm">
              <span className="font-mono text-[11px] text-[#93A696] w-5 shrink-0">{i + 1}</span>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              <span className="flex-1 min-w-0 truncate text-[#EFF5EE]">{s.name}</span>
              <span className="font-mono font-bold text-[#2ED47E] tabular-nums">{s.points}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-2 text-[10px] text-[#2D3F33]">
        Drag or hover across the chart to see standings on any match day. Click a manager below the chart to hide their line.
      </p>
    </div>
  );
}