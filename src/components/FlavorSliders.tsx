import type { FlavorProfile } from "../lib/types";

interface Axis {
  key: keyof Omit<FlavorProfile, "verdict" | "note">;
  name: string;
  low: string;
  high: string;
  /** barista benchmark hint shown as the pill value band */
  bands: [string, string, string]; // low / mid / high descriptor
}

// Benchmarks drawn from SCA sensory language + espresso dial-in practice.
export const AXES: Axis[] = [
  {
    key: "acidity",
    name: "Acidity",
    low: "Flat",
    high: "Sharp / sour",
    bands: ["flat", "bright", "sour"],
  },
  {
    key: "sweetness",
    name: "Sweetness",
    low: "None",
    high: "Syrupy sweet",
    bands: ["thin", "pleasant", "lush"],
  },
  {
    key: "bitterness",
    name: "Bitterness",
    low: "None",
    high: "Harsh",
    bands: ["soft", "cocoa", "harsh"],
  },
  {
    key: "body",
    name: "Body",
    low: "Watery",
    high: "Thick",
    bands: ["light", "round", "heavy"],
  },
  {
    key: "aftertaste",
    name: "Aftertaste",
    low: "Short",
    high: "Long",
    bands: ["quick", "lingering", "very long"],
  },
  {
    key: "balance",
    name: "Balance",
    low: "Disjointed",
    high: "Harmonious",
    bands: ["rough", "settled", "harmonious"],
  },
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
