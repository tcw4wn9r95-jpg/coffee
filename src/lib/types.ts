export type RoastLevel =
  | "light"
  | "light-medium"
  | "medium"
  | "medium-dark"
  | "dark"
  | "unknown";

/** A full espresso recipe for the user's gear. */
export interface Recipe {
  /** Fellow Opus macro click (outer dial), typically 1–4 for espresso. */
  grinderMacro: number;
  /** Fellow Opus inner micro-ring ticks (0–2), 3 micro = 1 macro. */
  grinderMicro: number;
  dose: number; // grams in
  yieldG: number; // grams out
  ratio: string; // e.g. "1:2"
  timeSeconds: number; // target shot time (first drops → cup)
  tamp: string; // tamping cue
  temperature: string; // no-PID temp / warm-up guidance
  preInfusion: string; // manual / line pre-infusion guidance
  notes?: string;
}

export interface CoffeeIdentity {
  name: string;
  roaster?: string;
  origin?: string;
  process?: string; // washed / natural / honey ...
  roastLevel?: RoastLevel;
  tastingNotes?: string[];
}

export interface Coffee extends CoffeeIdentity {
  id: string;
  photoId?: string;
  createdAt: number;
  updatedAt: number;
  status: "dialing" | "locked";
  lockedRecipe?: Recipe;
  lockedShotId?: string;
}

/** The six SCA-anchored flavor axes (0–100), plus a verdict. */
export interface FlavorProfile {
  acidity: number;
  sweetness: number;
  bitterness: number;
  body: number;
  aftertaste: number;
  balance: number;
  verdict: "love" | "close" | "off" | null;
  note?: string;
}

export interface ShotActuals {
  dose?: number;
  yieldG?: number;
  timeSeconds?: number;
  observations?: string; // "gusher", "choked", "channeling", "blonde early"...
}

export interface AdjustmentChange {
  field: string; // human label, e.g. "Grind"
  from: string;
  to: string;
  why: string;
}

export interface Advice {
  onTarget: boolean; // true → this shot is essentially dialed
  summary: string;
  diagnosis: string;
  changes: AdjustmentChange[];
  nextRecipe: Recipe;
  predictedEffect: string;
  source: "claude" | "local";
}

export interface Shot {
  id: string;
  coffeeId: string;
  createdAt: number;
  recipe: Recipe; // settings used for this pull
  actual: ShotActuals;
  flavor: FlavorProfile;
  advice?: Advice; // guidance generated after this shot
}

export interface AppSettings {
  apiKey: string;
  model: string;
  gear: GearConfig;
  onboarded: boolean;
}

export interface GearConfig {
  grinder: string;
  machine: string;
  portafilter: string;
  basketMin: number;
  basketMax: number;
}
