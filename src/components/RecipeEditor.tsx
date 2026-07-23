import { useState } from "react";
import type { Recipe } from "../lib/types";
import { ratioLabel } from "../lib/gear";

function numField(
  label: string,
  value: number,
  step: number,
  min: number,
  max: number,
  onChange: (n: number) => void,
  suffix?: string
) {
  return (
    <label className="field" style={{ marginTop: 0 }}>
      <span className="field-label">{label}</span>
      <div className="row" style={{ gap: 8 }}>
        <input
          className="input"
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(clamp(Number(e.target.value), min, max))}
          style={{ textAlign: "center" }}
        />
        {suffix && <span className="muted" style={{ fontSize: 13 }}>{suffix}</span>}
      </div>
    </label>
  );
}
const clamp = (v: number, lo: number, hi: number) =>
  Number.isNaN(v) ? lo : Math.min(hi, Math.max(lo, v));

export function RecipeEditor({
  recipe,
  onChange,
}: {
  recipe: Recipe;
  onChange: (r: Recipe) => void;
}) {
  const [showText, setShowText] = useState(false);
  const set = (patch: Partial<Recipe>) => {
    const next = { ...recipe, ...patch };
    next.ratio = ratioLabel(next.dose, next.yieldG);
    onChange(next);
  };
  return (
    <div className="card card-pad stack">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {numField("Opus macro", recipe.grinderMacro, 1, 1, 41, (n) => set({ grinderMacro: n }))}
        {numField("Micro ticks", recipe.grinderMicro, 1, 0, 2, (n) => set({ grinderMicro: n }))}
        {numField("Dose", recipe.dose, 0.5, 14, 22, (n) => set({ dose: n }), "g")}
        {numField("Yield", recipe.yieldG, 1, 20, 60, (n) => set({ yieldG: n }), "g")}
        {numField("Time", recipe.timeSeconds, 1, 10, 60, (n) => set({ timeSeconds: n }), "s")}
        <label className="field" style={{ marginTop: 0 }}>
          <span className="field-label">Ratio</span>
          <input className="input" value={recipe.ratio} disabled style={{ textAlign: "center" }} />
        </label>
      </div>

      <button className="link-btn" onClick={() => setShowText((s) => !s)}>
        {showText ? "Hide" : "Edit"} tamp · temperature · pre-infusion
      </button>
      {showText && (
        <div className="stack">
          <label className="field" style={{ marginTop: 0 }}>
            <span className="field-label">Tamp</span>
            <textarea className="textarea" value={recipe.tamp} onChange={(e) => set({ tamp: e.target.value })} />
          </label>
          <label className="field" style={{ marginTop: 0 }}>
            <span className="field-label">Temperature (no PID — workflow)</span>
            <textarea className="textarea" value={recipe.temperature} onChange={(e) => set({ temperature: e.target.value })} />
          </label>
          <label className="field" style={{ marginTop: 0 }}>
            <span className="field-label">Pre-infusion</span>
            <textarea className="textarea" value={recipe.preInfusion} onChange={(e) => set({ preInfusion: e.target.value })} />
          </label>
        </div>
      )}
    </div>
  );
}
