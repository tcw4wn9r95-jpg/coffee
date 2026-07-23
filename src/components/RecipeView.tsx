import type { Recipe } from "../lib/types";
import { formatGrind } from "../lib/gear";

export function RecipeView({ r }: { r: Recipe }) {
  return (
    <div>
      <div className="spec-grid">
        <div className="spec">
          <div className="spec-label">Grind — Opus</div>
          <div className="spec-value">
            {r.grinderMacro}
            {r.grinderMicro ? (
              <>
                {" "}
                <small>+{r.grinderMicro} micro</small>
              </>
            ) : null}
          </div>
          <div className="spec-note">outer click · inner micro-ring</div>
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
