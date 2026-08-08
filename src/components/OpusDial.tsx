import { useEffect, useId, useRef, useState } from "react";
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
 * The Fellow Opus grind control, shaped like the grinder itself: two dials,
 * big steps on top and fine steps below.
 *
 *   COARSE   · · 1 · · · 2 · · ·      the outer dial — 41 clicks, ~50 µm each.
 *                                     A wheel: it scrolls under a fixed caret,
 *                                     because 41 positions don't fit a track.
 *
 *   FINE     − ·  ·  ▮  ·  · +        the inner ring — 3 stops per click,
 *                                     ~17 µm each. A fixed track with a thumb
 *                                     that moves, because the ring's travel is
 *                                     exactly one click wide and you want to
 *                                     see where in that travel you are.
 *
 *   UNIFIED  1.25   ~250 µm           Beanie's single number for both dials.
 *
 * The ring's 3 stops tile the space between clicks exactly — 41 × 3 = 123
 * distinct settings, which is where the "~120 adjustment points" figure comes
 * from — so dragging the ring past either end of its travel carries into the
 * neighbouring click and the thumb wraps to the far side, exactly as a full
 * rotation of the real ring does. The faint stops beyond each end of the track
 * are those neighbours; tapping one carries there directly.
 *
 * Both rows drive the same underlying value, the absolute position in
 * micro-ticks (1…123): the outer dial steps it by 3, the ring by 1.
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
const RING_X0 = 90; // x of the ring's finest stop (ring −2)
const RING_SP = 50; // x spacing between ring stops
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
  /** Current inner-ring position — stops toward "−" (0–2). */
  micro?: number;
  size?: number;
  /** Provide to make the dials draggable; omit for a read-only map. */
  onChange?: (next: { grinderMacro: number; grinderMicro: number }) => void;
}) {
  const uid = useId().replace(/:/g, "");
  const click = Math.min(OPUS.clicksTotal, Math.max(1, Math.round(macro ?? 1)));
  const ring = Math.min(OPUS.microPerClick - 1, Math.max(0, Math.round(micro ?? 0)));
  const here = { grinderMacro: click, grinderMicro: ring };
  const ticks = ticksTotal(here);
  const interactive = !!onChange;

  const coarseRef = useRef<HTMLDivElement>(null);
  const fineRef = useRef<HTMLDivElement>(null);

  const setTicks = (t: number) => {
    if (!onChange) return;
    const next = fromTicks(t);
    if (next.grinderMacro !== click || next.grinderMicro !== ring) onChange(next);
  };

  // Each gesture is mapped from what was true when it began, not accumulated
  // per event, so the scale can't drift away from the finger.
  const origin = useRef({ x: 0, ticks: 1, left: 0, scale: 1, click: 1, moved: 0 });

  /** Record where and when this gesture began. */
  const beginGesture = (clientX: number, ref: React.RefObject<HTMLDivElement>) => {
    const box = ref.current?.getBoundingClientRect();
    origin.current = {
      x: clientX,
      ticks,
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
      // Drag right → the wheel slides right → finer values reach the caret.
      const notches = Math.round((clientX - o.x) / COARSE_STEP_PX);
      setTicks(o.ticks - notches * OPUS.microPerClick);
      return;
    }
    // A tap that didn't travel: jump to the mark under the finger. This is the
    // way to move the outer dial if a device ever refuses to give us the drag.
    if (o.moved >= TAP_SLOP) return;
    const viewX = toViewX(clientX);
    if (viewX === null) return;
    const delta = Math.round((viewX - VIEW_W / 2) / COARSE_STEP_PX);
    if (delta) setTicks(o.ticks + delta * OPUS.microPerClick);
  };

  const onFineDrag = useRef<(clientX: number, phase: Phase) => void>(() => {});
  onFineDrag.current = (clientX, phase) => {
    if (phase === "start") beginGesture(clientX, fineRef);
    else if (phase === "end") return;
    // The ring is a track, not a wheel: the thumb goes where the finger is, so
    // a tap lands on a stop just as a drag does. Stop i counts up from the
    // finest, so i = 0…2 is this click's travel and i outside that carries.
    const viewX = toViewX(clientX);
    if (viewX === null) return;
    const i = Math.round((viewX - RING_X0) / RING_SP);
    setTicks(origin.current.click * OPUS.microPerClick - (OPUS.microPerClick - 1) + i);
  };

  const coarseActive = useRowDrag(coarseRef, onCoarseDrag, interactive);
  const fineActive = useRowDrag(fineRef, onFineDrag, interactive);

  const arrowKeys = (unit: number) => (e: React.KeyboardEvent) => {
    const d = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
    if (!d) return;
    e.preventDefault();
    setTicks(ticks + d * unit);
  };

  // Ticks drawn either side of the caret — enough to run off both edges.
  const coarseFrom = Math.max(1, click - 8);
  const coarseTo = Math.min(OPUS.clicksTotal, click + 8);
  const ringX = (i: number) => RING_X0 + i * RING_SP;
  const thumbX = ringX(OPUS.microPerClick - 1 - ring);

  const overlay = (
    row: { y: number; h: number },
    ref: React.RefObject<HTMLDivElement>,
    label: string,
    now: number,
    max: number,
    unit: number
  ) => (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={1}
      aria-valuemax={max}
      aria-valuenow={now}
      aria-valuetext={`${unifiedLabel(here)}, ${dialLabel(here)}`}
      onKeyDown={arrowKeys(unit)}
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

        <line x1={ringX(0)} y1={RING_CY} x2={ringX(2)} y2={RING_CY} stroke="var(--ink-soft)" strokeWidth="1.2" opacity="0.3" />
        <text x="8" y={RING_CY + 6} fontFamily="var(--serif)" fontSize="16" fontWeight="700" fill="var(--clay)">
          −
        </text>
        <text x={VIEW_W - 8} y={RING_CY + 6} textAnchor="end" fontFamily="var(--serif)" fontSize="16" fontWeight="700" fill="var(--ink-soft)">
          +
        </text>

        {/* The ring's own three stops, plus the neighbouring clicks it rolls
            over into at either end. */}
        {[-1, 0, 1, 2, 3].map((i) => {
          const carry = i < 0 || i > OPUS.microPerClick - 1;
          if (i === OPUS.microPerClick - 1 - ring) return null; // the thumb sits here
          return (
            <circle
              key={i}
              cx={ringX(i)}
              cy={RING_CY}
              r={carry ? 2.4 : 3.4}
              fill="var(--surface)"
              stroke="var(--ink-soft)"
              strokeWidth="1.2"
              opacity={carry ? 0.35 : 0.7}
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
          ring {ring ? `−${ring}` : "0"}
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
          {overlay(COARSE_ROW, coarseRef, "Outer dial click", click, OPUS.clicksTotal, OPUS.microPerClick)}
          {overlay(FINE_ROW, fineRef, "Inner ring stop", ticks, OPUS_TICKS_MAX, 1)}
        </>
      )}
    </div>
  );
}

/** x of outer-dial click `c` on the wheel, given `current` sits at the caret. */
function CX_OF(c: number, current: number): number {
  return VIEW_W / 2 + (c - current) * COARSE_STEP_PX;
}
