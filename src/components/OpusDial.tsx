import { OPUS, dialNumber, grindMicrons, unifiedLabel } from "../lib/gear";

/**
 * Fellow Opus grind infographic, laid out the way the Beanie app reads:
 *
 *   COARSE   1 · · · 2 · · · 3 · · · 4     (41 clicks span the printed 1–11;
 *            ← finer        coarser →       3 unnumbered sub-clicks per number)
 *
 *   FINE     −  •  •  • | •  •  •  +       (3 ticks per click, ~17 µm each)
 *
 *   UNIFIED  1.25 ~ 250 µm                 (one number covering both dials)
 *
 * Only the espresso end of the outer dial is drawn — printed 1 to 4 — because
 * that's the whole usable window on this machine and stretching it to 11 would
 * squash the sub-clicks into noise. Line scales beat a circular rendering on a
 * phone: step count and direction of travel read instantly. Direction labels
 * live on their own row so they never crash into the scale's marks.
 */
export function OpusDial({
  macro,
  micro,
  size = 300,
}: {
  /** Current outer-dial click (1–41). Only the espresso end (1–13) is drawn. */
  macro?: number;
  /** Current inner-ring position — ticks toward "−" (0–2). */
  micro?: number;
  size?: number;
}) {
  const clicksShown = 13; // clicks 1–13 = printed numbers 1 through 4
  const x0 = 30;
  const x1 = 258;
  const step = (x1 - x0) / (clicksShown - 1);
  const clickX = (click: number) => x0 + (click - 1) * step;

  const click = macro && macro >= 1 ? Math.min(macro, clicksShown) : 0;
  const ticks = Math.min(2, Math.max(0, micro ?? 0));
  const offScale = !!macro && macro > clicksShown;
  const here = click ? { grinderMacro: macro!, grinderMicro: ticks } : null;

  // Inner ring: 7 positions, "−" (finer) on the left. We only ever land on the
  // centre or the − side — a + offset is the same cut as the next click down.
  const microX = [40, 72, 104, 140, 176, 208, 240];
  const microIdx = 3 - ticks;

  return (
    <svg
      viewBox="0 0 280 256"
      width={size}
      height={size * (256 / 280)}
      role="img"
      aria-label="Fellow Opus grind infographic"
      style={{ display: "block", margin: "0 auto", maxWidth: "100%" }}
    >
      {/* ---------- COARSE — outer dial ---------- */}
      <text x="140" y="16" textAnchor="middle" fontSize="10" letterSpacing="0.12em" fontWeight="700" fill="var(--ink-soft)">
        COARSE · OUTER DIAL
      </text>
      <text x="140" y="30" textAnchor="middle" fontSize="9.5" fill="var(--ink-soft)" opacity="0.75">
        41 clicks over the printed 1–11 · ~50 µm each · espresso end shown
      </text>

      <line x1={x0} y1="58" x2={x1} y2="58" stroke="var(--ink-soft)" strokeWidth="1.2" opacity="0.35" />

      {Array.from({ length: clicksShown }, (_, i) => i + 1).map((c) => {
        const numbered = (c - 1) % OPUS.clicksPerNumber === 0;
        const active = c === click;
        return (
          <g key={c}>
            <line
              x1={clickX(c)}
              y1={numbered ? 48 : 53}
              x2={clickX(c)}
              y2={numbered ? 68 : 63}
              stroke={active ? "var(--clay)" : "var(--ink-soft)"}
              strokeWidth={active ? 3 : numbered ? 1.8 : 1}
              strokeLinecap="round"
              opacity={active ? 1 : numbered ? 0.85 : 0.45}
            />
            {numbered && (
              <text
                x={clickX(c)}
                y="41"
                textAnchor="middle"
                fontFamily="var(--serif)"
                fontSize={active ? 14 : 12}
                fontWeight={active ? 700 : 500}
                fill={active ? "var(--clay)" : "var(--ink)"}
              >
                {dialNumber(c)}
              </text>
            )}
          </g>
        );
      })}
      {click > 0 && (
        <text x={clickX(click)} y="80" textAnchor="middle" fontSize="9.5" fill="var(--clay)" fontWeight="600">
          you're here
        </text>
      )}
      {offScale && (
        <text x="140" y="80" textAnchor="middle" fontSize="9.5" fill="var(--ink-soft)" fontWeight="600">
          click {macro} — coarser than this view
        </text>
      )}

      <text x="20" y="97" fontSize="10" fill="var(--clay)" letterSpacing="0.08em" fontWeight="600">
        ← FINER
      </text>
      <text x="260" y="97" fontSize="10" fill="var(--ink-soft)" letterSpacing="0.08em" fontWeight="600" textAnchor="end">
        COARSER →
      </text>

      <line x1="20" y1="114" x2="260" y2="114" stroke="var(--line)" strokeWidth="1" />

      {/* ---------- FINE — inner ring ---------- */}
      <text x="140" y="130" textAnchor="middle" fontSize="10" letterSpacing="0.12em" fontWeight="700" fill="var(--ink-soft)">
        FINE · INNER RING
      </text>
      <text x="140" y="144" textAnchor="middle" fontSize="9.5" fill="var(--ink-soft)" opacity="0.75">
        3 ticks per click · ~17 µm each
      </text>

      <line x1={microX[0] + 10} y1="170" x2={microX[6] - 10} y2="170" stroke="var(--ink-soft)" strokeWidth="1.2" opacity="0.35" />

      <text x={microX[0] - 14} y="176" textAnchor="middle" fontFamily="var(--serif)" fontSize="20" fontWeight="700" fill="var(--clay)">
        −
      </text>

      {[0, 1, 2, 4, 5, 6].map((i) => {
        const active = microIdx === i;
        return (
          <circle
            key={i}
            cx={microX[i]}
            cy="170"
            r={active ? 5.5 : 3.2}
            fill={active ? "var(--clay)" : "var(--surface)"}
            stroke={active ? "var(--clay)" : "var(--ink-soft)"}
            strokeWidth="1.2"
            opacity={active || i < 3 ? 1 : 0.7}
          />
        );
      })}

      {/* centre reference — the click's own position, ring at zero */}
      <line
        x1={microX[3]}
        y1="161"
        x2={microX[3]}
        y2="179"
        stroke={microIdx === 3 ? "var(--clay)" : "var(--ink-soft)"}
        strokeWidth={microIdx === 3 ? 3 : 1.6}
        strokeLinecap="round"
      />

      <text x={microX[6] + 14} y="176" textAnchor="middle" fontFamily="var(--serif)" fontSize="20" fontWeight="700" fill="var(--ink-soft)">
        +
      </text>

      <text x={microX[microIdx]} y="190" textAnchor="middle" fontSize="9.5" fill="var(--clay)" fontWeight="600">
        {ticks === 0 ? "at 0 ticks" : `${ticks} tick${ticks > 1 ? "s" : ""} toward −`}
      </text>

      <text x="20" y="206" fontSize="10" fill="var(--clay)" letterSpacing="0.08em" fontWeight="600">
        ← FINER
      </text>
      <text x="260" y="206" fontSize="10" fill="var(--ink-soft)" letterSpacing="0.08em" fontWeight="600" textAnchor="end">
        COARSER →
      </text>

      {/* ---------- UNIFIED GRIND SIZE ---------- */}
      {here && (
        <>
          <line x1="20" y1="220" x2="260" y2="220" stroke="var(--line)" strokeWidth="1" />
          <text x="140" y="236" textAnchor="middle" fontSize="10" letterSpacing="0.12em" fontWeight="700" fill="var(--ink-soft)">
            UNIFIED GRIND SIZE
          </text>
          <text x="140" y="248" textAnchor="middle" fontSize="11" fill="var(--clay)" fontWeight="700">
            {unifiedLabel(here)}
            <tspan fill="var(--ink-soft)" fontWeight="500">{`  ~${grindMicrons(here)} µm`}</tspan>
          </text>
        </>
      )}
    </svg>
  );
}
