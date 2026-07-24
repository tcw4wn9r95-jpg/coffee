import { useState } from "react";
import type { Recipe } from "../lib/types";

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

/** Common espresso brew ratios (yield ÷ dose). */
const BASE_RATIOS = [1.5, 1.75, 2, 2.25, 2.5, 2.75, 3];

/** Parse "1:2.1" → 2.1; falls back to 2 for anything unusable. */
function ratioValue(r?: string): number {
  const n = r ? parseFloat(r.split(":")[1]) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 2;
}
const round2 = (v: number) => Math.round(v * 100) / 100;
/** "1:2", "1:2.5", "1:2.1" — trailing zeros stripped. */
const ratioText = (v: number) => `1:${round2(v)}`;
/** Yield from dose × ratio, snapped to the nearest half-gram. */
const yieldFor = (dose: number, v: number) => Math.round(dose * v * 2) / 2;

export function RecipeEditor({
  recipe,
  onChange,
  recommendedRatio,
}: {
  recipe: Recipe;
  onChange: (r: Recipe) => void;
  /** Bruna's suggested ratio, e.g. "1:2" — marked "recommended" in the dropdown. */
  recommendedRatio?: string;
}) {
  const [showText, setShowText] = useState(false);

  const currentVal = recipe.dose ? round2(recipe.yieldG / recipe.dose) : 2;
  const recVal = recommendedRatio ? round2(ratioValue(recommendedRatio)) : null;

  // The dropdown offers the standard ladder plus Bruna's pick and the current
  // value (so a non-standard ratio like 1:2.1 is always selectable).
  const options = Array.from(
    new Set([
      ...BASE_RATIOS,
      ...(recVal !== null ? [recVal] : []),
      currentVal,
    ])
  ).sort((a, b) => a - b);

  const set = (patch: Partial<Recipe>) => onChange({ ...recipe, ...patch });

  const setDose = (dose: number) =>
    set({ dose, yieldG: yieldFor(dose, currentVal), ratio: ratioText(currentVal) });

  const setRatio = (v: number) =>
    set({ yieldG: yieldFor(recipe.dose, v), ratio: ratioText(v) });

  return (
    <div className="card card-pad stack">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {numField("Opus macro", recipe.grinderMacro, 1, 1, 41, (n) => set({ grinderMacro: n }))}
        {numField("Micro ticks", recipe.grinderMicro, 1, 0, 2, (n) => set({ grinderMicro: n }))}
        {numField("Dose in", recipe.dose, 0.5, 14, 22, setDose, "g")}

        <label className="field" style={{ marginTop: 0 }}>
          <span className="field-label">Ratio</span>
          <select
            className="input"
            value={currentVal}
            onChange={(e) => setRatio(Number(e.target.value))}
            style={{ textAlign: "center" }}
          >
            {options.map((v) => (
              <option key={v} value={v}>
                {ratioText(v)}
                {recVal !== null && v === recVal ? " · recommended" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="field" style={{ marginTop: 0 }}>
          <span className="field-label">Yield out</span>
          <div className="input input-readout">
            {recipe.yieldG} g
            <span className="readout-hint">auto</span>
          </div>
        </label>

        {numField("Time", recipe.timeSeconds, 1, 10, 60, (n) => set({ timeSeconds: n }), "s")}
      </div>

      {recVal !== null && (
        <p className="muted" style={{ fontSize: 12.5, marginTop: -2 }}>
          Enter your dose — Bruna computes the yield. Recommended ratio{" "}
          <strong>{ratioText(recVal)}</strong>
          {round2(currentVal) !== recVal && (
            <>
              {" · "}
              <button className="link-btn" style={{ fontSize: 12.5 }} onClick={() => setRatio(recVal)}>
                use it
              </button>
            </>
          )}
        </p>
      )}

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
