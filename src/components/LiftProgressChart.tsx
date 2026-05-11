"use client";

import type { LiftProgressPoint } from "@/lib/domain/liftProgression";

const VIEW_W = 420;
const VIEW_H = 168;
const PAD = { t: 14, r: 10, b: 30, l: 44 };

function niceStep(range: number, targetTicks: number): number {
  if (!Number.isFinite(range) || range <= 0) return 1;
  const raw = range / targetTicks;
  const exp = Math.floor(Math.log10(raw));
  const f = raw / 10 ** exp;
  let nf = 1;
  if (f <= 1) nf = 1;
  else if (f <= 2) nf = 2;
  else if (f <= 5) nf = 5;
  else nf = 10;
  return nf * 10 ** exp;
}

function xDomain(points: LiftProgressPoint[]): [number, number] {
  const ts = points.map((p) => p.at);
  const min = Math.min(...ts);
  const max = Math.max(...ts);
  if (min === max) return [min - 86_400_000, max + 86_400_000];
  const span = max - min;
  const pad = span * 0.04;
  return [min - pad, max + pad];
}

function yDomain(points: LiftProgressPoint[]): [number, number] {
  const ws = points.map((p) => p.kg);
  const min = Math.min(...ws);
  const max = Math.max(...ws);
  if (min === max) {
    const d = Math.max(2.5, min * 0.05);
    return [Math.max(0, min - d), max + d];
  }
  const span = max - min;
  const pad = Math.max(span * 0.08, 1);
  return [Math.max(0, min - pad), max + pad];
}

export function LiftProgressChart({
  title,
  points,
}: {
  title: string;
  points: LiftProgressPoint[];
}) {
  if (points.length === 0) {
    return (
      <div
        className="rounded-2xl border border-zinc-800 bg-zinc-900/40 px-4 py-5 sm:px-5 sm:py-6"
        role="region"
        aria-label={`${title} progression`}
      >
        <h3 className="text-lg font-medium text-white sm:text-xl">{title}</h3>
        <p className="mt-3 text-base text-zinc-500 sm:text-lg">
          No sessions with completed main work for this lift yet.
        </p>
      </div>
    );
  }

  const plotW = VIEW_W - PAD.l - PAD.r;
  const plotH = VIEW_H - PAD.t - PAD.b;
  const [x0, x1] = xDomain(points);
  const [y0, y1] = yDomain(points);
  const xSpan = x1 - x0 || 1;
  const ySpan = y1 - y0 || 1;

  const xPx = (t: number) => PAD.l + ((t - x0) / xSpan) * plotW;
  const yPx = (w: number) => PAD.t + plotH - ((w - y0) / ySpan) * plotH;

  const lineD = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${xPx(p.at).toFixed(1)} ${yPx(p.kg).toFixed(1)}`)
    .join(" ");

  const yTickStep = niceStep(ySpan, 4);
  const yTicks: number[] = [];
  const startY = Math.ceil(y0 / yTickStep) * yTickStep;
  for (let y = startY; y <= y1 + yTickStep * 0.001; y += yTickStep) {
    if (y >= y0 - 1e-6) yTicks.push(y);
    if (yTicks.length > 6) break;
  }

  const xTickCount = Math.min(4, Math.max(2, points.length));
  const xIndices = Array.from({ length: xTickCount }, (_, i) =>
    Math.round((i * (points.length - 1)) / Math.max(1, xTickCount - 1)),
  );
  const xTickPoints = [...new Set(xIndices)].map((i) => points[i]).filter(Boolean);

  const last = points[points.length - 1];
  const subtitle = `${points.length} session${points.length === 1 ? "" : "s"} · last ${last.kg} kg`;

  return (
    <div
      className="rounded-2xl border border-zinc-800 bg-zinc-900/40 px-4 py-5 sm:px-5 sm:py-6"
      role="region"
      aria-label={`${title} progression chart`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-medium text-white sm:text-xl">{title}</h3>
        <p className="text-sm text-zinc-500 sm:text-base">{subtitle}</p>
      </div>
      <div className="mt-4 w-full overflow-x-auto">
        <svg
          className="w-full max-w-full"
          style={{ minHeight: VIEW_H }}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden
        >
          <title>{title} — weight vs time</title>
          <desc>
            Line chart of heaviest completed main set in kilograms over workout
            dates.
          </desc>
          {/* plot frame */}
          <rect
            x={PAD.l}
            y={PAD.t}
            width={plotW}
            height={plotH}
            fill="none"
            stroke="rgb(39 39 42)"
            strokeWidth={1}
            rx={4}
          />
          {yTicks.map((yv) => {
            const y = yPx(yv);
            return (
              <g key={yv}>
                <line
                  x1={PAD.l}
                  x2={PAD.l + plotW}
                  y1={y}
                  y2={y}
                  stroke="rgb(39 39 42)"
                  strokeWidth={1}
                  strokeDasharray="4 6"
                  opacity={0.85}
                />
                <text
                  x={PAD.l - 6}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-zinc-500"
                  style={{ fontSize: 10 }}
                >
                  {Number.isInteger(yv) ? yv : yv.toFixed(1)}
                </text>
              </g>
            );
          })}
          {xTickPoints.map((p) => (
            <text
              key={p.at}
              x={xPx(p.at)}
              y={VIEW_H - 8}
              textAnchor="middle"
              className="fill-zinc-500"
              style={{ fontSize: 10 }}
            >
              {new Date(p.at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </text>
          ))}
          <path
            d={lineD}
            fill="none"
            stroke="rgb(52 211 153)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {points.map((p, i) => (
            <circle
              key={`${p.at}-${p.kg}-${i}`}
              cx={xPx(p.at)}
              cy={yPx(p.kg)}
              r={4}
              fill="rgb(6 95 70)"
              stroke="rgb(52 211 153)"
              strokeWidth={1.5}
            />
          ))}
        </svg>
      </div>
      <p className="mt-2 text-xs leading-snug text-zinc-600 sm:text-sm">
        Peak completed working weight on the bar each session (kg). Mirrors TM and
        template % changes over time.
      </p>
    </div>
  );
}
