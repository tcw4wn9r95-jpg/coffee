import { useId, useRef, useState } from "react";
import {
  OPUS,
  OPUS_TICKS_MAX,
  dialLabel,
  dialNumber,
  fromTicks,
  grindMicrons,
  ticksTotal,
  unifiedLabel,
} from "../lib/gear";

/**
 * Fellow Opus grind picker, laid out and driven the way the Beanie app is:
 *
 *   COARSE   · · 1 · · · 2 · · ·      drag → steps outer-dial clicks
 *   FINE     − · · · • · · · +        drag → steps inner-ring micro-ticks
 *   UNIFIED  1.25   ~250 µm           the single number covering both dials
 *
 * Both rows are wheels: the current setting sits under a fixed centre caret and
 * the scale slides under your finger, one detent per notch of travel. A dial
 * with detents has no business behind a number input — you can't feel your way
 * to "click 7" by typing, and the number tells you nothing about how far you
 * are from the next printed marking. Dragging the scale shows both.
 *
 * Both rows move the same underlying value — the absolute position in
 * micro-ticks (1…123). The outer dial steps it by 3, the inner ring by 1, which
 * is exactly the mechanical relationship, so a ring drag rolls over into the
 * next click on its own instead of dead-ending at the end of its travel.
 *
 * Read-only without `onChange` (the recipe view's dial map); interactive with
 * it (the editor). Pointer events cover touch, pen and mouse alike, and the
 * rows are focusable with arrow-key stepping for keyboard and screen readers.
 */

const VIEW_W = 280;
const CX = 140;
const COARSE_STEP = 20; // px per outer click — drag distance matches the scale
const FINE_STEP = 26; // px per micro-tick

const TAP_SLOP = 5; // px of travel below which a gesture counts as a tap

/**
 * Turns a horizontal drag into detent steps, and a tap into a jump.
 *
 * Travel is matched 1:1 to the drawn spacing so the scale tracks the finger,
 * and each position is mapped ABSOLUTELY from where the drag began rather than
 * accumulated per event — the scale can't drift out of sync with the finger,
 * and it can't stall on a stale value part-way through a long drag.
 *
 * The move/up listeners go on the window rather than the element: pointer
 * capture on SVG nodes is unreliable (notably in iOS Safari, where a failed
 * capture would silently kill the whole gesture), and window listeners keep the
 * drag alive when the finger wanders off the row.
 */
function useScaleDrag(
  stepPx: number,
  /** Micro-ticks moved per detent of this scale: 3 for a click, 1 for a ring tick. */
  unit: number,
  ticksRef: React.MutableRefObject<number>,
  applyRef: React.MutableRefObject<(t: number) => void>
) {
  const [active, setActive] = useState(false);

  const onPointerDown = (e: React.PointerEvent<SVGRectElement>) => {
    if (e.button > 0) return; // primary button / any touch only
    const x0 = e.clientX;
    const t0 = ticksRef.current;
    const el = e.currentTarget;
    let moved = 0;
    setActive(true);

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - x0;
      moved = Math.max(moved, Math.abs(dx));
      // Drag right → the scale slides right → finer values reach the centre.
      applyRef.current(t0 - Math.round(dx / stepPx) * unit);
    };

    const end = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      setActive(false);
      if (moved >= TAP_SLOP) return; // a drag — already applied
      const box = el.ownerSVGElement?.getBoundingClientRect();
      if (!box?.width) return;
      const svgX = ((ev.clientX - box.left) / box.width) * VIEW_W;
      const delta = Math.round((svgX - CX) / stepPx);
      if (delta) applyRef.current(t0 + delta * unit);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };

  return { active, onPointerDown };
}

