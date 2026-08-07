/**
 * Fellow Opus grind infographic — two horizontal scales that read at a glance:
 *
 *   OUTER DIAL — macro click        1  2  3  4        (current highlighted)
 *                              ← finer      coarser →
 *
 *   INNER RING — 3 ticks/click   −  •  •  • | •  •  •  +
 *                              ← finer      coarser →
 *
 * A line scale beats a circular rendering on a phone: step count and direction
 * of travel — the two things you actually need — read instantly. Direction
 * labels live on their own row below each scale, so they never crash into the
 * scale's own marks.
 */
export function OpusDial({
  macro,
  micro,
  size = 300,
}: {
  /** Current outer-dial position (1–41). Only 1–4 are highlighted (espresso). */
  macro?: number;
  /** Current inner-ring position — ticks toward "−" (0–2). */
  micro?: number;
  size?: number;
}) {
  // viewBox 280 wide. Scale rows sit on the full width; direction labels sit
  // on their own row so they never collide with the scale marks.

  // Outer scale (macro) — 4 evenly-spaced dots for the espresso range.
  const macroX = [55, 125, 195, 265];
  const macroLabels = [1, 2, 3, 4];
  const macroIdx = macro && macro >= 1 && macro <= 4 ? macro - 1 : -1;

  // Inner scale (micro) — 9 positions: −, 3 finer ticks, centre reference,
  // 3 coarser ticks, +. `micro` counts ticks toward −.
  const microX = [30, 55, 80, 105, 140, 175, 200, 225, 250];
  const microIdx = 4 - Math.min(2, Math.max(0, micro ?? 0));

  return (
    <svg
      viewBox="0 0 280 210"
      width={size}
      height={size * (210 / 280)}
      role="img"
      aria-label="Fellow Opus grind infographic"
      style={{ display: "block", margin: "0 auto", maxWidth: "100%" }}
    >
      {/* ---------- OUTER DIAL (macro) ---------- */}
      <text x="140" y="16" textAnchor="middle" fontSize="10" letterSpacing="0.12em" fontWeight="700" fill="var(--ink-soft)">
        OUTER DIAL · NUMBERED POSITIONS
      </text>
      <text x="140" y="30" textAnchor="middle" fontSize="9.5" fill="var(--ink-soft)" opacity="0.75">
        3 small sub-clicks between each number · espresso zone shown
      </text>

      {/* connecting line under the dots */}
      <line x1={macroX[0]} y1="58" x2={macroX[3]} y2="58" stroke="var(--ink-soft)" strokeWidth="1.2" opacity="0.35" />

      {/* Sub-clicks (unnumbered detents) between each pair of numbered positions
          — 3 short tick marks per gap, matching the physical Opus dial. */}
      {[0, 1, 2].map((i) => {
        const a = macroX[i];
        const b = macroX[i + 1];
        const gap = (b - a) / 4;
        return [1, 2, 3].map((k) => (
          <line
            key={`sub-${i}-${k}`}
            x1={a + gap * k}
            y1="54"
            x2={a + gap * k}
            y2="62"
            stroke="var(--ink-soft)"
            strokeWidth="1"
            opacity="0.45"
          />
        ));
      })}

      {macroLabels.map((n, i) => {
        const active = i === macroIdx;
        return (
          <g key={n}>
            <circle
              cx={macroX[i]}
              cy="58"
              r={active ? 7 : 4.5}
              fill={active ? "var(--clay)" : "var(--surface)"}
              stroke={active ? "var(--clay)" : "var(--ink-soft)"}
              strokeWidth="1.6"
            />
            <text
              x={macroX[i]}
              y="46"
              textAnchor="middle"
              fontFamily="var(--serif)"
              fontSize={active ? 14 : 12}
              fontWeight={active ? 700 : 500}
              fill={active ? "var(--clay)" : "var(--ink)"}
            >
              {n}
            </text>
          </g>
        );
      })}
      {macroIdx >= 0 && (
        <text x={macroX[macroIdx]} y="76" textAnchor="middle" fontSize="9.5" fill="var(--clay)" fontWeight="600">
          you're here
        </text>
      )}

      {/* Direction labels on their own row */}
      <text x="20" y="93" fontSize="10" fill="var(--clay)" letterSpacing="0.08em" fontWeight="600">
        ← FINER
      </text>
      <text x="260" y="93" fontSize="10" fill="var(--ink-soft)" letterSpacing="0.08em" fontWeight="600" textAnchor="end">
        COARSER →
      </text>

      {/* divider */}
      <line x1="20" y1="112" x2="260" y2="112" stroke="var(--line)" strokeWidth="1" />

      {/* ---------- INNER RING (micro) ---------- */}
      <text x="140" y="128" textAnchor="middle" fontSize="10" letterSpacing="0.12em" fontWeight="700" fill="var(--ink-soft)">
        INNER RING · MICRO TICKS
      </text>
      <text x="140" y="142" textAnchor="middle" fontSize="9.5" fill="var(--ink-soft)" opacity="0.75">
        3 ticks per macro click · ~17 µm each
      </text>

      {/* connecting line under the ticks */}
      <line x1={microX[0] + 6} y1="170" x2={microX[8] - 6} y2="170" stroke="var(--ink-soft)" strokeWidth="1.2" opacity="0.35" />

      {/* − mark */}
      <text
        x={microX[0]}
        y="175"
        textAnchor="middle"
        fontFamily="var(--serif)"
        fontSize="20"
        fontWeight="700"
        fill="var(--clay)"
      >
        −
      </text>

      {/* 3 finer ticks */}
      {[1, 2, 3].map((i) => {
        const active = microIdx === i;
        return (
          <circle
            key={`f${i}`}
            cx={microX[i]}
            cy="170"
            r={active ? 5.5 : 3.2}
            fill={active ? "var(--clay)" : "var(--surface)"}
            stroke={active ? "var(--clay)" : "var(--ink-soft)"}
            strokeWidth="1.2"
          />
        );
      })}

      {/* centre reference */}
      <line
        x1={microX[4]}
        y1="162"
        x2={microX[4]}
        y2="178"
        stroke={microIdx === 4 ? "var(--clay)" : "var(--ink-soft)"}
        strokeWidth={microIdx === 4 ? 3 : 1.6}
        strokeLinecap="round"
      />

      {/* 3 coarser ticks */}
      {[5, 6, 7].map((i) => (
        <circle
          key={`c${i}`}
          cx={microX[i]}
          cy="170"
          r="3.2"
          fill="var(--surface)"
          stroke="var(--ink-soft)"
          strokeWidth="1.2"
          opacity="0.7"
        />
      ))}

      {/* + mark */}
      <text
        x={microX[8]}
        y="175"
        textAnchor="middle"
        fontFamily="var(--serif)"
        fontSize="20"
        fontWeight="700"
        fill="var(--ink-soft)"
      >
        +
      </text>

      {/* micro caption */}
      {microIdx >= 0 && (
        <text x={microX[microIdx]} y="189" textAnchor="middle" fontSize="9.5" fill="var(--clay)" fontWeight="600">
          {microIdx === 4
            ? "at 0 ticks"
            : `${4 - microIdx} tick${4 - microIdx > 1 ? "s" : ""} toward −`}
        </text>
      )}

      {/* Direction labels on their own row */}
      <text x="20" y="205" fontSize="10" fill="var(--clay)" letterSpacing="0.08em" fontWeight="600">
        ← FINER
      </text>
      <text x="260" y="205" fontSize="10" fill="var(--ink-soft)" letterSpacing="0.08em" fontWeight="600" textAnchor="end">
        COARSER →
      </text>
    </svg>
  );
}
