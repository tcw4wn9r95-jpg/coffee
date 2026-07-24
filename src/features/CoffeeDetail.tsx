import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  deleteCoffee,
  getCoffee,
  listShots,
  putCoffee,
  putShot,
  uid,
} from "../lib/db";
import { suggestAdjustment } from "../lib/anthropic";
import { baselineRecipe, formatGrind } from "../lib/gear";
import { roastLabel } from "../lib/roast";
import type { Advice, Coffee, FlavorProfile, Recipe, Shot } from "../lib/types";
import { RecipeView } from "../components/RecipeView";
import { RecipeEditor } from "../components/RecipeEditor";
import { PhotoThumb } from "../components/PhotoThumb";
import {
  AXES,
  EMPTY_FLAVOR,
  FlavorFingerprint,
  FlavorSliders,
} from "../components/FlavorSliders";
import { BackIcon, CheckIcon, HeartIcon, SparkIcon } from "../components/Icons";
import { GuidedTasting } from "../components/GuidedTasting";
import { useToast } from "../components/Toast";

type Phase = "ready" | "logging" | "result";

export function CoffeeDetail() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const toast = useToast();

  const [coffee, setCoffee] = useState<Coffee | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [c, s] = await Promise.all([getCoffee(id), listShots(id)]);
    if (!c) {
      nav("/", { replace: true });
      return;
    }
    setCoffee(c);
    setShots(s);
    setLoading(false);
  }, [id, nav]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (loading || !coffee) {
    return (
      <div className="screen">
        <div className="empty" style={{ paddingTop: 120 }}>
          <span className="spinner spinner-clay" />
        </div>
      </div>
    );
  }

  const completed = shots.filter((s) => s.flavor.verdict !== null);
  const open = shots.find((s) => s.flavor.verdict === null) ?? null;

  return (
    <div className="screen">
      <button className="link-btn row" onClick={() => nav("/")}>
        <BackIcon size={18} /> Shelf
      </button>

      <div className="row" style={{ marginTop: 16, gap: 16, alignItems: "flex-start" }}>
        <PhotoThumb photoId={coffee.photoId} className="thumb" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row-between">
            <h1 style={{ fontSize: 24 }}>{coffee.name}</h1>
            <span className={`badge ${coffee.status === "locked" ? "badge-locked" : "badge-dialing"}`}>
              {coffee.status === "locked" ? "Dialed" : "Dialing"}
            </span>
          </div>
          <p className="coffee-sub">
            {[coffee.roaster, coffee.origin, coffee.process].filter(Boolean).join(" · ") ||
              "espresso"}
          </p>
        </div>
      </div>

      {coffee.tastingNotes && coffee.tastingNotes.length > 0 && (
        <div className="chips">
          {coffee.tastingNotes.map((n) => (
            <span className="chip" key={n} style={{ cursor: "default" }}>{n}</span>
          ))}
        </div>
      )}

      <Provenance coffee={coffee} />

      {coffee.status === "locked" && coffee.lockedRecipe && (
        <LockedRecipe coffee={coffee} onRedial={() => redial(coffee, setCoffee, refresh, toast)} />
      )}

      <div className="divider" />

      {open ? (
        <DialInRound
          key={open.id}
          coffee={coffee}
          openShot={open}
          history={completed}
          onChanged={refresh}
        />
      ) : (
        <div className="stack">
          <p className="muted">Ready for another round?</p>
          <button
            className="btn btn-primary btn-block"
            onClick={() => startRound(coffee, setCoffee, refresh, toast)}
          >
            <SparkIcon size={18} /> Pull another shot
          </button>
        </div>
      )}

      {completed.length > 0 && <History shots={completed} />}

      <div className="divider" />
      <button
        className="link-btn"
        style={{ color: "var(--ink-faint)" }}
        onClick={async () => {
          if (confirm(`Delete "${coffee.name}" and its shot history?`)) {
            await deleteCoffee(coffee.id);
            toast("Deleted");
            nav("/", { replace: true });
          }
        }}
      >
        Delete this coffee
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
async function startRound(
  coffee: Coffee,
  _setCoffee: (c: Coffee) => void,
  refresh: () => Promise<void>,
  _toast: (m: string) => void
) {
  const recipe = coffee.lockedRecipe ?? baselineRecipe();
  await putShot({
    id: uid(),
    coffeeId: coffee.id,
    createdAt: Date.now(),
    recipe,
    actual: {},
    flavor: { ...EMPTY_FLAVOR },
  });
  await refresh();
}

async function redial(
  coffee: Coffee,
  setCoffee: (c: Coffee) => void,
  refresh: () => Promise<void>,
  toast: (m: string) => void
) {
  const updated: Coffee = { ...coffee, status: "dialing" };
  await putCoffee(updated);
  setCoffee(updated);
  await startRound(updated, setCoffee, refresh, toast);
  toast("New dial-in started");
}

/** Common espresso faults, offered as chips when a shot is off/close. */
const FAULTS = [
  "Too sour / sharp",
  "Too bitter",
  "Too weak / watery",
  "Too harsh / dry",
  "Not sweet enough",
  "Flat / dull",
  "Too strong / intense",
  "Muddy / muddled",
  "Ashy / burnt",
  "Channeled / sprayed",
];

// ---------------------------------------------------------------------------
function Provenance({ coffee }: { coffee: Coffee }) {
  const items: { label: string; value?: string; wide?: boolean }[] = [
    { label: "Origin", value: coffee.origin },
    { label: "Region", value: coffee.region },
    { label: "Producer", value: coffee.producer, wide: true },
    { label: "Variety", value: coffee.variety, wide: true },
    { label: "Process", value: coffee.process },
    { label: "Altitude", value: coffee.altitude },
    {
      label: "Roast",
      value:
        coffee.roastLevel && coffee.roastLevel !== "unknown"
          ? roastLabel(coffee.roastLevel)
          : undefined,
    },
    { label: "Harvest", value: coffee.harvest },
    { label: "Species", value: coffee.species },
    { label: "Roasted", value: coffee.roastDate },
  ].filter((i) => i.value);

  const hostname = (() => {
    try {
      return coffee.website ? new URL(coffee.website).hostname.replace(/^www\./, "") : "";
    } catch {
      return "";
    }
  })();

  if (items.length === 0 && !coffee.website && !coffee.roasterGuidance && !coffee.decaf)
    return null;

  return (
    <section style={{ marginTop: 20 }}>
      <div className="eyebrow">Provenance</div>
      {items.length > 0 && (
        <div className="prov">
          {items.map((i) => (
            <div className={`prov-item ${i.wide ? "wide" : ""}`} key={i.label}>
              <div className="prov-label">{i.label}</div>
              <div className="prov-value">{i.value}</div>
            </div>
          ))}
        </div>
      )}
      {coffee.roasterGuidance && (
        <div className="callout" style={{ marginTop: 14 }}>
          <strong>From the roaster.</strong> {coffee.roasterGuidance}
        </div>
      )}
      <div className="row" style={{ marginTop: 12, gap: 10, flexWrap: "wrap" }}>
        {coffee.website && (
          <a
            className="badge badge-dialing"
            href={coffee.website}
            target="_blank"
            rel="noreferrer"
            style={{ textDecoration: "none" }}
          >
            {hostname || "Roaster page"} ↗
          </a>
        )}
        {coffee.decaf && <span className="badge badge-dialing">Decaf</span>}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
function LockedRecipe({ coffee, onRedial }: { coffee: Coffee; onRedial: () => void }) {
  const r = coffee.lockedRecipe!;
  return (
    <div className="card card-pad" style={{ marginTop: 18, borderColor: "var(--sage)" }}>
      <div className="row-between">
        <div className="row" style={{ gap: 8, color: "var(--sage)" }}>
          <HeartIcon size={18} />
          <strong style={{ fontFamily: "var(--serif)", fontSize: 18 }}>Your recipe</strong>
        </div>
        <button className="link-btn" onClick={onRedial}>Dial in again</button>
      </div>
      <p className="muted" style={{ fontSize: 13, margin: "4px 0 14px" }}>
        The settings you loved — {formatGrind(r)}, {r.dose}→{r.yieldG} g in {r.timeSeconds}s.
      </p>
      <RecipeView r={r} />
    </div>
  );
}

// ---------------------------------------------------------------------------
function DialInRound({
  coffee,
  openShot,
  history,
  onChanged,
}: {
  coffee: Coffee;
  openShot: Shot;
  history: Shot[];
  onChanged: () => Promise<void>;
}) {
  const toast = useToast();
  const [phase, setPhase] = useState<Phase>("ready");
  const [editing, setEditing] = useState(false);
  const [recipe, setRecipe] = useState<Recipe>(openShot.recipe);
  const [actual, setActual] = useState({
    yieldG: openShot.recipe.yieldG,
    timeSeconds: openShot.recipe.timeSeconds,
    observations: "",
  });
  const [flavor, setFlavor] = useState<FlavorProfile>({ ...EMPTY_FLAVOR });
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [busy, setBusy] = useState(false);
  const [guided, setGuided] = useState(false);
  const [pendingVerdict, setPendingVerdict] = useState<"off" | "close" | null>(
    null,
  );
  const [faults, setFaults] = useState<string[]>([]);

  const roundNo = history.length + 1;

  async function saveRecipeEdit(next: Recipe) {
    setRecipe(next);
    await putShot({ ...openShot, recipe: next });
  }

  /** Save the rated shot, fold learnings back into the coffee, then get advice. */
  async function finalize(finalFlavor: FlavorProfile) {
    setFlavor(finalFlavor);
    const shot: Shot = { ...openShot, recipe, actual, flavor: finalFlavor };
    await putShot(shot);
    // Learning loop: guided-tasting descriptors become the coffee's tasting notes.
    if (finalFlavor.descriptors?.length) {
      const merged = Array.from(
        new Set([...(coffee.tastingNotes || []), ...finalFlavor.descriptors])
      );
      await putCoffee({ ...coffee, tastingNotes: merged });
    }
    setBusy(true);
    try {
      const a = await suggestAdjustment(coffee, history, shot);
      shot.advice = a;
      await putShot(shot);
      setAdvice(a);
      setPhase("result");
    } finally {
      // Intentionally do NOT refresh the parent here: refreshing would drop
      // this shot from "open" (it now has a verdict) and unmount the round
      // before the advice is shown. The parent refreshes on apply / lock.
      setBusy(false);
    }
  }

  async function applyAndContinue() {
    if (!advice) return;
    await putShot({
      id: uid(),
      coffeeId: coffee.id,
      createdAt: Date.now(),
      recipe: advice.nextRecipe,
      actual: {},
      flavor: { ...EMPTY_FLAVOR },
    });
    await onChanged();
  }

  async function lockIn() {
    const updated: Coffee = {
      ...coffee,
      status: "locked",
      lockedRecipe: recipe,
      lockedShotId: openShot.id,
    };
    await putCoffee(updated);
    toast("Recipe locked in 🎉");
    await onChanged();
  }

  // ----- READY: show the recipe to pull -----
  if (phase === "ready") {
    return (
      <section>
        <div className="row-between">
          <div>
            <div className="eyebrow">Round {roundNo}</div>
            <h2 style={{ fontSize: 21, marginTop: 4 }}>Pull this shot</h2>
          </div>
          <button className="link-btn" onClick={() => setEditing((s) => !s)}>
            {editing ? "Done" : "Adjust"}
          </button>
        </div>
        <div style={{ marginTop: 14 }}>
          {editing ? (
            <RecipeEditor
              recipe={recipe}
              onChange={saveRecipeEdit}
              recommendedRatio={openShot.recipe.ratio}
            />
          ) : (
            <RecipeView r={recipe} />
          )}
        </div>
        <button
          className="btn btn-primary btn-block btn-lg"
          style={{ marginTop: 20 }}
          onClick={() => setPhase("logging")}
        >
          I pulled it — rate the taste
        </button>
      </section>
    );
  }

  // ----- LOGGING: actuals + sliders -----
  if (phase === "logging") {
    return (
      <>
        {guided && (
          <GuidedTasting
            coffee={coffee}
            onCancel={() => setGuided(false)}
            onComplete={(f) => {
              setGuided(false);
              finalize(f);
            }}
          />
        )}
        <section>
          <div className="eyebrow">Round {roundNo}</div>
          <h2 style={{ fontSize: 21, marginTop: 4 }}>How did it taste?</h2>
          <p className="muted" style={{ fontSize: 13.5, marginTop: 6 }}>
            First log what happened in the cup, then rate the taste — guided, or
            quick.
          </p>

          <div className="tasting-cta" onClick={() => setGuided(true)}>
            <div className="tasting-cta-icon">
              <SparkIcon size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <div className="tasting-cta-title">Start guided tasting</div>
              <div className="tasting-cta-sub">
                Taste like a competition judge — one step at a time. Bruna learns
                your palate.
              </div>
            </div>
            <span style={{ transform: "scaleX(-1)", display: "inline-flex", opacity: 0.6 }}>
              <BackIcon size={18} />
            </span>
          </div>

        <div className="card card-pad" style={{ marginTop: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label className="field" style={{ marginTop: 0 }}>
              <span className="field-label">Yield out (g)</span>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                value={actual.yieldG}
                onChange={(e) => setActual({ ...actual, yieldG: Number(e.target.value) })}
                style={{ textAlign: "center" }}
              />
            </label>
            <label className="field" style={{ marginTop: 0 }}>
              <span className="field-label">Shot time (s)</span>
              <input
                className="input"
                type="number"
                inputMode="numeric"
                value={actual.timeSeconds}
                onChange={(e) => setActual({ ...actual, timeSeconds: Number(e.target.value) })}
                style={{ textAlign: "center" }}
              />
            </label>
          </div>
          <label className="field">
            <span className="field-label">What did you see? (optional)</span>
            <input
              className="input"
              placeholder="gushed / choked / sprayed from one side / blonde early"
              value={actual.observations}
              onChange={(e) => setActual({ ...actual, observations: e.target.value })}
            />
          </label>
        </div>

        <div className="or-divider"><span>or rate quickly</span></div>

        <h3 style={{ fontSize: 17, margin: "6px 0 10px" }}>Taste</h3>
        <FlavorSliders value={flavor} onChange={setFlavor} />

        <label className="field">
          <span className="field-label">Tasting note (optional)</span>
          <input
            className="input"
            placeholder="lemony but a bit hollow…"
            value={flavor.note || ""}
            onChange={(e) => setFlavor({ ...flavor, note: e.target.value })}
          />
        </label>

        <h3 style={{ fontSize: 17, margin: "22px 0 10px" }}>Your verdict</h3>
        {busy ? (
          <div className="card card-pad center">
            <span className="spinner spinner-clay" style={{ margin: "6px auto" }} />
            <p className="muted" style={{ marginTop: 10 }}>Bruna is tasting along…</p>
          </div>
        ) : pendingVerdict ? (
          <div className="card card-pad">
            <div className="row-between">
              <strong style={{ fontFamily: "var(--serif)", fontSize: 17 }}>
                What was off?
              </strong>
              <button className="link-btn" onClick={() => setPendingVerdict(null)}>
                Back
              </button>
            </div>
            <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              Tap what you tasted — Bruna weighs this against what the roaster
              intends and fixes it.
            </p>
            <div className="chips">
              {FAULTS.map((f) => (
                <button
                  key={f}
                  className={`chip ${faults.includes(f) ? "on" : ""}`}
                  onClick={() =>
                    setFaults((cur) =>
                      cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]
                    )
                  }
                >
                  {f}
                </button>
              ))}
            </div>
            <button
              className="btn btn-primary btn-block"
              style={{ marginTop: 18 }}
              onClick={() => finalize({ ...flavor, verdict: pendingVerdict, faults })}
            >
              <SparkIcon size={18} /> Get Bruna's read
            </button>
          </div>
        ) : (
          <div className="row" style={{ gap: 10 }}>
            <button
              className="btn btn-ghost"
              style={{ flex: 1 }}
              onClick={() => {
                setFaults([]);
                setPendingVerdict("off");
              }}
            >
              Off
            </button>
            <button
              className="btn btn-ghost"
              style={{ flex: 1 }}
              onClick={() => {
                setFaults([]);
                setPendingVerdict("close");
              }}
            >
              Close
            </button>
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={() => finalize({ ...flavor, verdict: "love", faults: [] })}
            >
              <HeartIcon size={16} /> Love it
            </button>
          </div>
        )}
        </section>
      </>
    );
  }

  // ----- RESULT: advice -----
  return (
    <section>
      <div className="eyebrow">Round {roundNo} · Bruna's read</div>
      {advice && (
        <>
          <div className="advice">
            <h3>{advice.onTarget ? "That's the one." : advice.summary}</h3>
            {advice.diagnosis && (
              <p style={{ marginTop: 8, fontSize: 14.5, lineHeight: 1.5 }}>{advice.diagnosis}</p>
            )}
            {advice.changes.length > 0 && (
              <div style={{ marginTop: 14 }}>
                {advice.changes.map((c, i) => (
                  <div className="change-row" key={i}>
                    <div style={{ flex: 1 }}>
                      <strong>{c.field}</strong>
                      <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{c.why}</div>
                    </div>
                    <div className="change-arrow">
                      {c.from} → {c.to}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {advice.predictedEffect && (
              <p className="muted" style={{ fontSize: 13, marginTop: 12, fontStyle: "italic" }}>
                Next cup: {advice.predictedEffect}
              </p>
            )}
            {advice.source === "local" && (
              <p className="faint" style={{ fontSize: 11.5, marginTop: 10 }}>
                Offline suggestion from Bruna's built-in method.
              </p>
            )}
          </div>

          <div className="stack" style={{ marginTop: 20 }}>
            {advice.onTarget || flavor.verdict === "love" ? (
              <button className="btn btn-primary btn-block btn-lg" onClick={lockIn}>
                <CheckIcon size={18} /> Lock in this recipe
              </button>
            ) : (
              <>
                <div className="card card-pad">
                  <div className="field-label" style={{ marginBottom: 8 }}>Next shot</div>
                  <RecipeView r={advice.nextRecipe} />
                </div>
                <button className="btn btn-primary btn-block btn-lg" onClick={applyAndContinue}>
                  <SparkIcon size={18} /> Apply & pull next
                </button>
                <button className="btn btn-ghost btn-block" onClick={lockIn}>
                  I actually like this one — lock it in
                </button>
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
function History({ shots }: { shots: Shot[] }) {
  return (
    <section style={{ marginTop: 30 }}>
      <h2 style={{ fontSize: 19 }}>Journey</h2>
      <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
        {shots.length} {shots.length === 1 ? "shot" : "shots"} logged.
      </p>
      <div className="list" style={{ marginTop: 16, gap: 12 }}>
        {shots
          .slice()
          .reverse()
          .map((s, i) => (
            <div className="card card-pad" key={s.id}>
              <div className="row-between">
                <strong style={{ fontFamily: "var(--serif)", fontSize: 16 }}>
                  Shot {shots.length - i}
                </strong>
                <span
                  className={`badge ${
                    s.flavor.verdict === "love" ? "badge-locked" : "badge-dialing"
                  }`}
                >
                  {s.flavor.verdict === "love"
                    ? "loved"
                    : s.flavor.verdict === "close"
                    ? "close"
                    : "off"}
                </span>
              </div>
              <p className="muted" style={{ fontSize: 13, margin: "6px 0 10px" }}>
                {formatGrind(s.recipe)} · {s.recipe.dose}→{s.actual.yieldG ?? s.recipe.yieldG} g ·{" "}
                {s.actual.timeSeconds ?? s.recipe.timeSeconds}s
                {s.actual.observations ? ` · ${s.actual.observations}` : ""}
              </p>
              <FlavorFingerprint f={s.flavor} />
              {s.flavor.note && (
                <p className="muted" style={{ fontSize: 12.5, marginTop: 8, fontStyle: "italic" }}>
                  “{s.flavor.note}”
                </p>
              )}
            </div>
          ))}
      </div>
      <div className="faint" style={{ fontSize: 11, marginTop: 10, display: "flex", gap: 6, justifyContent: "space-between" }}>
        {AXES.map((a) => (
          <span key={a.key} style={{ flex: 1, textAlign: "center" }}>{a.name.slice(0, 4)}</span>
        ))}
      </div>
    </section>
  );
}
