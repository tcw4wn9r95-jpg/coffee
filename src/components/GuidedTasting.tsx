import { useMemo, useState } from "react";
import type { Coffee, FlavorProfile } from "../lib/types";
import { AXES, EMPTY_FLAVOR, FLAVOR_GROUPS } from "./FlavorSliders";
import { BackIcon, HeartIcon } from "./Icons";

type StepKind = "intro" | "aroma" | "axis" | "descriptors" | "verdict";
interface Step {
  kind: StepKind;
  axisIndex?: number;
}

const STEPS: Step[] = [
  { kind: "intro" },
  { kind: "aroma" },
  ...AXES.map((_, i) => ({ kind: "axis" as const, axisIndex: i })),
  { kind: "descriptors" },
  { kind: "verdict" },
];

function band(v: number, low: string, mid: string, high: string) {
  return v < 34 ? low : v < 67 ? mid : high;
}

export function GuidedTasting({
  coffee,
  onCancel,
  onComplete,
}: {
  coffee: Coffee;
  onCancel: () => void;
  onComplete: (flavor: FlavorProfile) => void;
}) {
  const [i, setI] = useState(0);
  const [flavor, setFlavor] = useState<FlavorProfile>({ ...EMPTY_FLAVOR });
  const [aroma, setAroma] = useState("");
  const [descriptors, setDescriptors] = useState<string[]>([]);

  const step = STEPS[i];
  // real "tasting steps" for the progress bar (skip the intro screen)
  const totalRated = STEPS.length - 1;
  const progress = Math.max(0, i) / (STEPS.length - 1);

  const toggle = (d: string) =>
    setDescriptors((cur) =>
      cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]
    );

  function finish(verdict: FlavorProfile["verdict"]) {
    onComplete({
      ...flavor,
      verdict,
      aroma: aroma.trim() || undefined,
      descriptors,
      note: [aroma.trim(), descriptors.join(", ")].filter(Boolean).join(" — ") || undefined,
    });
  }

  const next = () => setI((n) => Math.min(STEPS.length - 1, n + 1));
  const back = () => (i === 0 ? onCancel() : setI((n) => n - 1));

  const heading = useMemo(() => {
    if (step.kind === "intro") return "Guided tasting";
    if (step.kind === "aroma") return "First, the aroma";
    if (step.kind === "axis") return AXES[step.axisIndex!].name;
    if (step.kind === "descriptors") return "Name the flavours";
    return "Your verdict";
  }, [step]);

  return (
    <div className="gt-overlay">
      <div className="gt-head">
        <button className="link-btn row" onClick={back}>
          <BackIcon size={18} /> {i === 0 ? "Close" : "Back"}
        </button>
        <span className="gt-count">
          {step.kind === "intro" ? "Ready" : `${i} / ${totalRated}`}
        </span>
      </div>
      <div className="gt-progress">
        <span style={{ width: `${progress * 100}%` }} />
      </div>

      <div className="gt-body" key={i}>
        <div className="eyebrow">
          {coffee.name}
        </div>
        <h1 className="gt-title">{heading}</h1>

        {step.kind === "intro" && (
          <div className="stack" style={{ marginTop: 8 }}>
            <p className="lede" style={{ marginTop: 0 }}>
              We'll taste this shot the way a competition judge does — one
              sense at a time. Take small sips, let the espresso coat your whole
              tongue, and breathe out through your nose to catch the aromatics.
            </p>
            <div className="callout">
              <strong>How the pros do it.</strong> Judges evaluate a shot across
              distinct attributes — aroma, acidity, sweetness, bitterness, body,
              aftertaste and balance — scoring each on its own before forming an
              overall impression. Bruna walks you through the same ritual, then
              learns what <em>you</em> like.
            </div>
            <p className="muted" style={{ fontSize: 13.5 }}>
              Have the shot ready. Ideally taste it just below piping hot — flavours
              open up as it cools slightly.
            </p>
            <button className="btn btn-primary btn-block btn-lg" onClick={next}>
              Begin tasting
            </button>
          </div>
        )}

        {step.kind === "aroma" && (
          <div className="stack" style={{ marginTop: 8 }}>
            <p className="lede" style={{ marginTop: 0 }}>
              Before you sip, bring the cup to your nose. What do you smell? First
              impressions are best — florals, fruit, chocolate, nuts, spice, roast.
            </p>
            <div className="gt-cue">
              Swirl gently and inhale. Note the strongest one or two aromas.
            </div>
            <label className="field" style={{ marginTop: 4 }}>
              <span className="field-label">Aroma (optional)</span>
              <input
                className="input"
                placeholder="e.g. jasmine and ripe peach"
                value={aroma}
                onChange={(e) => setAroma(e.target.value)}
              />
            </label>
            <button className="btn btn-primary btn-block btn-lg" onClick={next}>
              Now take a sip
            </button>
          </div>
        )}

        {step.kind === "axis" && (() => {
          const a = AXES[step.axisIndex!];
          const v = flavor[a.key];
          return (
            <div className="stack" style={{ marginTop: 8 }}>
              <p className="gt-blurb">{a.blurb}</p>
              <div className="gt-cue">{a.cue}</div>
              <div className="gt-axis">
                <div className="gt-axis-val">{band(v, a.bands[0], a.bands[1], a.bands[2])}</div>
                <input
                  type="range"
                  className="slider"
                  min={0}
                  max={100}
                  value={v}
                  onChange={(e) => setFlavor({ ...flavor, [a.key]: Number(e.target.value) })}
                />
                <div className="slider-ends">
                  <span>{a.low}</span>
                  <span>{a.high}</span>
                </div>
              </div>
              <button className="btn btn-primary btn-block btn-lg" onClick={next}>
                Next
              </button>
            </div>
          );
        })()}

        {step.kind === "descriptors" && (
          <div className="stack" style={{ marginTop: 8 }}>
            <p className="lede" style={{ marginTop: 0 }}>
              Pin down the specific flavours you taste — tap all that apply. These
              become this coffee's tasting notes and help Bruna learn your palate.
            </p>
            {FLAVOR_GROUPS.map((g) => (
              <div key={g.group}>
                <div className="field-label" style={{ marginBottom: 6 }}>{g.group}</div>
                <div className="chips" style={{ marginTop: 0 }}>
                  {g.items.map((it) => (
                    <button
                      key={it}
                      className={`chip ${descriptors.includes(it) ? "on" : ""}`}
                      onClick={() => toggle(it)}
                    >
                      {it}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button className="btn btn-primary btn-block btn-lg" onClick={next}>
              {descriptors.length ? `Next · ${descriptors.length} chosen` : "Skip for now"}
            </button>
          </div>
        )}

        {step.kind === "verdict" && (
          <div className="stack" style={{ marginTop: 8 }}>
            <p className="lede" style={{ marginTop: 0 }}>
              All things considered — would you happily drink this shot again?
              Your honest verdict is what teaches Bruna your taste.
            </p>
            <TasteRecap flavor={flavor} descriptors={descriptors} />
            <div className="stack" style={{ marginTop: 6 }}>
              <button className="btn btn-primary btn-block btn-lg" onClick={() => finish("love")}>
                <HeartIcon size={18} /> I love it — this is the one
              </button>
              <button className="btn btn-ghost btn-block" onClick={() => finish("close")}>
                Close — nearly there
              </button>
              <button className="btn btn-ghost btn-block" onClick={() => finish("off")}>
                Off — needs work
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TasteRecap({ flavor, descriptors }: { flavor: FlavorProfile; descriptors: string[] }) {
  return (
    <div className="card card-pad">
      <div className="field-label" style={{ marginBottom: 10 }}>Your tasting</div>
      {AXES.map((a) => (
        <div className="gt-recap-row" key={a.key}>
          <span>{a.name}</span>
          <span className="gt-recap-bar">
            <span style={{ width: `${flavor[a.key]}%` }} />
          </span>
        </div>
      ))}
      {descriptors.length > 0 && (
        <div className="chips" style={{ marginTop: 12 }}>
          {descriptors.map((d) => (
            <span className="chip on" key={d} style={{ cursor: "default" }}>{d}</span>
          ))}
        </div>
      )}
    </div>
  );
}
