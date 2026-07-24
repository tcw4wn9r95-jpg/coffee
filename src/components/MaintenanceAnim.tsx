/**
 * Coffee-themed maintenance animations, matched to each task. Same visual
 * language as BrewingLoader: pure SVG + CSS keyframes (see `.maint-*` in
 * global.css), theme-aware, and quiet under prefers-reduced-motion.
 */

interface P {
  size?: number;
}

/** Brush strokes sweeping across a burr disc — for chaff + deep-clean. */
export function BrushAnim({ size = 130 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="maint">
      {/* burr disc */}
      <circle cx="50" cy="55" r="30" fill="var(--clay-tint)" stroke="var(--ink-soft)" strokeWidth="1.5" />
      <circle cx="50" cy="55" r="18" fill="var(--surface)" stroke="var(--ink-soft)" strokeWidth="1.2" />
      {/* burr teeth (subtle radial lines) */}
      <g stroke="var(--ink-soft)" strokeWidth="0.8" opacity="0.5">
        {[...Array(12)].map((_, i) => {
          const a = (i * Math.PI) / 6;
          const x1 = 50 + Math.cos(a) * 20;
          const y1 = 55 + Math.sin(a) * 20;
          const x2 = 50 + Math.cos(a) * 29;
          const y2 = 55 + Math.sin(a) * 29;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
        })}
      </g>
      {/* brush */}
      <g className="maint-brush">
        <rect x="44" y="8" width="12" height="18" rx="2" fill="var(--clay)" />
        <g stroke="var(--ink-soft)" strokeWidth="1.2" strokeLinecap="round">
          {[...Array(8)].map((_, i) => (
            <line key={i} x1={45.5 + i * 1.3} y1="26" x2={45.5 + i * 1.3} y2="34" />
          ))}
        </g>
      </g>
      {/* falling chaff */}
      <g fill="var(--ink-soft)" opacity="0.55">
        <circle className="maint-chaff maint-chaff-1" cx="35" cy="45" r="1.2" />
        <circle className="maint-chaff maint-chaff-2" cx="62" cy="48" r="1.4" />
        <circle className="maint-chaff maint-chaff-3" cx="50" cy="42" r="1.2" />
      </g>
    </svg>
  );
}

/** Water spraying up through a portafilter — for water backflush. */
export function BackflushAnim({ size = 130 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="maint">
      {/* group head */}
      <rect x="34" y="12" width="32" height="14" rx="2" fill="var(--ink-soft)" opacity="0.85" />
      <rect x="38" y="24" width="24" height="6" rx="1.5" fill="var(--clay)" />
      {/* portafilter body */}
      <path d="M32 30h36l-4 20a3 3 0 0 1-3 2.5H39a3 3 0 0 1-3-2.5L32 30Z" fill="var(--surface)" stroke="var(--ink-soft)" strokeWidth="1.6" />
      <line x1="68" y1="34" x2="86" y2="40" stroke="var(--ink-soft)" strokeWidth="2" strokeLinecap="round" />
      {/* drip tray */}
      <rect x="24" y="76" width="52" height="8" rx="2" fill="var(--ink-soft)" opacity="0.25" />
      {/* water drops rising then falling */}
      <g fill="var(--clay)">
        <ellipse className="maint-jet maint-jet-1" cx="45" cy="50" rx="1.4" ry="3" />
        <ellipse className="maint-jet maint-jet-2" cx="50" cy="50" rx="1.4" ry="3" />
        <ellipse className="maint-jet maint-jet-3" cx="55" cy="50" rx="1.4" ry="3" />
      </g>
    </svg>
  );
}

