import type { FlavorProfile } from "../lib/types";

export interface Axis {
  key: keyof Omit<
    FlavorProfile,
    "verdict" | "note" | "descriptors" | "aroma" | "faults"
  >;
  name: string;
  low: string;
  high: string;
  /** barista benchmark hint shown as the pill value band */
  bands: [string, string, string]; // low / mid / high descriptor
  /** How a competition judge assesses this — shown in the guided tasting. */
  blurb: string;
  /** A concrete "how to taste it" cue for the guided step. */
  cue: string;
}

// Benchmarks drawn from SCA sensory language + espresso dial-in practice.
export const AXES: Axis[] = [
  {
    key: "acidity",
    name: "Acidity",
    low: "Flat",
    high: "Sharp / sour",
    bands: ["flat", "bright", "sour"],
    blurb:
      "The bright, tingling liveliness on the front and sides of your tongue. Judges prize a sweet, structured acidity — like citrus or apple — and mark down sharp, sour, vinegary bite (a sign of under-extraction).",
    cue: "Notice the first sparkle as it hits your tongue. Lively and sweet, or flat — or sharp and puckering?",
  },
  {
    key: "sweetness",
    name: "Sweetness",
    low: "None",
    high: "Syrupy sweet",
    bands: ["thin", "pleasant", "lush"],
    blurb:
      "Perceived sugar and roundness — caramel, honey, ripe fruit. In competition, sweetness signals a well-developed, evenly extracted shot; its absence reads as thin or savoury.",
    cue: "Let it sit on your tongue. Does it feel sugary and round, or dry and hollow?",
  },
  {
    key: "bitterness",
    name: "Bitterness",
    low: "None",
    high: "Harsh",
    bands: ["soft", "cocoa", "harsh"],
    blurb:
      "A little bitterness (dark chocolate, cocoa) is pleasant and expected in espresso. Judges penalise harsh, dry, ashy bitterness — usually over-extraction or too dark a roast.",
    cue: "At the back of the tongue: gentle cocoa, or harsh and drying like burnt toast?",
  },
  {
    key: "body",
    name: "Body",
    low: "Watery",
    high: "Thick",
    bands: ["light", "round", "heavy"],
    blurb:
      "The tactile weight and texture — the mouthfeel. Judges describe it from tea-like and silky to syrupy and creamy. Neither extreme is 'better'; it should suit the coffee.",
    cue: "Roll it around your mouth. Watery and light, silky, or thick and coating?",
  },
  {
    key: "aftertaste",
    name: "Aftertaste",
    low: "Short",
    high: "Long",
    bands: ["quick", "lingering", "very long"],
    blurb:
      "The finish — how the flavour lingers after you swallow. A long, pleasant, evolving aftertaste scores high; a short or unpleasant one (dry, ashy, sour) scores low.",
    cue: "Swallow, then wait. Does something sweet linger, or does it vanish — or turn harsh?",
  },
  {
    key: "balance",
    name: "Balance",
    low: "Disjointed",
    high: "Harmonious",
    bands: ["rough", "settled", "harmonious"],
    blurb:
      "How the acidity, sweetness, bitterness and body fit together. A balanced shot feels harmonious — nothing spikes or is missing. This is often the judge's overall read of quality.",
    cue: "Step back: does it feel like one harmonious whole, or is one thing shouting over the rest?",
  },
];

/** Flavor-wheel descriptor groups (SCA / WCR Coffee Taster's Flavor Wheel). */
export const FLAVOR_GROUPS: { group: string; items: string[] }[] = [
  { group: "Fruity", items: ["berry", "stone fruit", "citrus", "tropical", "apple/pear", "dried fruit"] },
  { group: "Floral", items: ["jasmine", "rose", "chamomile", "black tea"] },
  { group: "Sweet", items: ["caramel", "honey", "brown sugar", "vanilla", "molasses"] },
  { group: "Chocolate / Nutty", items: ["dark chocolate", "cocoa", "hazelnut", "almond", "malt"] },
  { group: "Spice", items: ["cinnamon", "clove", "pepper"] },
  { group: "Roasty / Other", items: ["toasty", "smoky", "winey", "boozy", "savoury", "earthy"] },
];

function band(a: Axis, v: number): string {
  return v < 34 ? a.bands[0] : v < 67 ? a.bands[1] : a.bands[2];
}

export const EMPTY_FLAVOR: FlavorProfile = {
  acidity: 50,
  sweetness: 50,
  bitterness: 40,
  body: 50,
  aftertaste: 50,
  balance: 50,
  verdict: null,
  note: "",
};

export function FlavorSliders({
  value,
  onChange,
}: {
  value: FlavorProfile;
  onChange: (v: FlavorProfile) => void;
}) {
  return (
    <div className="card card-pad">
      {AXES.map((a) => {
        const v = value[a.key];
        return (
          <div className="slider-row" key={a.key}>
            <div className="slider-head">
              <span className="slider-name">{a.name}</span>
              <span className="slider-val">{band(a, v)}</span>
            </div>
            <input
              type="range"
              className="slider"
              min={0}
              max={100}
              value={v}
              onChange={(e) => onChange({ ...value, [a.key]: Number(e.target.value) })}
            />
            <div className="slider-ends">
              <span>{a.low}</span>
              <span>{a.high}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Compact read-only fingerprint (mini bars) for saved shots. */
export function FlavorFingerprint({ f }: { f: FlavorProfile }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 34 }}>
      {AXES.map((a) => (
        <div key={a.key} style={{ flex: 1, textAlign: "center" }} title={a.name}>
          <div
            style={{
              height: Math.max(4, (f[a.key] / 100) * 30),
              background: "var(--clay)",
              borderRadius: 3,
              opacity: 0.35 + (f[a.key] / 100) * 0.55,
            }}
          />
        </div>
      ))}
    </div>
  );
}
