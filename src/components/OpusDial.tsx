import { useEffect, useId, useRef, useState } from "react";
import {
  OPUS,
  clampGrind,
  dialLabel,
  dialNumber,
  grindMicrons,
  ringLabel,
  unifiedLabel,
} from "../lib/gear";

/**
 * The Fellow Opus grind control, shaped like the grinder itself: two dials,
 * big steps on top and fine steps below.
 *
 *   COARSE   · · 1 · · · 2 · · ·      the outer dial — 41 clicks, ~50 µm each.
 *                                     A wheel: it scrolls under a fixed caret,
 *                                     because 41 positions don't fit a track.
 *
 *   FINE     − · · ▮ · · +            the inner ring — an offset from that
 *                                     click, ~17 µm a stop, up to a full click
 *                                     either way. A fixed track with a thumb
 *                                     that moves, centred on zero, because what
 *                                     you want to read off it is how far you
 *                                     have turned the ring and which way.
 *
 *   UNIFIED  1.25   ~250 µm           Beanie's single number for both dials.
 *
 * THE TWO DIALS ARE INDEPENDENT. Turning the ring does not move the outer dial
 * and clicking the dial does not move the ring — the same as the machine, where
 * you read both off the grinder. Earlier versions folded the pair into a single
 * position and re-derived the dials from it, which made them behave as if
 * geared together: turn the ring far enough and the outer dial jumped. Each
 * control here writes only its own field.
 *
 * Read-only without `onChange` (a locked recipe, or Bruna's proposed next one);
 * interactive with it.
 */

const VIEW_W = 280;
const VIEW_H = 272;

/** Hit rows, in viewBox units — also drive the HTML overlays' placement. */
const COARSE_ROW = { y: 20, h: 58 };
const FINE_ROW = { y: 120, h: 50 };

const COARSE_STEP_PX = 20; // screen px of travel per outer click
const RING_SP = 38; // x spacing between ring stops (zero sits at the centre)
const RING_CY = 144;
const TAP_SLOP = 5; // px of travel below which a gesture counts as a tap

/**
 * Drag wiring for one row.
 *
 * The listeners go on an HTML overlay rather than on the SVG, and are attached
 * natively rather than through React, for two iOS Safari reasons: WebKit does
 * not honour `touch-action` on SVG content — so the browser claimed the
 * horizontal swipe as a scroll and cancelled the gesture — and pointer capture
 * on SVG nodes is unreliable there. A non-passive `touchmove` that calls
 * preventDefault keeps the page from stealing the drag even where
 * `touch-action` is ignored. Move/up live on the window so the gesture
 * survives the finger leaving the row.
 *
 * `onDrag` is held in a ref: a drag outlives the render that started it, and a
 * captured copy would go stale mid-gesture.
 */
type Phase = "start" | "move" | "end";

function useRowDrag(
  ref: React.RefObject<HTMLDivElement>,
  onDrag: React.MutableRefObject<(clientX: number, phase: Phase) => void>,
  enabled: boolean
) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    let dragging = false;

    const move = (e: PointerEvent) => {
      if (dragging) onDrag.current(e.clientX, "move");
    };
    const stop = () => {
      dragging = false;
      setActive(false);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
    const up = (e: PointerEvent) => {
      if (!dragging) return;
      stop();
      onDrag.current(e.clientX, "end");
    };
    // A cancel is the browser taking the gesture (a scroll it decided to own):
    // end the drag but don't treat it as a tap.
    const cancel = () => dragging && stop();
    const down = (e: PointerEvent) => {
      if (e.button > 0) return;
      dragging = true;
      setActive(true);
      onDrag.current(e.clientX, "start");
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", cancel);
    };
    const noScroll = (e: TouchEvent) => e.preventDefault();

    el.addEventListener("pointerdown", down);
    el.addEventListener("touchmove", noScroll, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("touchmove", noScroll);
      stop();
    };
  }, [ref, onDrag, enabled]);

  return active;
}