/** Bubbles rising from a blind basket — for detergent backflush. */
export function DetergentAnim({ size = 130 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="maint">
      {/* group head */}
      <rect x="34" y="10" width="32" height="14" rx="2" fill="var(--ink-soft)" opacity="0.85" />
      {/* portafilter with detergent */}
      <path d="M32 28h36l-4 22a3 3 0 0 1-3 2.5H39a3 3 0 0 1-3-2.5L32 28Z" fill="var(--clay-tint)" stroke="var(--ink-soft)" strokeWidth="1.6" />
      <line x1="68" y1="32" x2="86" y2="40" stroke="var(--ink-soft)" strokeWidth="2" strokeLinecap="round" />
      {/* rising bubbles */}
      <g fill="none" stroke="var(--clay)" strokeWidth="1.4">
        <circle className="maint-bubble maint-b1" cx="42" cy="46" r="2.4" />
        <circle className="maint-bubble maint-b2" cx="50" cy="46" r="3.2" />
        <circle className="maint-bubble maint-b3" cx="58" cy="46" r="2.6" />
        <circle className="maint-bubble maint-b4" cx="46" cy="46" r="2" />
        <circle className="maint-bubble maint-b5" cx="54" cy="46" r="2.2" />
      </g>
    </svg>
  );
}

/** Shower screen unscrewing — for shower screen / gasket clean. */
export function ScreenAnim({ size = 130 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="maint">
      {/* group head backdrop */}
      <rect x="18" y="14" width="64" height="20" rx="3" fill="var(--ink-soft)" opacity="0.2" />
      {/* rotating screen disc */}
      <g className="maint-screen">
        <circle cx="50" cy="52" r="24" fill="var(--clay-tint)" stroke="var(--ink-soft)" strokeWidth="1.5" />
        {/* screen holes */}
        <g fill="var(--ink-soft)" opacity="0.55">
          {[...Array(37)].map((_, i) => {
            const ring = i === 0 ? 0 : i < 7 ? 8 : i < 19 ? 14 : 20;
            const idxInRing = i === 0 ? 0 : i < 7 ? i - 1 : i < 19 ? i - 7 : i - 19;
            const count = i === 0 ? 1 : i < 7 ? 6 : i < 19 ? 12 : 18;
            const a = (idxInRing / count) * Math.PI * 2;
            const cx = 50 + Math.cos(a) * ring;
            const cy = 52 + Math.sin(a) * ring;
            return <circle key={i} cx={cx} cy={cy} r="1.3" />;
          })}
        </g>
        {/* central bolt */}
        <circle cx="50" cy="52" r="3.4" fill="var(--clay)" />
        <line x1="47" y1="52" x2="53" y2="52" stroke="var(--surface)" strokeWidth="1.4" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/** Liquid level rising & draining in a boiler outline — for descale. */
export function DescaleAnim({ size = 130 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="maint">
      {/* boiler outline */}
      <rect x="30" y="18" width="40" height="60" rx="6" fill="var(--surface)" stroke="var(--ink-soft)" strokeWidth="1.8" />
      {/* input pipe */}
      <path d="M50 12v6" stroke="var(--ink-soft)" strokeWidth="2.2" strokeLinecap="round" />
      {/* fill/drain liquid — clip to boiler */}
      <clipPath id="boiler-clip">
        <rect x="31" y="19" width="38" height="58" rx="5" />
      </clipPath>
      <g clipPath="url(#boiler-clip)">
        <rect className="maint-liquid" x="30" y="78" width="40" height="60" fill="var(--clay)" opacity="0.55" />
        {/* bubbles inside */}
        <g fill="var(--surface)" opacity="0.8">
          <circle className="maint-boil-1" cx="41" cy="60" r="1.6" />
          <circle className="maint-boil-2" cx="58" cy="55" r="1.8" />
          <circle className="maint-boil-3" cx="50" cy="65" r="1.4" />
        </g>
      </g>
      {/* legs */}
      <line x1="36" y1="82" x2="36" y2="88" stroke="var(--ink-soft)" strokeWidth="2" strokeLinecap="round" />
      <line x1="64" y1="82" x2="64" y2="88" stroke="var(--ink-soft)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function MaintenanceAnim({
  anim,
  size,
}: {
  anim: "brush" | "backflush" | "detergent" | "screen" | "descale";
  size?: number;
}) {
  switch (anim) {
    case "brush":
      return <BrushAnim size={size} />;
    case "backflush":
      return <BackflushAnim size={size} />;
    case "detergent":
      return <DetergentAnim size={size} />;
    case "screen":
      return <ScreenAnim size={size} />;
    case "descale":
      return <DescaleAnim size={size} />;
  }
}
