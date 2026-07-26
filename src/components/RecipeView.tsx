import { useState } from "react";
import type { Recipe } from "../lib/types";
import { formatGrind } from "../lib/gear";
import { OpusDial } from "./OpusDial";

export function RecipeView({ r }: { r: Recipe }) {
  const [showDial, setShowDial] = useState(false);
  return (
    <div>
      <div className="spec-grid">
        <div className="spec">
          <div className="spec-label">Grind</div>
          <div className="spec-value">
            <span style={{ fontSize: 14, letterSpacing: "0.02em" }}>Macro</span>{" "}
            {r.grinderMacro}
            {r.grinderMicro ? (
              <>
                {" · "}
                <span style={{ fontSize: 14, letterSpacing: "0.02em" }}>Micro</span>{" "}
                <span>−{r.grinderMicro}</span>
              </>
            ) : null}
          </div>
          <div className="spec-note">Fellow Opus — inner ring toward − mark for finer</div>
          <button
            type="button"
            className="link-btn"
            style={{ fontSize: 12, marginTop: 4 }}
            onClick={() => setShowDial((s) => !s)}
          >
            {showDial ? "Hide" : "Show"} dial map
          </button>
        </div>
        <div className="spec">
          <div className="spec-label">Dose → Yield</div>
          <div className="spec-value">
            {r.dose}<small> g</small> → {r.yieldG}<small> g</small>
          </div>
          <div className="spec-note">ratio {r.ratio}</div>
        </div>
        <div className="spec">
          <div className="spec-label">Shot time</div>
          <div className="spec-value">
            {r.timeSeconds}<small> s</small>
          </div>
          <div className="spec-note">from first drops</div>
        </div>
        <div className="spec">
          <div className="spec-label">Tamp</div>
          <div className="spec-value" style={{ fontSize: 15, lineHeight: 1.3 }}>
            {r.tamp}
          </div>
        </div>
        <div className="spec spec-wide">
          <div className="spec-label">Temperature — no PID</div>
          <div className="spec-note" style={{ fontSize: 13.5, marginTop: 5 }}>
            {r.temperature}
          </div>
        </div>
        <div className="spec spec-wide">
          <div className="spec-label">Pre-infusion</div>
          <div className="spec-note" style={{ fontSize: 13.5, marginTop: 5 }}>
            {r.preInfusion}
          </div>
        </div>
      </div>
      {showDial && (
        <div className="card card-pad" style={{ marginTop: 10 }}>
          <OpusDial macro={r.grinderMacro} micro={r.grinderMicro} size={280} />
        </div>
      )}
      {r.notes ? (
        <p className="muted" style={{ fontSize: 13.5, marginTop: 12 }}>
          {r.notes}
        </p>
      ) : null}
    </div>
  );
}

export function RecipeLine({ r }: { r: Recipe }) {
  return (
    <span>
      {formatGrind(r)} · {r.dose}→{r.yieldG} g · {r.timeSeconds}s
    </span>
  );
}