export function OpusDial({
  macro,
  micro,
  size = 300,
  onChange,
}: {
  /** Current outer-dial click (1–41). */
  macro?: number;
  /** Current inner-ring offset — ticks toward "−" (finer), −3…+3. */
  micro?: number;
  size?: number;
  /** Provide to make the dials draggable; omit for a read-only map. */
  onChange?: (next: { grinderMacro: number; grinderMicro: number }) => void;
}) {
  const uid = useId().replace(/:/g, "");
  const here = clampGrind({ grinderMacro: macro ?? 1, grinderMicro: micro ?? 0 });
  const click = here.grinderMacro;
  const ring = here.grinderMicro;
  const interactive = !!onChange;

  const coarseRef = useRef<HTMLDivElement>(null);
  const fineRef = useRef<HTMLDivElement>(null);

  // Each dial writes ONLY its own field. The outer dial does not move when you
  // turn the ring, and the ring does not move when you click the dial — same as
  // the grinder. Folding one onto the other is what made them feel geared
  // together, and it is never right: the barista reads both dials off the
  // machine, so a setting has to stay where they left it.
  const setClick = (n: number) => {
    const next = clampGrind({ grinderMacro: n, grinderMicro: ring });
    if (next.grinderMacro !== click) onChange?.(next);
  };
  const setRing = (n: number) => {
    const next = clampGrind({ grinderMacro: click, grinderMicro: n });
    if (next.grinderMicro !== ring) onChange?.(next);
  };

  // Each gesture is mapped from what was true when it began, not accumulated
  // per event, so the scale can't drift away from the finger.
  const origin = useRef({ x: 0, left: 0, scale: 1, click: 1, moved: 0 });

  /** Record where and when this gesture began. */
  const beginGesture = (clientX: number, ref: React.RefObject<HTMLDivElement>) => {
    const box = ref.current?.getBoundingClientRect();
    origin.current = {
      x: clientX,
      click,
      left: box?.left ?? 0,
      scale: box?.width ? box.width / VIEW_W : 0,
      moved: 0,
    };
  };
  /** Pointer x in viewBox units, or null if we never got a usable box. */
  const toViewX = (clientX: number) => {
    const o = origin.current;
    return o.scale ? (clientX - o.left) / o.scale : null;
  };

  const onCoarseDrag = useRef<(clientX: number, phase: Phase) => void>(() => {});
  onCoarseDrag.current = (clientX, phase) => {
    if (phase === "start") return beginGesture(clientX, coarseRef);
    const o = origin.current;
    o.moved = Math.max(o.moved, Math.abs(clientX - o.x));
    if (phase === "move") {
      // Drag right → the wheel slides right → finer clicks reach the caret.
      setClick(o.click - Math.round((clientX - o.x) / COARSE_STEP_PX));
      return;
    }
    // A tap that didn't travel: jump to the mark under the finger. This is the
    // way to move the outer dial if a device ever refuses to give us the drag.
    if (o.moved >= TAP_SLOP) return;
    const viewX = toViewX(clientX);
    if (viewX === null) return;
    setClick(o.click + Math.round((viewX - VIEW_W / 2) / COARSE_STEP_PX));
  };

  const onFineDrag = useRef<(clientX: number, phase: Phase) => void>(() => {});
  onFineDrag.current = (clientX, phase) => {
    if (phase === "start") beginGesture(clientX, fineRef);
    else if (phase === "end") return;
    // The ring is a track, not a wheel: the thumb goes where the finger is, so
    // a tap lands on a stop just as a drag does. Left of centre is toward "−".
    const viewX = toViewX(clientX);
    if (viewX === null) return;
    setRing(Math.round((VIEW_W / 2 - viewX) / RING_SP));
  };

  const coarseActive = useRowDrag(coarseRef, onCoarseDrag, interactive);
  const fineActive = useRowDrag(fineRef, onFineDrag, interactive);

  /** Arrow keys step the row they're focused on; right is always coarser. */
  const arrowKeys = (step: (coarser: number) => void) => (e: React.KeyboardEvent) => {
    const d = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
    if (!d) return;
    e.preventDefault();
    step(d);
  };

  // Ticks drawn either side of the caret — enough to run off both edges.
  const coarseFrom = Math.max(1, click - 8);
  const coarseTo = Math.min(OPUS.clicksTotal, click + 8);
  // Ring stop x: offset 0 at the centre, toward "−" (finer, positive) to the left.
  const ringX = (offset: number) => VIEW_W / 2 - offset * RING_SP;
  const thumbX = ringX(ring);
  const ringStops = Array.from(
    { length: OPUS.ringTravel * 2 + 1 },
    (_, i) => OPUS.ringTravel - i
  );

  const overlay = (
    row: { y: number; h: number },
    ref: React.RefObject<HTMLDivElement>,
    label: string,
    now: number,
    min: number,
    max: number,
    step: (coarser: number) => void
  ) => (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={now}
      aria-valuetext={`${unifiedLabel(here)}, ${dialLabel(here)}`}
      onKeyDown={arrowKeys(step)}
      style={{
        position: "absolute",
        left: 0,
        width: "100%",
        top: `${(row.y / VIEW_H) * 100}%`,
        height: `${(row.h / VIEW_H) * 100}%`,
        touchAction: "none",
        WebkitUserSelect: "none",
        userSelect: "none",
        WebkitTouchCallout: "none",
        cursor: "ew-resize",
        borderRadius: 10,
      }}
    />
  );

  return (
    <div
      style={{
        position: "relative",
        width: size,
        maxWidth: "100%",
        margin: "0 auto",
        // Stops iOS from bouncing the page when a drag starts on the dial.
        overscrollBehavior: "contain",
      }}
    >
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        width={VIEW_W}
        height={VIEW_H}
        role="img"
        aria-label="Fellow Opus grind setting"
        style={{ display: "block", width: "100%", height: "auto" }}
      >
        <defs>
          <clipPath id={`coarse-${uid}`}>
            <rect x="0" y={COARSE_ROW.y} width={VIEW_W} height={COARSE_ROW.h} />
          </clipPath>
          <linearGradient id={`fade-${uid}`} x1="0" x2="1">
            <stop offset="0" stopColor="var(--surface)" stopOpacity="1" />
            <stop offset="0.12" stopColor="var(--surface)" stopOpacity="0" />
            <stop offset="0.88" stopColor="var(--surface)" stopOpacity="0" />
            <stop offset="1" stopColor="var(--surface)" stopOpacity="1" />
          </linearGradient>
        </defs>

        {/* ---------- COARSE — outer dial, big steps ---------- */}
        <text x="8" y="12" fontSize="10" letterSpacing="0.12em" fontWeight="700" fill="var(--ink-soft)">
          COARSE · BIG STEPS
        </text>
        <text x={VIEW_W - 8} y="12" textAnchor="end" fontSize="9.5" fill="var(--ink-soft)" opacity="0.75">
          outer dial · ~50 µm a click
        </text>

        <g clipPath={`url(#coarse-${uid})`}>
          <line x1="0" y1="52" x2={VIEW_W} y2="52" stroke="var(--ink-soft)" strokeWidth="1.2" opacity="0.25" />
          {Array.from({ length: coarseTo - coarseFrom + 1 }, (_, i) => coarseFrom + i).map((c) => {
            const x = CX_OF(c, click);
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
          <rect x="0" y={COARSE_ROW.y} width={VIEW_W} height={COARSE_ROW.h} fill={`url(#fade-${uid})`} />
        </g>
        <path
          d={`M ${VIEW_W / 2} 68 l 5 7 l -10 0 Z`}
          fill={coarseActive ? "var(--clay)" : "var(--ink-soft)"}
          opacity={coarseActive ? 1 : 0.6}
        />

        <text x="8" y="90" fontSize="10" fill="var(--clay)" letterSpacing="0.08em" fontWeight="600">
          ← FINER
        </text>
        <text x={VIEW_W - 8} y="90" fontSize="10" fill="var(--ink-soft)" letterSpacing="0.08em" fontWeight="600" textAnchor="end">
          COARSER →
        </text>

        <line x1="8" y1="100" x2={VIEW_W - 8} y2="100" stroke="var(--line)" strokeWidth="1" />

        {/* ---------- FINE — inner ring, small steps ---------- */}
        <text x="8" y="114" fontSize="10" letterSpacing="0.12em" fontWeight="700" fill="var(--ink-soft)">
          FINE · SMALL STEPS
        </text>
        <text x={VIEW_W - 8} y="114" textAnchor="end" fontSize="9.5" fill="var(--ink-soft)" opacity="0.75">
          inner ring · ~17 µm a stop
        </text>

        <line
          x1={ringX(OPUS.ringTravel)}
          y1={RING_CY}
          x2={ringX(-OPUS.ringTravel)}
          y2={RING_CY}
          stroke="var(--ink-soft)"
          strokeWidth="1.2"
          opacity="0.3"
        />
        <text x="8" y={RING_CY + 6} fontFamily="var(--serif)" fontSize="16" fontWeight="700" fill="var(--clay)">
          −
        </text>
        <text x={VIEW_W - 8} y={RING_CY + 6} textAnchor="end" fontFamily="var(--serif)" fontSize="16" fontWeight="700" fill="var(--ink-soft)">
          +
        </text>

        {/* The ring's own three stops, plus the neighbouring clicks it rolls
            over into at either end. */}
        {ringStops.map((offset) => {
          if (offset === ring) return null; // the thumb is drawn here instead
          const zero = offset === 0;
          return (
            <circle
              key={offset}
              cx={ringX(offset)}
              cy={RING_CY}
              r={zero ? 4 : 3}
              fill="var(--surface)"
              stroke="var(--ink-soft)"
              strokeWidth={zero ? 1.6 : 1.2}
              opacity={zero ? 0.9 : 0.6}
            />
          );
        })}
        <rect
          x={thumbX - 2.5}
          y={RING_CY - 15}
          width="5"
          height="30"
          rx="2.5"
          fill="var(--clay)"
        />
        <path
          d={`M ${thumbX} ${RING_CY + 20} l 5 7 l -10 0 Z`}
          fill={fineActive ? "var(--clay)" : "var(--ink-soft)"}
          opacity={fineActive ? 1 : 0.6}
        />

        <text x="8" y="184" fontSize="10" fill="var(--clay)" letterSpacing="0.08em" fontWeight="600">
          ← toward −
        </text>
        <text x={VIEW_W / 2} y="184" textAnchor="middle" fontSize="10" fill="var(--clay)" fontWeight="600">
          {ringLabel(ring)}
        </text>
        <text x={VIEW_W - 8} y="184" fontSize="10" fill="var(--ink-soft)" letterSpacing="0.08em" fontWeight="600" textAnchor="end">
          toward + →
        </text>

        <line x1="8" y1="194" x2={VIEW_W - 8} y2="194" stroke="var(--line)" strokeWidth="1" />

        {/* ---------- UNIFIED GRIND SIZE ---------- */}
        <text x={VIEW_W / 2} y="208" textAnchor="middle" fontSize="10" letterSpacing="0.12em" fontWeight="700" fill="var(--ink-soft)">
          UNIFIED GRIND SIZE
        </text>
        <rect x={VIEW_W / 2 - 46} y="216" width="92" height="34" rx="10" fill="var(--clay-tint)" />
        <text
          x={VIEW_W / 2}
          y="241"
          textAnchor="middle"
          fontFamily="var(--serif)"
          fontSize="24"
          fontWeight="700"
          fill="var(--clay-deep)"
        >
          {unifiedLabel(here)}
        </text>
        <text x={VIEW_W / 2} y="264" textAnchor="middle" fontSize="10.5" fill="var(--ink-soft)">
          ~{grindMicrons(here)} µm · {dialLabel(here)}
        </text>
      </svg>

      {interactive && (
        <>
          {overlay(COARSE_ROW, coarseRef, "Outer dial click", click, 1, OPUS.clicksTotal, (d) =>
            setClick(click + d)
          )}
          {/* Reported rightwards-positive so the value tracks the thumb, while
              `ring` itself stays positive-toward-−. */}
          {overlay(FINE_ROW, fineRef, "Inner ring offset", -ring, -OPUS.ringTravel, OPUS.ringTravel, (d) =>
            setRing(ring - d)
          )}
        </>
      )}
    </div>
  );
}

/** x of outer-dial click `c` on the wheel, given `current` sits at the caret. */
function CX_OF(c: number, current: number): number {
  return VIEW_W / 2 + (c - current) * COARSE_STEP_PX;
}
