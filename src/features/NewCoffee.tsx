import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { processImageFile } from "../lib/image";
import { analyzeCoffeePhoto, recipeFromText, refitRecipe, ClaudeError } from "../lib/anthropic";
import { baselineRecipe } from "../lib/gear";
import { putCoffee, putPhoto, putShot, uid } from "../lib/db";
import type { Coffee, CoffeeIdentity, Recipe } from "../lib/types";
import { RecipeView } from "../components/RecipeView";
import { RecipeEditor } from "../components/RecipeEditor";
import { CameraIcon, ImageIcon, BeanIcon, BackIcon, CheckIcon } from "../components/Icons";
import { BrewingLoader } from "../components/BrewingLoader";
import { EMPTY_FLAVOR } from "../components/FlavorSliders";
import { useToast } from "../components/Toast";
import { hasKey } from "../lib/settings";

type Stage = "input" | "analyzing" | "review";

export function NewCoffee() {
  const nav = useNavigate();
  const toast = useToast();
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>("input");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, setPending] = useState<{ blob: Blob; base64: string; media: string } | null>(null);

  const [identity, setIdentity] = useState<CoffeeIdentity>({ name: "", tastingNotes: [] });
  const [recipe, setRecipe] = useState<Recipe>(baselineRecipe());
  // Bruna's originally-recommended ratio, kept stable as the user edits the recipe.
  const [recommendedRatio, setRecommendedRatio] = useState(baselineRecipe().ratio);
  const [editing, setEditing] = useState(false);
  const [moreDetails, setMoreDetails] = useState(false);
  const [refitBusy, setRefitBusy] = useState(false);
  const setId = (patch: Partial<CoffeeIdentity>) => setIdentity((p) => ({ ...p, ...patch }));

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
      const res = await analyzeCoffeePhoto(pending.base64, pending.media, identity.website);
      // Keep any details the user already typed (e.g. website) if Claude left them blank.
      setIdentity((prev) => ({ ...res.identity, website: res.identity.website || prev.website }));
      setRecipe(res.recipe);
      setRecommendedRatio(res.recipe.ratio);
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
      setRecipe(r.recipe);
      setRecommendedRatio(r.recipe.ratio);
      if (r.roasterGuidance) setId({ roasterGuidance: r.roasterGuidance });
      setStage("review");
    } catch {
      setRecipe(baselineRecipe());
      setStage("review");
    }
  }

  async function refitFromDoseRatio(fixed: { dose: number; ratio: string; yieldG: number }) {
    setRefitBusy(true);
    try {
      // Synthesise a Coffee shape from the current identity — the coffee
      // itself isn't in the DB yet on this screen, but refitRecipe only reads
      // identity fields.
      const stub: Coffee = {
        ...identity,
        name: identity.name?.trim() || "Unknown coffee",
        id: "stub",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: "dialing",
      };
      const refit = await refitRecipe(stub, fixed);
      setRecipe(refit);
      toast("Recipe recomputed for your dose & ratio");
    } catch (e) {
      const msg = e instanceof ClaudeError ? e.message : "Couldn't recompute — try again.";
      toast(msg);
    } finally {
      setRefitBusy(false);
    }
  }

  async function save() {
    let photoId: string | undefined;
    if (pending) photoId = await putPhoto(pending.blob);
    const id = uid();
    const coffee: Coffee = {
      ...identity,
      name: identity.name.trim() || "Unknown coffee",
      id,
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
        <div className="empty" style={{ paddingTop: 110 }}>
          <BrewingLoader size={104} />
          <h2 style={{ fontSize: 22, marginTop: 14 }}>Reading your coffee…</h2>
          <p className="muted" style={{ maxWidth: "30ch", margin: "10px auto 0" }}>
            {identity.website
              ? "Bruna is studying the roast and reading the roaster's page to tune a recipe for your Opus & Anna."
              : "Bruna is studying the roast and tuning a starting recipe for your Opus & Anna."}
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
        <div className="eyebrow" style={{ marginTop: 14 }}>What Bruna found</div>
        <h1 className="screen-title">{identity.name || "Your coffee"}</h1>
        <p className="muted" style={{ fontSize: 13.5, marginTop: 6 }}>
          Everything read from the bag — correct anything that's off.
        </p>

        <label className="field">
          <span className="field-label">Coffee name</span>
          <input className="input" value={identity.name} onChange={(e) => setId({ name: e.target.value })} />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label className="field">
            <span className="field-label">Roaster</span>
            <input className="input" value={identity.roaster || ""} onChange={(e) => setId({ roaster: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">Roast level</span>
            <select
              className="input"
              value={identity.roastLevel || "unknown"}
              onChange={(e) => setId({ roastLevel: e.target.value as CoffeeIdentity["roastLevel"] })}
            >
              <option value="unknown">Unknown</option>
              <option value="light">Light</option>
              <option value="light-medium">Light-medium</option>
              <option value="medium">Medium</option>
              <option value="medium-dark">Medium-dark</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <label className="field">
            <span className="field-label">Origin</span>
            <input className="input" value={identity.origin || ""} onChange={(e) => setId({ origin: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">Region</span>
            <input className="input" value={identity.region || ""} onChange={(e) => setId({ region: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">Variety</span>
            <input className="input" value={identity.variety || ""} onChange={(e) => setId({ variety: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">Process</span>
            <input className="input" value={identity.process || ""} onChange={(e) => setId({ process: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">Altitude</span>
            <input className="input" value={identity.altitude || ""} onChange={(e) => setId({ altitude: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">Producer / farm</span>
            <input className="input" value={identity.producer || ""} onChange={(e) => setId({ producer: e.target.value })} />
          </label>
        </div>

        <label className="field">
          <span className="field-label">Roaster website</span>
          <input
            className="input"
            type="url"
            inputMode="url"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="roaster.com/this-coffee"
            value={identity.website || ""}
            onChange={(e) => setId({ website: e.target.value })}
          />
        </label>

        {identity.roasterGuidance && (
          <div className="callout" style={{ marginTop: 14 }}>
            <strong>From the roaster.</strong> {identity.roasterGuidance}
          </div>
        )}

        <button className="link-btn" style={{ marginTop: 14 }} onClick={() => setMoreDetails((s) => !s)}>
          {moreDetails ? "Fewer details" : "More details"}
        </button>
        {moreDetails && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 10 }}>
            <label className="field" style={{ marginTop: 0 }}>
              <span className="field-label">Harvest</span>
              <input className="input" value={identity.harvest || ""} onChange={(e) => setId({ harvest: e.target.value })} />
            </label>
            <label className="field" style={{ marginTop: 0 }}>
              <span className="field-label">Species</span>
              <input className="input" value={identity.species || ""} onChange={(e) => setId({ species: e.target.value })} />
            </label>
            <label className="field" style={{ marginTop: 0 }}>
              <span className="field-label">Roast date</span>
              <input className="input" value={identity.roastDate || ""} onChange={(e) => setId({ roastDate: e.target.value })} />
            </label>
            <label className="field row" style={{ marginTop: 0, alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={!!identity.decaf} onChange={(e) => setId({ decaf: e.target.checked })} />
              <span className="field-label" style={{ margin: 0 }}>Decaf</span>
            </label>
          </div>
        )}

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
            <RecipeEditor
              recipe={recipe}
              onChange={setRecipe}
              recommendedRatio={recommendedRatio}
              onRefit={refitFromDoseRatio}
              refitBusy={refitBusy}
            />
          ) : (
            <RecipeView r={recipe} onChange={setRecipe} />
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

      {/* Camera forces the rear camera; the second input (no capture) opens the photo library. */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden-file" onChange={onPick} />
      <input ref={libraryRef} type="file" accept="image/*" className="hidden-file" onChange={onPick} />

      {preview ? (
        <div style={{ marginTop: 22 }}>
          <img src={preview} className="photo-preview" alt="Coffee bag" />
          <div className="row" style={{ marginTop: 12, gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => cameraRef.current?.click()}>
              <CameraIcon size={17} /> Retake
            </button>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => libraryRef.current?.click()}>
              <ImageIcon size={17} /> Library
            </button>
          </div>
          <button className="btn btn-primary btn-block" style={{ marginTop: 10 }} onClick={analyze}>
            <BeanIcon size={18} /> Read this coffee
          </button>
        </div>
      ) : (
        <div style={{ marginTop: 22 }}>
          <button
            className="card card-pad"
            onClick={() => cameraRef.current?.click()}
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
              padding: "40px 20px",
              cursor: "pointer",
              color: "var(--clay)",
              borderStyle: "dashed",
              borderColor: "var(--clay-soft)",
            }}
          >
            <CameraIcon size={38} />
            <span style={{ fontWeight: 600, color: "var(--ink)" }}>Take a photo</span>
          </button>
          <button
            className="btn btn-ghost btn-block"
            style={{ marginTop: 12 }}
            onClick={() => libraryRef.current?.click()}
          >
            <ImageIcon size={18} /> Choose from library
          </button>
        </div>
      )}

      <label className="field" style={{ marginTop: 20 }}>
        <span className="field-label">Roaster website (optional)</span>
        <input
          className="input"
          type="url"
          inputMode="url"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="roaster.com/this-coffee"
          value={identity.website || ""}
          onChange={(e) => setId({ website: e.target.value })}
        />
        <span className="faint" style={{ fontSize: 12, marginTop: 6, display: "block", lineHeight: 1.4 }}>
          Paste the coffee's page and Bruna reads it — roasters often list origin
          detail and brew guidance that sharpen your recipe.
        </span>
      </label>

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
            <BeanIcon size={18} /> Get my starting recipe
          </button>
        </div>
      </details>

      {error && <p style={{ color: "var(--warn)", fontSize: 13.5, marginTop: 16 }}>{error}</p>}
    </div>
  );
}
