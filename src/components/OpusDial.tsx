/**
 * Small infographic of the Fellow Opus's two dials, with clear arrows for
 * which direction on the physical grinder means finer / coarser. Optionally
 * highlights the current position so the recipe screen shows the user exactly
 * where to land the outer dial and the inner micro-ring.
 */
export function OpusDial({
  macro,
  micro,
  size = 220,
}: {
  /** Current outer-dial position (1–41). */
  macro?: number;
  /** Current inner-ring position — ticks toward "−" (0–2). */
  micro?: number;
  size?: number;
}) {
  const cx = 100;
  const cy = 100;
  const rOuter = 80;
  const rInner = 40;

  // Outer dial: mark just the espresso range 1..4 clearly, others as ticks.
  const outerNumbers = [1, 2, 3, 4];
  const outerTotal = 11; // Opus labels its outer dial 1..11
  const angleForNum = (n: number) => -Math.PI / 2 + ((n - 1) / outerTotal) * Math.PI * 2;

  // Inner ring: − and + on opposite sides; 3 ticks around each half-turn.
  // The current micro position is 0..2 ticks toward the − mark, so the pointer
  // sits between the macro reference (top) and the − mark (left).
  const microAngle = -Math.PI / 2 - (micro ?? 0) * (Math.PI / 6);

  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      role="img"
      aria-label="Fellow Opus grind dial"
      style={{ display: "block", margin: "0 auto" }}
    >
      {/* Outer dial ring */}
      <circle cx={cx} cy={cy} r={rOuter} fill="var(--surface)" stroke="var(--ink-soft)" strokeWidth="1.6" />

      {/* Outer ticks */}
      {[...Array(outerTotal)].map((_, i) => {
        const a = angleForNum(i + 1);
        const x1 = cx + Math.cos(a) * (rOuter - 6);
        const y1 = cy + Math.sin(a) * (rOuter - 6);
        const x2 = cx + Math.cos(a) * (rOuter - 2);
        const y2 = cy + Math.sin(a) * (rOuter - 2);
        return (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--ink-soft)" strokeWidth="1.4" opacity="0.55" />
        );
      })}

      {/* Outer numbers (espresso range) */}
      {outerNumbers.map((n) => {
        const a = angleForNum(n);
        const x = cx + Math.cos(a) * (rOuter - 15);
        const y = cy + Math.sin(a) * (rOuter - 15) + 4;
        const active = macro === n;
        return (
          <text
            key={n}
            x={x}
            y={y}
            textAnchor="middle"
            fontFamily="var(--serif)"
            fontSize={active ? 15 : 12}
            fontWeight={active ? 700 : 500}
            fill={active ? "var(--clay)" : "var(--ink-soft)"}
          >
            {n}
          </text>
        );
      })}

      {/* Outer arrow legend — clockwise = coarser */}
      <text x={cx + rOuter + 6} y={cy - 60} fontSize="10" fill="var(--ink-soft)" letterSpacing="0.5">
        ↻ coarser
      </text>
      <text x={cx - rOuter - 46} y={cy - 60} fontSize="10" fill="var(--ink-soft)" letterSpacing="0.5">
        finer ↺
      </text>

      {/* Inner micro ring */}
      <circle cx={cx} cy={cy} r={rInner} fill="var(--clay-tint)" stroke="var(--clay)" strokeWidth="1.4" />

      {/* Inner marks: − on the left, + on the right */}
      <text
        x={cx - rInner + 4}
        y={cy + 5}
        textAnchor="start"
        fontSize="18"
        fontWeight="700"
        fill="var(--clay)"
        fontFamily="var(--serif)"
      >
        −
      </text>
      <text
        x={cx + rInner - 4}
        y={cy + 5}
        textAnchor="end"
        fontSize="18"
        fontWeight="700"
        fill="var(--ink-soft)"
      >
        +
      </text>

      {/* Direction arrows on the inner ring */}
      <path
        d={`M ${cx - rInner - 6} ${cy - 12} Q ${cx - rInner - 22} ${cy} ${cx - rInner - 6} ${cy + 12}`}
        fill="none"
        stroke="var(--clay)"
        strokeWidth="1.4"
        markerEnd="url(#arrow-clay)"
      />
      <path
        d={`M ${cx + rInner + 6} ${cy - 12} Q ${cx + rInner + 22} ${cy} ${cx + rInner + 6} ${cy + 12}`}
        fill="none"
        stroke="var(--ink-soft)"
        strokeWidth="1.2"
        markerEnd="url(#arrow-soft)"
        opacity="0.7"
      />

      {/* Current position pointer */}
      {micro !== undefined && (
        <g transform={`rotate(${(microAngle + Math.PI / 2) * (180 / Math.PI)} ${cx} ${cy})`}>
          <line x1={cx} y1={cy} x2={cx} y2={cy - rInner + 4} stroke="var(--clay)" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx={cx} cy={cy - rInner + 4} r="3" fill="var(--clay)" />
        </g>
      )}

      {/* Centre bolt */}
      <circle cx={cx} cy={cy} r="4" fill="var(--ink)" opacity="0.7" />

      {/* Labels */}
      <text x={cx} y={cy + rInner + 20} textAnchor="middle" fontSize="10.5" fill="var(--clay)" fontWeight="700" letterSpacing="0.6">
        FINER  ←  −
      </text>
      <text x={cx} y={cy + rInner + 34} textAnchor="middle" fontSize="10.5" fill="var(--ink-soft)" letterSpacing="0.6">
        +  →  COARSER
      </text>

      <defs>
        <marker id="arrow-clay" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--clay)" />
        </marker>
        <marker id="arrow-soft" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--ink-soft)" />
        </marker>
      </defs>
    </svg>
  );
}
