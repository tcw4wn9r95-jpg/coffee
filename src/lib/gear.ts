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
- DIRECTION on the physical dials:
  · Outer macro dial: LOWER number = finer, higher number = coarser.
  · Inner micro-ring: turn toward the "−" mark for FINER (tighter burrs);
    toward "+" for COARSER (wider burrs). ALWAYS refer to the ring by its
    physical marking (− / +), never as "add micro" or "+1 micro".
- Express a grind position as "Macro N" or "Macro N · Micro −M", e.g. "Macro 2"
  (macro click 2, no micro offset) or "Macro 2 · Micro −1" (macro 2 with the inner
  ring rotated one tick toward the − mark — one micro-tick finer than Macro 2).
  Do NOT prefix with "Opus" — the app already labels the grinder.
- PRECISION: state every grind change as a DIRECTION + MAGNITUDE — e.g. "1 micro-tick
  finer, rotate the inner ring one tick toward − (⅓ click, ~17 µm)" or
  "1 full macro-click coarser, outer dial from 2 → 3 (~50 µm)". Near the target,
  move a single micro-tick at a time; never say "a bit finer/coarser" without the
  number and the physical direction.
- CROSSING BOUNDARIES (very important — do not confuse the net direction with
  the individual dial motions): going from "Macro 2 · Micro −0" one tick COARSER
  lands you at "Macro 3 · Micro −2" (you click the outer dial from 2 → 3, then
  rotate the inner ring 2 ticks TOWARD − to back off — net move is 1 tick
  coarser). Conversely, going from "Macro 3 · Micro −0" one tick FINER lands at
  "Macro 3 · Micro −1" (just rotate the ring 1 tick toward −). NEVER describe a
  coarser move as "rotate the ring toward −" without also stating the macro
  click, because on its own "toward −" always means finer. When macro and micro
  change together, spell out BOTH steps in order.

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
- TAMPING — be specific about force, not vague:
  · Target ~15 kg (≈30 lb) of downward pressure. Home baristas can calibrate
    once on a bathroom scale: press the tamper until the scale reads 15 kg,
    then hold that finger memory.
  · Method: rest the tamper flat on the grounds, then press straight down with
    steady force for ~1–2 seconds until you feel the puck stop compressing
    (past ~15 kg the puck barely moves — extra force just tires your wrist).
  · Level matters more than force. A crooked tamp = channeling on a bottomless
    portafilter regardless of how hard you press.
  · Consistency shot-to-shot > exact weight. Same force every time is what
    makes the dial-in loop meaningful.

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

/**
 * Describe the exact physical dial movements needed to get from one Opus
 * position to another. Handles the cases where the macro AND micro change at
 * the same time — a step that's net coarser can involve rotating the micro
 * ring toward −, which the hardcoded "toward +" phrasing gets wrong.
 */
export function physicalMove(
  from: { grinderMacro: number; grinderMicro: number },
  to: { grinderMacro: number; grinderMicro: number }
): string {
  const dMacro = to.grinderMacro - from.grinderMacro;
  const dMicro = to.grinderMicro - from.grinderMicro;
  const parts: string[] = [];
  if (dMacro > 0) {
    parts.push(
      `click the outer dial ${dMacro} step${dMacro > 1 ? "s" : ""} coarser (${from.grinderMacro} → ${to.grinderMacro})`
    );
  } else if (dMacro < 0) {
    parts.push(
      `click the outer dial ${-dMacro} step${-dMacro > 1 ? "s" : ""} finer (${from.grinderMacro} → ${to.grinderMacro})`
    );
  }
  if (dMicro > 0) {
    parts.push(
      `rotate the inner ring ${dMicro} tick${dMicro > 1 ? "s" : ""} toward − (finer)`
    );
  } else if (dMicro < 0) {
    parts.push(
      `rotate the inner ring ${-dMicro} tick${-dMicro > 1 ? "s" : ""} toward + (coarser)`
    );
  }
  if (parts.length === 0) return "hold the grind";
  return parts.join(", then ");
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
  // Compact, matches the physical dial: "Macro 2" or "Macro 2 · Micro −2".
  // Ticks toward the − mark → finer, so we render with the minus sign.
  const micro = r.grinderMicro ? ` · Micro −${r.grinderMicro}` : "";
  return `Macro ${r.grinderMacro}${micro}`;
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
    tamp: "Level bed, square tamp with ~15 kg (≈30 lb) of steady pressure — press until the puck stops compressing (~1–2 s). Level matters more than force; consistency shot-to-shot matters most.",
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
  const sliderSour = flavor.acidity - flavor.bitterness; // >0 leans sour/under
  const tooFast = (recipe.timeSeconds ?? 28) < 22;
  const tooSlow = (recipe.timeSeconds ?? 28) > 34;

  // Fault chips are the strongest signal — they encode a direct extraction
  // verdict, regardless of whether the sliders were moved. Convert them into
  // the same sour/bitter axis the rest of the logic uses.
  const faults = (flavor.faults || []).map((f) => f.toLowerCase());
  const hasAny = (...needles: string[]) => faults.some((f) => needles.some((n) => f.includes(n)));
  let faultBias = 0;
  if (hasAny("sour", "sharp", "weak", "watery")) faultBias += 25;
  if (hasAny("bitter", "harsh", "dry", "ashy", "burnt")) faultBias -= 25;
  if (hasAny("flat", "dull", "not sweet")) faultBias += 8; // usually slight under-extraction
  const sour = sliderSour + faultBias;

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
      why: `${mag} finer — ${physicalMove(recipe, next)} → slower flow → less sour, more sweetness.`,
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
      why: `${mag} coarser — ${physicalMove(recipe, next)} → faster flow → less bitter, cleaner finish.`,
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
    // Shot reads balanced but the barista wasn't in love. Rather than fake
    // a "Hold grind" no-change change (which renders as "Opus 2 → Opus 2"),
    // give a small workflow nudge and let the empty-changes case narrate.
    diagnosis =
      "This reads pretty balanced. Nothing needs a big move — pull the same shot again focusing on puck prep and temperature-surf timing before changing settings.";
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
