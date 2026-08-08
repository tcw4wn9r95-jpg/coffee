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

/**
 * The Fellow Opus grind geometry, matching the Beanie app (the Opus-specific
 * grind-size companion) so a setting means exactly the same thing in both.
 *
 * The physical dial:
 *   · The outer dial has 41 detents ("clicks") spanning the PRINTED numbers
 *     1 … 11 — so each printed number is 4 clicks apart, with 3 unnumbered
 *     sub-clicks between each pair. One click ≈ 50 µm.
 *   · The inner ring adds 3 micro-ticks per click (⅓ of a click, ≈16.7 µm).
 *
 * Beanie's UNIFIED GRIND SIZE is a single decimal on that printed-number
 * scale: one click = 0.25, one micro-tick = 1/12 ≈ 0.083. Microns are simply
 * 200 µm per unified point (= 4 clicks × 50 µm). Verified against the app:
 * outer dial one sub-click past 1 with the ring one tick toward "+" reads
 * "1.33 ~ 266 µm" — exactly 1.25 + 1/12 = 1.3333, ×200 = 266.7.
 *
 * The two dials are INDEPENDENT, exactly as they are on the machine: turning
 * the inner ring does not move the outer dial, and vice versa. A Recipe stores
 * each one as the barista left it:
 *   · `grinderMacro` — the outer-dial CLICK (1–41), NOT the printed number:
 *     click 1 = printed 1, click 5 = printed 2, click 41 = printed 11.
 *   · `grinderMicro` — the inner ring's offset from that click, in ticks toward
 *     the "−" mark, so POSITIVE is finer and NEGATIVE (toward "+") is coarser.
 *     The ring turns up to a full click either way: −3 … +3.
 * Never "normalise" a setting by folding ring travel onto the outer dial —
 * (click 5, ring −3) and (click 4, ring 0) are the same burr gap, but they are
 * different dial positions, and the barista is looking at the dials.
 *
 * Caveat on the micron figures: this linear 50 µm/click model is Beanie's, and
 * it matches the app exactly at the fine end where espresso lives. Extrapolated
 * to the coarse end it overshoots Fellow's published 230–1160 µm range (click 41
 * computes to 2200 µm), so treat microns as a comparison scale for dialling in,
 * not a calibrated particle measurement.
 */
export const OPUS = {
  clicksTotal: 41, // 41 detents on the outer dial
  clicksPerNumber: 4, // printed numbers are 4 clicks apart (3 sub-clicks between)
  dialNumberMax: 11, // outer dial is printed 1 … 11
  microPerClick: 3, // inner ring: 3 micro-ticks per outer click
  ringTravel: 3, // the ring turns up to one full click either side of the dial
  micronsPerMacro: 50, // ≈50 µm per outer click
  micronsPerMicro: 50 / 3, // inner ring tick ≈16.7 µm
  micronsPerUnified: 200, // Beanie: one printed number ≈ 200 µm
  espressoClickLow: 1, // usable espresso zone lives at the very fine end
  espressoClickHigh: 8, // click 8 = unified 2.75 (~550 µm)
  espressoUnifiedLow: 1.0, // published Opus espresso range, in Beanie units
  espressoUnifiedHigh: 2.5,
};

/**
 * Reference brew-method windows on Beanie's unified scale, from published Opus
 * grind charts. Espresso-only app, but Claude uses these to know how narrow the
 * espresso end really is (the whole espresso range is ~6 clicks wide).
 */
export const OPUS_BREW_RANGES: Array<[method: string, low: number, high: number]> = [
  ["Espresso", 1, 2.5],
  ["Moka pot", 2.5, 5.5],
  ["AeroPress", 2, 8.75],
  ["Pour over", 3, 8.5],
  ["Drip", 2, 8],
  ["French press", 6, 11],
  ["Cold brew", 7.25, 11],
];

/** Printed outer-dial number for a click index (click 1 → 1, click 5 → 2). */
export function dialNumber(click: number): number {
  return 1 + (click - 1) / OPUS.clicksPerNumber;
}

/** Beanie "unified grind size" — one decimal covering both dials. */
export function unifiedGrind(r: { grinderMacro: number; grinderMicro: number }): number {
  return dialNumber(r.grinderMacro) - r.grinderMicro / (OPUS.clicksPerNumber * OPUS.microPerClick);
}

/** Approximate particle size for a setting, the way Beanie reports it. */
export function grindMicrons(r: { grinderMacro: number; grinderMicro: number }): number {
  return Math.floor(unifiedGrind(r) * OPUS.micronsPerUnified);
}

/** The unified number as Beanie prints it, e.g. "1.33". */
export function unifiedLabel(r: { grinderMacro: number; grinderMicro: number }): string {
  return unifiedGrind(r).toFixed(2);
}

