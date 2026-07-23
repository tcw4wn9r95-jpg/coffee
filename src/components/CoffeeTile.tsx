import { useNavigate } from "react-router-dom";
import type { Coffee } from "../lib/types";
import { usePhotoURL } from "./PhotoThumb";
import { roastColor, roastLabel, roastMeta } from "../lib/roast";

/** An illustrated kraft coffee bag, tinted by roast, used when there's no photo. */
function BagIllustration({ coffee }: { coffee: Coffee }) {
  const m = roastMeta(coffee.roastLevel);
  const initials =
    (coffee.roaster || coffee.name || "•")
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || "")
      .join("") || "•";
  return (
    <svg viewBox="0 0 100 132" className="bag-svg" role="img" aria-label="Coffee bag">
      <defs>
        <linearGradient id={`bg-${coffee.id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={m.tint} />
          <stop offset="1" stopColor={m.bean} stopOpacity="0.85" />
        </linearGradient>
      </defs>
      {/* body */}
      <rect x="16" y="26" width="68" height="98" rx="7" fill={`url(#bg-${coffee.id})`} />
      {/* side seam sheen */}
      <rect x="49" y="30" width="2" height="90" fill="#000" opacity="0.06" />
      {/* crimped folded top */}
      <path
        d="M16 26 q0 -6 6 -6 l56 0 q6 0 6 6 l0 6 l-68 0 z"
        fill={m.bean}
      />
      <path
        d="M18 20 l64 0 l0 3 l-64 0 z"
        fill="#000"
        opacity="0.12"
      />
      {/* degassing valve */}
      <circle cx="50" cy="40" r="4" fill="#000" opacity="0.14" />
      {/* label */}
      <rect x="26" y="54" width="48" height="52" rx="5" fill="#FBF8F1" opacity="0.96" />
      <rect x="26" y="54" width="48" height="8" rx="5" fill={m.bean} />
      <text
        x="50"
        y="80"
        textAnchor="middle"
        fontSize="15"
        fontFamily="ui-serif, Georgia, serif"
        fill={roastColor(coffee.roastLevel)}
        fontWeight="600"
      >
        {initials}
      </text>
      <rect x="34" y="88" width="32" height="3" rx="1.5" fill={m.bean} opacity="0.5" />
      <rect x="38" y="95" width="24" height="3" rx="1.5" fill={m.bean} opacity="0.3" />
    </svg>
  );
}

export function CoffeeTile({ coffee, index = 0 }: { coffee: Coffee; index?: number }) {
  const nav = useNavigate();
  const url = usePhotoURL(coffee.photoId);
  const locked = coffee.status === "locked";
  const place = [coffee.region, coffee.origin].filter(Boolean).join(", ");

  return (
    <button
      className="tile"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
      onClick={() => nav(`/coffee/${coffee.id}`)}
    >
      <div className="tile-stage">
        <div className={`tile-product ${url ? "has-photo" : "is-bag"}`}>
          {url ? (
            <img src={url} className="tile-photo" alt={coffee.name} />
          ) : (
            <BagIllustration coffee={coffee} />
          )}
          <span className="tile-gloss" />
          <span className={`tile-ribbon ${locked ? "is-locked" : "is-dialing"}`}>
            {locked ? "Dialed" : "Dialing"}
          </span>
        </div>
        <span className="tile-shadow" />
      </div>

      <div className="tile-plate">
        <div className="tile-name">{coffee.name}</div>
        <div className="tile-meta">
          <span className="roast-dot" style={{ background: roastColor(coffee.roastLevel) }} />
          <span>{place || coffee.roaster || roastLabel(coffee.roastLevel)}</span>
        </div>
      </div>
    </button>
  );
}
