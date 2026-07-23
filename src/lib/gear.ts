import type { GearConfig, Recipe, Shot, Advice, FlavorProfile } from "./types";

/**
 * Single source of truth for the user's hardware. Fed verbatim into every
 * Claude prompt so recommendations are grounded in the real machine, not
 * guessed. Figures sourced from Fellow's Opus espresso guidance, the Lelit
 * Anna PL41EM manual / Home-Barista threads, and SCA dial-in method.
 */
export const DEFAULT_GEAR: GearConfig = {
  grinder: "Fellow Opus (conical burr)",
  machine: "Lelit Anna PL41EM (single boiler, no PID)",
  portafilter: "Bottomless / naked, 18–20 g basket",
  basketMin: 18,
  basketMax: 20,
};

export const OPUS = {
  macroTotal: 41, // 41 grind settings on the outer dial
  micronsPerMacro: 50, // ≈50 µm per outer click
  micronsPerMicro: 16.7, // inner blue ring: 3 micro per macro (≈16.7 µm)
  espressoMacroLow: 1, // usable espresso zone lives at the very fine end
  espressoMacroHigh: 4,
};

/** The knowledge block injected into Claude prompts. Plain, factual, sourced. */
export const GEAR_BRIEF = `THE BARISTA'S GEAR (ground truth — never contradict this):

GRINDER — Fellow Opus (conical burr):
- 41 macro clicks on the outer dial (~50 µm per click). An inner blue micro-ring
  gives 3 finer sub-steps per macro click (~16.7 µm each) — this micro-ring is
  the real dial-in tool for espresso.
- Espresso lives at the VERY fine end of the Opus: macro 1–4. Many units need
  ~1.5–3.0. The Opus is capable but marginal for espresso, so small moves
  matter — prefer changing the micro-ring (1 tick) before a whole macro click.
- Express grind as "macro.micro", e.g. "2 · 1 tick" means macro 2, one micro tick finer.
- PRECISION: state every grind change as a DIRECTION + MAGNITUDE — e.g. "1 micro-tick
  finer (⅓ click, ~17 µm)" or "1 full click coarser (~50 µm)". Near the target, move a
  single micro-tick at a time; never say "a bit finer/coarser" without the number.

MACHINE — Lelit Anna PL41EM (base model, IMPORTANT: NO PID):
- Single 250 ml brass boiler, 57 mm group, vibration pump, 3-way solenoid.
- Temperature is thermostat-controlled — there is NO settable brew temperature
  and NO digital readout. You CANNOT tell the user to "set 93 °C". Instead give
  temperature guidance as workflow: full warm-up (20–30 min with portafilter
  locked in), and temperature-surfing — after the heating light cycles off,
  wait a few seconds (or do a short "cooling flush") before pulling, because a
  single boiler drifts hot right after the element cycles. For light roasts run
  hotter (pull sooner after the light goes out); for dark roasts run cooler
  (wait longer / flush a touch more).
- Pressure: vibration pump, gauge green zone ~8–12 bar; ~9 bar ideal at the puck.
- Pre-infusion: NO programmed pre-infusion. Only manual/line pre-infusion —
  flip the brew switch on for ~2–4 s to wet and gently pressurise the puck,
  pause ~2–3 s, then continue. Keep it simple; it mainly helps reduce channeling.

PORTAFILTER — bottomless (naked), 18–20 g basket:
- A bottomless portafilter reveals channeling and uneven extraction. Coach good
  puck prep: distribute/WDT, level, tamp square. If the shot squirts, sprays, or
  goes blonde in one spot, that's channeling — a prep problem, not always grind.

BASELINE (starting point, then adjust by taste):
- Dose 18 g, ratio 1:2 (≈36 g out), target 25–32 s from first drops.
- SCA method: sour/thin = under-extracted → grind FINER (or raise temp / longer
  ratio). Bitter/harsh/dry = over-extracted → grind COARSER (or lower temp /
  shorter ratio). Change ONE variable at a time; keep dose & yield fixed while
  chasing grind, so taste changes are attributable.`;

/** Absolute grind position in micro-ticks (higher = coarser; +micro = finer). */
function gridPos(r: { grinderMacro: number; grinderMicro: number }): number {
  return r.grinderMacro * 3 - r.grinderMicro;
}

/** Human magnitude of a grind move, e.g. "1 micro-tick (~17 µm)" or "1 click (~50 µm)". */
export function magnitude(
  from: { grinderMacro: number; grinderMicro: number },
  to: { grinderMacro: number; grinderMicro: number }
): string {
  const d = Math.abs(gridPos(to) - gridPos(from));
  if (d === 0) return "a hair";
  const clicks = Math.floor(d / 3);
  const micros = d % 3;
  const parts: string[] = [];
  if (clicks) parts.push(`${clicks} click${clicks > 1 ? "s" : ""}`);
  if (micros) parts.push(`${micros} micro-tick${micros > 1 ? "s" : ""}`);
  return `${parts.join(" + ")} (~${Math.round(d * OPUS.micronsPerMicro)} µm)`;
}

