import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { processImageFile } from "../lib/image";
import { analyzeCoffeePhoto, recipeFromText, ClaudeError } from "../lib/anthropic";
import { baselineRecipe } from "../lib/gear";
import { putCoffee, putPhoto, putShot, uid } from "../lib/db";
import type { Coffee, CoffeeIdentity, Recipe } from "../lib/types";
import { RecipeView } from "../components/RecipeView";
import { RecipeEditor } from "../components/RecipeEditor";
import { CameraIcon, SparkIcon, BackIcon, CheckIcon } from "../components/Icons";
import { EMPTY_FLAVOR } from "../components/FlavorSliders";
import { useToast } from "../components/Toast";
import { hasKey } from "../lib/settings";

type Stage = "input" | "analyzing" | "review";

export function NewCoffee() {
  const nav = useNavigate();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>("input");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, setPending] = useState<{ blob: Blob; base64: string; media: string } | null>(null);

  const [identity, setIdentity] = useState<CoffeeIdentity>({ name: "", tastingNotes: [] });
  const [recipe, setRecipe] = useState<Recipe>(baselineRecipe());
  const [editing, setEditing] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    try {
      const img = await processImageFile(file);
      setPreview(img.objectURL);
      setPending({ blob: img.blob, base64: img.base64, media: img.mediaType });
    } catch {
      setError("Couldn't read that image. Try another photo.");
    }
  }

  async function analyze() {
    if (!hasKey()) {
      setError("Add your Anthropic API key in Settings first.");
      return;
    }
    if (!pending) return;
    setStage("analyzing");
    setError(null);
    try {
      const res = await analyzeCoffeePhoto(pending.base64, pending.media);
      setIdentity(res.identity);
      setRecipe(res.recipe);
      setStage("review");
    } catch (e) {
      setStage("input");
      setError(e instanceof ClaudeError ? e.message : "Analysis failed. Try again.");
    }
  }

  async function analyzeManual() {
    if (!identity.name.trim()) {
      setError("Give the coffee a name, or add a photo.");
      return;
    }
    if (!hasKey()) {
      // No key: just use baseline.
      setRecipe(baselineRecipe());
      setStage("review");
      return;
    }
    setStage("analyzing");
    setError(null);
    try {
      const r = await recipeFromText(identity);
      setRecipe(r);
      setStage("review");
    } catch {
      setRecipe(baselineRecipe());
      setStage("review");
    }
  }

  async function save() {
    let photoId: string | undefined;
    if (pending) photoId = await putPhoto(pending.blob);
    const id = uid();
    const coffee: Coffee = {
      id,
      name: identity.name.trim() || "Unknown coffee",
      roaster: identity.roaster,
      origin: identity.origin,
      process: identity.process,
      roastLevel: identity.roastLevel,
      tastingNotes: identity.tastingNotes,
      photoId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: "dialing",
    };
    await putCoffee(coffee);
    // Seed a target shot so the dial-in screen has a recipe to pull.
    await putShot({
      id: uid(),
      coffeeId: id,
      createdAt: Date.now(),
      recipe,
      actual: {},
      flavor: { ...EMPTY_FLAVOR },
    });
    toast("Saved to your shelf");
    nav(`/coffee/${id}`, { replace: true });
  }

  // ---------- render ----------
  if (stage === "analyzing") {
    return (
      <div className="screen">
        <div className="empty" style={{ paddingTop: 120 }}>
          <div className="empty-mark">
            <SparkIcon size={40} />
          </div>
          <span className="spinner spinner-clay" style={{ margin: "8px auto 18px" }} />
          <h2 style={{ fontSize: 22 }}>Reading your coffee…</h2>
          <p className="muted" style={{ maxWidth: "28ch", margin: "10px auto 0" }}>
            Bruna is studying the roast and tuning a starting recipe for your Opus
            &amp; Anna.
          </p>
        </div>
      </div>
    );
  }

  if (stage === "review") {
    return (
      <div className="screen">
        <button className="link-btn row" onClick={() => setStage("input")}>
          <BackIcon size={18} /> Back
        </button>
        <div className="eyebrow" style={{ marginTop: 14 }}>Starting recipe</div>
        <h1 className="screen-title">{identity.name || "Your coffee"}</h1>

        <label className="field">
          <span className="field-label">Coffee name</span>
          <input className="input" value={identity.name} onChange={(e) => setIdentity({ ...identity, name: e.target.value })} />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label className="field">
            <span className="field-label">Roaster</span>
            <input className="input" value={identity.roaster || ""} onChange={(e) => setIdentity({ ...identity, roaster: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">Origin</span>
            <input className="input" value={identity.origin || ""} onChange={(e) => setIdentity({ ...identity, origin: e.target.value })} />
          </label>
        </div>

        {identity.tastingNotes && identity.tastingNotes.length > 0 && (
          <div className="chips">
            {identity.tastingNotes.map((n) => (
              <span className="chip on" key={n} style={{ cursor: "default" }}>{n}</span>
            ))}
          </div>
        )}

        <div className="divider" />
        <div className="row-between">
          <h2 style={{ fontSize: 20 }}>Recommended settings</h2>
          <button className="link-btn" onClick={() => setEditing((s) => !s)}>
            {editing ? "Done" : "Adjust"}
          </button>
        </div>
        <div style={{ marginTop: 14 }}>
          {editing ? (
            <RecipeEditor recipe={recipe} onChange={setRecipe} />
          ) : (
            <RecipeView r={recipe} />
          )}
        </div>

        <div className="stack" style={{ marginTop: 24 }}>
          <button className="btn btn-primary btn-block btn-lg" onClick={save}>
            <CheckIcon size={18} /> Save & start dialing in
          </button>
        </div>
      </div>
    );
  }

  // stage === "input"
  return (
    <div className="screen">
      <div className="eyebrow">New coffee</div>
      <h1 className="screen-title">Let's meet the beans</h1>
      <p className="lede">
        Photograph the bag — front label works best. Bruna reads the roast and
        sets a starting recipe for your gear.
      </p>

      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden-file" onChange={onPick} />

      {preview ? (
        <div style={{ marginTop: 22 }}>
          <img src={preview} className="photo-preview" alt="Coffee bag" />
          <div className="row" style={{ marginTop: 12, gap: 10 }}>
            <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
              Retake
            </button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={analyze}>
              <SparkIcon size={18} /> Read this coffee
            </button>
          </div>
        </div>
      ) : (
        <button
          className="card card-pad"
          onClick={() => fileRef.current?.click()}
          style={{
            marginTop: 22,
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            padding: "44px 20px",
            cursor: "pointer",
            color: "var(--clay)",
            borderStyle: "dashed",
            borderColor: "var(--clay-soft)",
          }}
        >
          <CameraIcon size={38} />
          <span style={{ fontWeight: 600, color: "var(--ink)" }}>Take a photo</span>
          <span className="muted" style={{ fontSize: 13 }}>or choose from library</span>
        </button>
      )}

      <div className="divider" />

      <details>
        <summary className="link-btn" style={{ cursor: "pointer" }}>
          No photo — enter it by hand
        </summary>
        <div className="stack" style={{ marginTop: 16 }}>
          <label className="field" style={{ marginTop: 0 }}>
            <span className="field-label">Coffee name</span>
            <input className="input" value={identity.name} onChange={(e) => setIdentity({ ...identity, name: e.target.value })} placeholder="e.g. Ethiopia Guji" />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label className="field" style={{ marginTop: 0 }}>
              <span className="field-label">Roaster</span>
              <input className="input" value={identity.roaster || ""} onChange={(e) => setIdentity({ ...identity, roaster: e.target.value })} />
            </label>
            <label className="field" style={{ marginTop: 0 }}>
              <span className="field-label">Roast level</span>
              <select
                className="input"
                value={identity.roastLevel || "unknown"}
                onChange={(e) => setIdentity({ ...identity, roastLevel: e.target.value as CoffeeIdentity["roastLevel"] })}
              >
                <option value="unknown">Unknown</option>
                <option value="light">Light</option>
                <option value="light-medium">Light-medium</option>
                <option value="medium">Medium</option>
                <option value="medium-dark">Medium-dark</option>
                <option value="dark">Dark</option>
              </select>
            </label>
          </div>
          <button className="btn btn-primary btn-block" onClick={analyzeManual}>
            <SparkIcon size={18} /> Get my starting recipe
          </button>
        </div>
      </details>

      {error && <p style={{ color: "var(--warn)", fontSize: 13.5, marginTop: 16 }}>{error}</p>}
    </div>
  );
}