/**
 * Where to physically put the two dials, in the terms printed on the grinder:
 * "dial 2" (a numbered detent), "dial 1 +2" (2 sub-clicks past the printed 1),
 * with the inner ring offset appended when it isn't at zero.
 */
export function dialLabel(r: { grinderMacro: number; grinderMicro: number }): string {
  const whole = Math.floor((r.grinderMacro - 1) / OPUS.clicksPerNumber) + 1;
  const sub = (r.grinderMacro - 1) % OPUS.clicksPerNumber;
  const outer = sub ? `dial ${whole} +${sub}` : `dial ${whole}`;
  return r.grinderMicro ? `${outer}, ${ringLabel(r.grinderMicro)}` : outer;
}

/** The ring by its physical marking: toward "−" is finer, toward "+" coarser. */
export function ringLabel(micro: number): string {
  if (!micro) return "ring 0";
  return micro > 0 ? `ring −${micro}` : `ring +${-micro}`;
}

/** Clamp a pair to what the two dials can physically hold. */
export function clampGrind(r: { grinderMacro: number; grinderMicro: number }) {
  return {
    grinderMacro: Math.min(OPUS.clicksTotal, Math.max(1, Math.round(r.grinderMacro))),
    grinderMicro: Math.min(
      OPUS.ringTravel,
      Math.max(-OPUS.ringTravel, Math.round(r.grinderMicro))
    ),
  };
}