export function OpusDial({
  macro,
  micro,
  size = 300,
  onChange,
}: {
  /** Current outer-dial click (1–41). */
  macro?: number;
  /** Current inner-ring position — ticks toward "−" (0–2). */
  micro?: number;
  size?: number;
  /** Provide to make the two scales draggable; omit for a read-only map. */
  onChange?: (next: { grinderMacro: number; grinderMicro: number }) => void;
}) {
  const uid = useId().replace(/:/g, "");
  const click = Math.min(OPUS.clicksTotal, Math.max(1, Math.round(macro ?? 1)));
  const ring = Math.min(OPUS.microPerClick - 1, Math.max(0, Math.round(micro ?? 0)));
  const here = { grinderMacro: click, grinderMicro: ring };
  const ticks = ticksTotal(here);
  const interactive = !!onChange;

  const setTicks = (t: number) => {
    if (!onChange) return;
    const next = fromTicks(t);
    if (next.grinderMacro !== click || next.grinderMicro !== ring) onChange(next);
  };
  // A click is 3 micro-ticks, so the coarse scale steps by 3 and carries the
  // ring offset along with it — same as clicking the physical dial.
  const stepClicks = (d: number) => setTicks(ticks + d * OPUS.microPerClick);
  const stepMicro = (d: number) => setTicks(ticks + d);

  // A drag reads these on every pointer event, long after the render that
  // started it, so they must always hold the latest value and setter.
  const ticksRef = useRef(ticks);
  ticksRef.current = ticks;
  const applyRef = useRef(setTicks);
  applyRef.current = setTicks;

  const coarse = useScaleDrag(COARSE_STEP, OPUS.microPerClick, ticksRef, applyRef);
  const fine = useScaleDrag(FINE_STEP, 1, ticksRef, applyRef);

  const arrowKeys = (step: (d: number) => void) => (e: React.KeyboardEvent) => {
    const d = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
    if (!d) return;
    e.preventDefault();
    step(d);
  };

  const rowProps = (
    row: ReturnType<typeof useScaleDrag>,
    step: (d: number) => void,
    label: string,
    now: number,
    max: number
  ) =>
    interactive
      ? {
          onPointerDown: row.onPointerDown,
          onKeyDown: arrowKeys(step),
          tabIndex: 0,
          role: "slider" as const,
          "aria-label": label,
          "aria-valuemin": 1,
          "aria-valuemax": max,
          "aria-valuenow": now,
          "aria-valuetext": `${unifiedLabel(here)}, ${dialLabel(here)}`,
          // `none`, not `pan-y`: a diagonal drag would otherwise be claimed by
          // the browser as a scroll and cancel the gesture mid-turn.
          style: {
            touchAction: "none" as const,
            cursor: "ew-resize",
            userSelect: "none" as const,
          },
        }
      : {};

  // Ticks drawn either side of centre — enough to run off both edges.
  const coarseFrom = Math.max(1, click - 8);
  const coarseTo = Math.min(OPUS.clicksTotal, click + 8);
  const fineFrom = Math.max(1, ticks - 6);
  const fineTo = Math.min(OPUS_TICKS_MAX, ticks + 6);

  const caret = (y: number, on: boolean) => (
    <path
      d={`M ${CX} ${y} l 5 7 l -10 0 Z`}
      fill={on ? "var(--clay)" : "var(--ink-soft)"}
      opacity={on ? 1 : 0.6}
    />
  );

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} 272`}
      width={size}
      height={size * (272 / VIEW_W)}
      role={interactive ? "group" : "img"}
      aria-label="Fellow Opus grind setting"
      style={{ display: "block", margin: "0 auto", maxWidth: "100%" }}
    >
      <defs>
        <clipPath id={`coarse-${uid}`}>
          <rect x="0" y="20" width={VIEW_W} height="58" />
        </clipPath>
        <clipPath id={`fine-${uid}`}>
          <rect x="0" y="120" width={VIEW_W} height="50" />
        </clipPath>
        <linearGradient id={`fade-${uid}`} x1="0" x2="1">
          <stop offset="0" stopColor="var(--surface)" stopOpacity="1" />
          <stop offset="0.12" stopColor="var(--surface)" stopOpacity="0" />
          <stop offset="0.88" stopColor="var(--surface)" stopOpacity="0" />
          <stop offset="1" stopColor="var(--surface)" stopOpacity="1" />
        </linearGradient>
      </defs>

      {/* ---------- COARSE — outer dial ---------- */}
      <text x="8" y="12" fontSize="10" letterSpacing="0.12em" fontWeight="700" fill="var(--ink-soft)">
        COARSE
      </text>
      <text x={VIEW_W - 8} y="12" textAnchor="end" fontSize="9.5" fill="var(--ink-soft)" opacity="0.75">
        outer dial · 41 clicks · ~50 µm each
      </text>

      <g clipPath={`url(#coarse-${uid})`}>
        <line x1="0" y1="52" x2={VIEW_W} y2="52" stroke="var(--ink-soft)" strokeWidth="1.2" opacity="0.25" />
        {Array.from({ length: coarseTo - coarseFrom + 1 }, (_, i) => coarseFrom + i).map((c) => {
          const x = CX + (c - click) * COARSE_STEP;
          const numbered = (c - 1) % OPUS.clicksPerNumber === 0;
          const on = c === click;
          return (
            <g key={c}>
              <line
                x1={x}
                y1={numbered ? 40 : 46}
                x2={x}
                y2={numbered ? 64 : 58}
                stroke={on ? "var(--clay)" : "var(--ink-soft)"}
                strokeWidth={on ? 3 : numbered ? 1.8 : 1}
                strokeLinecap="round"
                opacity={on ? 1 : numbered ? 0.85 : 0.45}
              />
              {numbered && (
                <text
                  x={x}
                  y="33"
                  textAnchor="middle"
                  fontFamily="var(--serif)"
                  fontSize={on ? 14 : 12}
                  fontWeight={on ? 700 : 500}
                  fill={on ? "var(--clay)" : "var(--ink)"}
                >
                  {dialNumber(c)}
                </text>
              )}
            </g>
          );
        })}
        <rect x="0" y="20" width={VIEW_W} height="58" fill={`url(#fade-${uid})`} pointerEvents="none" />
      </g>
      {caret(68, coarse.active)}
      <rect x="0" y="20" width={VIEW_W} height="58" fill="transparent" {...rowProps(coarse, stepClicks, "Outer dial click", click, OPUS.clicksTotal)} />

      <text x="8" y="90" fontSize="10" fill="var(--clay)" letterSpacing="0.08em" fontWeight="600">
        ← FINER
      </text>
      <text x={VIEW_W - 8} y="90" fontSize="10" fill="var(--ink-soft)" letterSpacing="0.08em" fontWeight="600" textAnchor="end">
        COARSER →
      </text>

      <line x1="8" y1="100" x2={VIEW_W - 8} y2="100" stroke="var(--line)" strokeWidth="1" />

      {/* ---------- FINE — inner ring ---------- */}
      <text x="8" y="114" fontSize="10" letterSpacing="0.12em" fontWeight="700" fill="var(--ink-soft)">
        FINE
      </text>
      <text x={VIEW_W - 8} y="114" textAnchor="end" fontSize="9.5" fill="var(--ink-soft)" opacity="0.75">
        inner ring · 3 per click · ~17 µm each
      </text>

      <g clipPath={`url(#fine-${uid})`}>
        <line x1="0" y1="146" x2={VIEW_W} y2="146" stroke="var(--ink-soft)" strokeWidth="1.2" opacity="0.25" />
        {Array.from({ length: fineTo - fineFrom + 1 }, (_, i) => fineFrom + i).map((t) => {
          const x = CX + (t - ticks) * FINE_STEP;
          const detent = t % OPUS.microPerClick === 0; // this tick is a full click
          const on = t === ticks;
          return (
            <circle
              key={t}
              cx={x}
              cy="146"
              r={on ? 5.5 : detent ? 3.6 : 2.4}
              fill={on ? "var(--clay)" : detent ? "var(--ink-soft)" : "var(--surface)"}
              stroke={on ? "var(--clay)" : "var(--ink-soft)"}
              strokeWidth="1.2"
              opacity={on ? 1 : detent ? 0.7 : 0.5}
            />
          );
        })}
        <rect x="0" y="120" width={VIEW_W} height="50" fill={`url(#fade-${uid})`} pointerEvents="none" />
      </g>
      <text x="8" y="152" fontFamily="var(--serif)" fontSize="20" fontWeight="700" fill="var(--clay)">
        −
      </text>
      <text x={VIEW_W - 8} y="152" textAnchor="end" fontFamily="var(--serif)" fontSize="20" fontWeight="700" fill="var(--ink-soft)">
        +
      </text>
      {caret(160, fine.active)}
      <rect x="0" y="120" width={VIEW_W} height="50" fill="transparent" {...rowProps(fine, stepMicro, "Inner ring micro-tick", ticks, OPUS_TICKS_MAX)} />

      <text x="8" y="182" fontSize="10" fill="var(--clay)" letterSpacing="0.08em" fontWeight="600">
        ← toward −
      </text>
      <text x={VIEW_W - 8} y="182" fontSize="10" fill="var(--ink-soft)" letterSpacing="0.08em" fontWeight="600" textAnchor="end">
        toward + →
      </text>

      <line x1="8" y1="192" x2={VIEW_W - 8} y2="192" stroke="var(--line)" strokeWidth="1" />

      {/* ---------- UNIFIED GRIND SIZE ---------- */}
      <text x={CX} y="208" textAnchor="middle" fontSize="10" letterSpacing="0.12em" fontWeight="700" fill="var(--ink-soft)">
        UNIFIED GRIND SIZE
      </text>
      <rect x={CX - 46} y="216" width="92" height="34" rx="10" fill="var(--clay-tint)" />
      <text
        x={CX}
        y="241"
        textAnchor="middle"
        fontFamily="var(--serif)"
        fontSize="24"
        fontWeight="700"
        fill="var(--clay-deep)"
      >
        {unifiedLabel(here)}
      </text>
      <text x={CX} y="264" textAnchor="middle" fontSize="10.5" fill="var(--ink-soft)">
        ~{grindMicrons(here)} µm · {dialLabel(here)}
      </text>
    </svg>
  );
}