export function formatGrind(r: { grinderMacro: number; grinderMicro: number }): string {
  const micro = r.grinderMicro
    ? ` · +${r.grinderMicro} micro`
    : "";
  return `Opus ${r.grinderMacro}${micro}`;
}

export function ratioLabel(dose: number, yieldG: number): string {
  if (!dose) return "1:2";
  return `1:${(yieldG / dose).toFixed(1).replace(/\.0$/, "")}`;
}

/** A sane default recipe used before Claude responds / as a fallback. */
export function baselineRecipe(): Recipe {
  return {
    grinderMacro: 2,
    grinderMicro: 0,
    dose: 18,
    yieldG: 36,
    ratio: "1:2",
    timeSeconds: 28,
    tamp: "Level bed, square tamp ~15 kg. Consistency over force.",
    temperature:
      "Warm up 20–30 min with the portafilter locked in. Pull a few seconds after the heat light clicks off.",
    preInfusion: "Optional: brew on ~3 s, pause ~2 s, then continue (manual pre-infusion).",
    notes: "",
  };
}

/**
 * Deterministic dial-in fallback, grounded in SCA method. Used when Claude is
 * unreachable so the loop still works offline. Adjusts one variable at a time.
 */
export function localAdjustment(recipe: Recipe, flavor: FlavorProfile, _shots: Shot[]): Advice {
  const next: Recipe = { ...recipe };
  const changes: Advice["changes"] = [];
  const sour = flavor.acidity - flavor.bitterness; // >0 leans sour/under
  const tooFast = (recipe.timeSeconds ?? 28) < 22;
  const tooSlow = (recipe.timeSeconds ?? 28) > 34;

  let diagnosis = "";
  if (flavor.verdict === "love") {
    return {
      onTarget: true,
      summary: "This one's dialed. Lock it in.",
      diagnosis: "You marked this shot as one you love — no changes needed.",
      changes: [],
      nextRecipe: recipe,
      predictedEffect: "Save these settings for this coffee.",
      source: "local",
    };
  }

  // Priority 1: grind, driven by sour↔bitter balance and flow speed.
  if (sour > 12 || tooFast) {
    // under-extracted → finer, by one micro-tick where possible
    if (next.grinderMicro < 2) next.grinderMicro += 1;
    else {
      next.grinderMicro = 0;
      next.grinderMacro = Math.max(OPUS.espressoMacroLow, next.grinderMacro - 1);
    }
    const mag = magnitude(recipe, next);
    diagnosis =
      "Reads under-extracted (sour / thin / fast flow). Tightening the grind slows the water and pulls more sweetness and body.";
    changes.push({
      field: "Grind",
      from: formatGrind(recipe),
      to: formatGrind(next),
      why: `${mag} finer → slower flow → less sour, more sweetness.`,
    });
  } else if (sour < -12 || tooSlow) {
    // over-extracted → coarser, by one micro-tick where possible
    if (next.grinderMicro > 0) next.grinderMicro -= 1;
    else {
      next.grinderMicro = 2;
      next.grinderMacro = Math.min(OPUS.espressoMacroHigh, next.grinderMacro + 1);
    }
    const mag = magnitude(recipe, next);
    diagnosis =
      "Reads over-extracted (bitter / dry / slow flow). Opening the grind speeds the shot and pulls back the bitterness.";
    changes.push({
      field: "Grind",
      from: formatGrind(recipe),
      to: formatGrind(next),
      why: `${mag} coarser → faster flow → less bitter, cleaner finish.`,
    });
  } else if (flavor.sweetness < 45) {
    // balanced but flat → nudge ratio / temp via workflow
    next.yieldG = Math.round(recipe.dose * 2.1);
    next.ratio = ratioLabel(next.dose, next.yieldG);
    diagnosis =
      "Balance is close but it tastes a little flat. A slightly longer ratio lifts clarity and sweetness without a grind change.";
    changes.push({
      field: "Yield",
      from: `${recipe.yieldG} g`,
      to: `${next.yieldG} g`,
      why: "Longer ratio → more sweetness & clarity.",
    });
    changes.push({
      field: "Temp workflow",
      from: "standard",
      to: "run a touch hotter",
      why: "Pull sooner after the heat light cycles off to raise extraction.",
    });
  } else {
    diagnosis =
      "Pretty balanced. Small taste tweak: adjust yield slightly toward what you prefer, keep grind fixed.";
    changes.push({
      field: "Hold grind",
      from: formatGrind(recipe),
      to: formatGrind(recipe),
      why: "You're in the zone — change only one small thing and re-taste.",
    });
  }

  next.ratio = ratioLabel(next.dose, next.yieldG);
  return {
    onTarget: false,
    summary: changes[0]
      ? `${changes[0].field}: ${changes[0].from} → ${changes[0].to}`
      : "Small tweak and re-taste.",
    diagnosis,
    changes,
    nextRecipe: next,
    predictedEffect:
      sour > 12
        ? "Expect a slower, sweeter shot with less sour bite."
        : sour < -12
        ? "Expect a faster, cleaner shot with less bitterness."
        : "Expect a touch more sweetness and clarity.",
    source: "local",
  };
}
