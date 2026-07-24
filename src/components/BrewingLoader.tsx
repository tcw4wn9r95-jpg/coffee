/**
 * A calm, on-brand "thinking" animation: espresso drips falling into a cup,
 * a settling crema, and steam rising — what Bruna is actually doing while she
 * reasons about a shot. Pure SVG + CSS (see `.brew-*` in global.css), and it
 * quietly holds still under prefers-reduced-motion.
 */
export function BrewingLoader({ size = 96 }: { size?: number }) {
  return (
    <div className="brew" style={{ width: size, height: size }} role="img" aria-label="Brewing">
      <svg viewBox="0 0 72 72" width={size} height={size} fill="none">
        {/* steam */}
        <g className="brew-steam" stroke="var(--clay)" strokeWidth="2" strokeLinecap="round" opacity="0.55">
          <path className="brew-steam-1" d="M30 30c-2-3 2-5 0-8" />
          <path className="brew-steam-2" d="M42 30c-2-3 2-5 0-8" />
        </g>

        {/* falling espresso drips */}
        <g fill="var(--clay)">
          <ellipse className="brew-drip brew-drip-1" cx="36" cy="20" rx="1.7" ry="2.5" />
          <ellipse className="brew-drip brew-drip-2" cx="36" cy="20" rx="1.7" ry="2.5" />
          <ellipse className="brew-drip brew-drip-3" cx="36" cy="20" rx="1.7" ry="2.5" />
        </g>

        {/* cup */}
        <g stroke="var(--ink-soft)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round">
          <path d="M21 39h30l-3.2 18a4 4 0 0 1-3.95 3.4H28.15a4 4 0 0 1-3.95-3.4L21 39Z" fill="var(--surface)" />
          <path d="M50.5 41.5c6-1.2 9 1.5 8 6.5-0.9 4.6-4.8 6-9 5.2" />
          {/* crema surface */}
          <ellipse cx="36" cy="39" rx="15" ry="3.4" fill="var(--clay)" stroke="none" />
          <ellipse className="brew-ripple" cx="36" cy="39" rx="6" ry="1.4" fill="none" stroke="var(--clay-tint)" strokeWidth="1.6" />
        </g>

        {/* saucer */}
        <ellipse cx="36" cy="66" rx="21" ry="2.6" fill="var(--ink-soft)" opacity="0.18" />
      </svg>
    </div>
  );
}