/** The knowledge block injected into Claude prompts. Plain, factual, sourced. */
export const GEAR_BRIEF = `THE BARISTA'S GEAR (ground truth — never contradict this):

GRINDER — Fellow Opus (conical burr). The geometry below matches the Beanie
app (the Opus-specific grind-size companion) — use its numbers exactly:
- Outer dial: 41 detents ("clicks") spanning the PRINTED numbers 1 to 11, so
  each printed number is 4 clicks apart with 3 unnumbered sub-click detents
  between each pair. One click ≈ 50 µm. grinderMacro is the CLICK (1–41), not
  the printed number: click 1 = printed 1, click 5 = printed 2, click 41 =
  printed 11. Never assume "macro 2" means the printed 2 — it is click 2, i.e.
  one sub-click past the printed 1.
- Inner ring: an OFFSET from that click, 3 micro-ticks per click (⅓ click,
  ~16.7 µm each), turning up to a full click either way — grinderMicro is
  -3..+3, POSITIVE toward the "−" mark (finer), NEGATIVE toward "+" (coarser).
  This ring is the real dial-in tool for espresso.
- THE TWO DIALS ARE INDEPENDENT. Turning the ring does NOT move the outer dial,
  and clicking the dial does NOT move the ring — the barista reads both off the
  machine. So never "tidy up" a setting by folding ring travel onto the outer
  dial: click 5 with ring −3 and click 4 with ring 0 are the same burr gap, but
  they are different dial positions, and you must leave the one you were given
  alone unless you are deliberately moving it. Change grinderMacro only when
  you mean the barista to click the outer dial.
- UNIFIED GRIND SIZE (Beanie's single number, on the printed-number scale):
  one click = 0.25, one micro-tick = 1/12 ≈ 0.083, and microns ≈ 200 µm per
  unified point. Example: outer dial one sub-click past 1 with the ring one
  tick toward "+" = 1.33 ≈ 266 µm.
- Espresso lives at the VERY fine end: unified 1.0–2.5 (≈200–500 µm), i.e.
  clicks 1–7. That whole window is only ~6 clicks wide, so small moves matter —
  prefer one micro-tick (~17 µm) before a whole click (~50 µm). Typical Opus
  espresso lands near unified 1.2–1.6. For reference, pour over is unified
  3–8.5 and French press 6–11 — nowhere near where you should be.
- DIRECTION on the physical dials:
  · Outer dial: LOWER = finer, higher = coarser.
  · Inner micro-ring: turn toward the "−" mark for FINER (tighter burrs);
    toward "+" for COARSER (wider burrs). ALWAYS refer to the ring by its
    physical marking (− / +), never as "add micro" or "+1 micro".
- Express a grind position the way Beanie does — the unified size, then where
  the two dials physically sit: "1.25 · dial 1 +1" is click 2 (one sub-click
  past the printed 1) with the ring at zero; "1.17 · dial 1 +1, ring −1" is the
  same click with the ring one tick toward −; "1.33 · dial 1 +1, ring +1" is
  that click with the ring one tick toward +. Do NOT prefix with "Opus" — the
  app already labels the grinder.
- PRECISION: state every grind change as a DIRECTION + MAGNITUDE — e.g. "1 micro-tick
  finer, rotate the inner ring one tick toward − (⅓ click, ~17 µm)" or
  "1 full click coarser, outer dial one sub-click along (~50 µm)". Near the target,
  move a single micro-tick at a time; never say "a bit finer/coarser" without the
  number and the physical direction.
- HOW TO MAKE A SMALL MOVE: reach for the ring first, and leave the outer dial
  alone. From click 2 with the ring at zero (1.25), one tick coarser is simply
  the ring one tick toward + (ring +1, 1.33) — the outer dial stays on click 2.
  One tick finer is the ring one tick toward − (ring −1, 1.17). Only when the
  ring has run out of travel (±3) do you click the outer dial, and then you
  back the ring off by 3 to keep the net move small: from click 2 · ring −3,
  one more tick finer is click 1 · ring −1. When both dials move, spell out
  BOTH steps in order, and let the unified number confirm the net direction
  (coarser = larger unified size). NEVER describe a coarser move as "rotate the
  ring toward −": on its own "toward −" always means finer.

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

/**
 * Resulting burr gap in micro-ticks (higher = coarser) — the outer click worth
 * 3, the ring worth 1 each. Used to compare two settings and size the move
 * between them. It is NOT a position the dials get set from: several dial
 * pairs give the same gap, and which pair you're at is the barista's business,
 * not ours to rewrite.
 */
export function ticksTotal(r: { grinderMacro: number; grinderMicro: number }): number {
  return r.grinderMacro * OPUS.microPerClick - r.grinderMicro;
}

/**
 * One tick finer, moving the ring by preference and only clicking the outer
 * dial once the ring has run out of travel — which is how you'd do it by hand.
 * `floor` bounds the outer dial (the espresso window, not the grinder's).
 */
export function stepFiner<T extends { grinderMacro: number; grinderMicro: number }>(
  r: T,
  floor = 1
): T {
  if (r.grinderMicro < OPUS.ringTravel) return { ...r, grinderMicro: r.grinderMicro + 1 };
  if (r.grinderMacro > floor)
    return {
      ...r,
      grinderMacro: r.grinderMacro - 1,
      grinderMicro: r.grinderMicro + 1 - OPUS.microPerClick,
    };
  return r; // as fine as this range goes
}

/** One tick coarser — the mirror of `stepFiner`. */
export function stepCoarser<T extends { grinderMacro: number; grinderMicro: number }>(
  r: T,
  ceiling = OPUS.clicksTotal
): T {
  if (r.grinderMicro > -OPUS.ringTravel) return { ...r, grinderMicro: r.grinderMicro - 1 };
  if (r.grinderMacro < ceiling)
    return {
      ...r,
      grinderMacro: r.grinderMacro + 1,
      grinderMicro: r.grinderMicro - 1 + OPUS.microPerClick,
    };
  return r;
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
  const outerFrom = dialLabel({ grinderMacro: from.grinderMacro, grinderMicro: 0 });
  const outerTo = dialLabel({ grinderMacro: to.grinderMacro, grinderMicro: 0 });
  if (dMacro > 0) {
    parts.push(
      `click the outer dial ${dMacro} detent${dMacro > 1 ? "s" : ""} coarser (${outerFrom} → ${outerTo})`
    );
  } else if (dMacro < 0) {
    parts.push(
      `click the outer dial ${-dMacro} detent${-dMacro > 1 ? "s" : ""} finer (${outerFrom} → ${outerTo})`
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
  const d = Math.abs(ticksTotal(to) - ticksTotal(from));
  if (d === 0) return "a hair";
  const clicks = Math.floor(d / 3);
  const micros = d % 3;
  const parts: string[] = [];
  if (clicks) parts.push(`${clicks} click${clicks > 1 ? "s" : ""}`);
  if (micros) parts.push(`${micros} micro-tick${micros > 1 ? "s" : ""}`);
  return `${parts.join(" + ")} (~${Math.round(d * OPUS.micronsPerMicro)} µm)`;
}

/**
 * Compact readout in Beanie's terms: the unified grind size first (the number
 * you compare between coffees), then where the two dials physically sit —
 * "1.25 · dial 1 +1" or "1.17 · dial 1 +1, ring −1".
 */
export function formatGrind(r: { grinderMacro: number; grinderMicro: number }): string {
  return `${unifiedLabel(r)} · ${dialLabel(r)}`;
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
    // under-extracted → finer, one ring tick where the ring still has travel
    Object.assign(next, stepFiner(next, OPUS.espressoClickLow));
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
    // over-extracted → coarser, one ring tick where the ring still has travel
    Object.assign(next, stepCoarser(next, OPUS.espressoClickHigh));
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
