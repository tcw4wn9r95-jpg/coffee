export type RoastLevel =
  | "light"
  | "light-medium"
  | "medium"
  | "medium-dark"
  | "dark"
  | "unknown";

/** A full espresso recipe for the user's gear. */
export interface Recipe {
  /**
   * Fellow Opus outer-dial CLICK, 1–41 — not the number printed on the dial.
   * The 41 clicks span the printed 1…11, so 4 clicks per printed number
   * (click 1 = printed 1, click 5 = printed 2). Espresso is clicks 1–7.
   * See `unifiedGrind()` in lib/gear for the Beanie-app equivalent.
   */
  grinderMacro: number;
  /** Fellow Opus inner-ring ticks toward the "−" mark (0–2); 3 ticks = 1 click. */
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
  origin?: string; // country
  region?: string; // region / locality / washing station area
  producer?: string; // farm / producer / co-op / washing station
  variety?: string; // cultivar(s), e.g. "Heirloom", "Bourbon, Caturra", "Geisha"
  species?: string; // Arabica / Robusta / blend
  process?: string; // washed / natural / honey / anaerobic ...
  altitude?: string; // e.g. "1,900–2,100 masl"
  harvest?: string; // harvest year / season
  roastLevel?: RoastLevel;
  roastDate?: string; // if printed on the bag
  tastingNotes?: string[];
  decaf?: boolean;
  /** Optional roaster website URL — Claude fetches it for deeper brewing guidance. */
  website?: string;
  /** Summary of what the roaster says (intended flavour + any brew guidance). */
  roasterGuidance?: string;
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
  /** Specific faults reported when a shot is off/close, e.g. "Too bitter". */
  faults?: string[];
  /** Flavor-wheel descriptors chosen during a guided tasting. */
  descriptors?: string[];
  /** Free-text aroma impression captured at the start of a guided tasting. */
  aroma?: string;
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
  /** When source === "local", why Claude wasn't used (missing key, error, etc.). */
  fallbackReason?: string;
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
