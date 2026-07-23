import { allShots, listCoffees } from "./db";
import { formatGrind } from "./gear";
import { roastLabel } from "./roast";
import type { Coffee, Shot } from "./types";

const AXES = ["acidity", "sweetness", "bitterness", "body", "aftertaste", "balance"] as const;

function describeCoffee(c?: Coffee): string {
  if (!c) return "a coffee";
  return (
    [
      c.roastLevel && c.roastLevel !== "unknown" ? roastLabel(c.roastLevel).toLowerCase() : "",
      c.process,
      c.origin,
    ]
      .filter(Boolean)
      .join(" ") || c.name
  );
}

/**
 * Builds a personalised "what this barista tends to like" brief from their own
 * dialed-in history, so recommendations improve as they log more tastings.
 * Returns "" when there's not enough history yet. This is the learning loop:
 * loved shots + locked recipes become priors fed back into the prompts.
 */
export async function getPalateBrief(): Promise<string> {
  let coffees: Coffee[] = [];
  let shots: Shot[] = [];
  try {
    [coffees, shots] = await Promise.all([listCoffees(), allShots()]);
  } catch {
    return "";
  }

  const byId = new Map(coffees.map((c) => [c.id, c]));
  const loved = shots.filter((s) => s.flavor.verdict === "love");
  const locked = coffees.filter((c) => c.status === "locked" && c.lockedRecipe);

  if (loved.length === 0 && locked.length === 0) return "";

  const lines: string[] = [];
  lines.push(
    "WHAT THIS BARISTA TENDS TO LIKE — learned from their OWN dialed-in shots. Use it as a personal prior: bias the starting point and adjustments toward these tendencies, but always defer to this specific coffee's character and their live feedback."
  );

  // Average taste of shots they loved.
  if (loved.length > 0) {
    const mean = (k: (typeof AXES)[number]) =>
      Math.round(loved.reduce((s, sh) => s + (sh.flavor[k] as number), 0) / loved.length);
    const parts = AXES.map((k) => `${k} ${mean(k)}`).join(", ");
    lines.push(`- Preferred taste balance (avg of ${loved.length} shot(s) they loved, 0–100): ${parts}.`);
  }

  // Favourite flavour descriptors across loved shots + locked coffees.
  const counts = new Map<string, number>();
  const bump = (arr?: string[]) =>
    (arr || []).forEach((d) => counts.set(d, (counts.get(d) || 0) + 1));
  loved.forEach((s) => bump(s.flavor.descriptors));
  locked.forEach((c) => bump(c.tastingNotes));
  const favs = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([d]) => d);
  if (favs.length) lines.push(`- Flavours they gravitate to: ${favs.join(", ")}.`);

  // Concrete recipes that landed for them (strongest signal for grind/settings).
  const examples: string[] = [];
  const seen = new Set<string>();
  const pushEx = (recipe: Coffee["lockedRecipe"], c?: Coffee) => {
    if (!recipe || examples.length >= 6) return;
    const key = c?.id || Math.random().toString();
    if (seen.has(key)) return;
    seen.add(key);
    examples.push(
      `   • ${describeCoffee(c)} → ${formatGrind(recipe)}, ${recipe.dose}→${recipe.yieldG} g, ${recipe.timeSeconds} s`
    );
  };
  locked
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .forEach((c) => pushEx(c.lockedRecipe, c));
  loved.forEach((s) => pushEx(s.recipe, byId.get(s.coffeeId)));
  if (examples.length) {
    lines.push("- Recipes that landed for them (their gear, their taste):");
    lines.push(...examples);
  }

  lines.push(
    "If they consistently grind finer/coarser or run longer/shorter ratios than baseline, START there rather than at the generic baseline."
  );
  return lines.join("\n");
}

/** Quick client-side signal used for UI copy: has the user taught Bruna anything yet? */
export function lovedCount(shots: Shot[]): number {
  return shots.filter((s) => s.flavor.verdict === "love").length;
}

export interface LearningStats {
  tastings: number; // shots rated with a verdict
  loved: number; // shots verdict === "love"
  coffees: number;
}

/** Counts that power the "Bruna is learning your taste" indicator. */
export async function getLearningStats(): Promise<LearningStats> {
  try {
    const [coffees, shots] = await Promise.all([listCoffees(), allShots()]);
    return {
      tastings: shots.filter((s) => s.flavor.verdict !== null).length,
      loved: lovedCount(shots),
      coffees: coffees.length,
    };
  } catch {
    return { tastings: 0, loved: 0, coffees: 0 };
  }
}
