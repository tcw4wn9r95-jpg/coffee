import { useState } from "react";
import type { Recipe } from "../lib/types";
import { dialLabel, formatGrind, grindMicrons, unifiedLabel } from "../lib/gear";
import { OpusDial } from "./OpusDial";

export function RecipeView({
  r,
  onChange,
}: {
  r: Recipe;
  /**
   * Provide for the recipe you're about to pull, and the dial map becomes the
   * grind control itself. Without it the map is read-only — correct for a
   * locked recipe or Bruna's proposed next one, which aren't yours to drag.
   */
  onChange?: (next: Recipe) => void;
}) {
  const [showDial, setShowDial] = useState(false);
  return (
    <div>
      <div className="spec-grid">
        <div className="spec">
          <div className="spec-label">Grind size</div>
          <div className="spec-value">
            {unifiedLabel(r)}{" "}
            <span style={{ fontSize: 14, letterSpacing: "0.02em" }}>
              ~{grindMicrons(r)} µm
            </span>
          </div>
          <div className="spec-note">
            Opus {dialLabel(r)} — inner ring toward − mark for finer
          </div>
          <button
            type="button"
            className="link-btn"
            style={{ fontSize: 12, marginTop: 4 }}
            onClick={() => setShowDial((s) => !s)}
          >
            {showDial ? "Hide" : onChange ? "Adjust grind" : "Show dial map"}
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
          <OpusDial
            macro={r.grinderMacro}
            micro={r.grinderMicro}
            size={280}
            onChange={onChange ? (g) => onChange({ ...r, ...g }) : undefined}
          />
          {onChange && (
            <p className="muted" style={{ fontSize: 12, textAlign: "center", marginTop: 2 }}>
              Drag either scale — or tap a mark — to move the dials.
            </p>
          )}
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
