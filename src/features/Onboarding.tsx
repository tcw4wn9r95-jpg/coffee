import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loadSettings, saveSettings, MODEL_OPTIONS } from "../lib/settings";
import { validateKey } from "../lib/anthropic";
import { DEFAULT_GEAR } from "../lib/gear";

export function Onboarding() {
  const nav = useNavigate();
  const existing = loadSettings();
  const [key, setKey] = useState(existing.apiKey);
  const [model, setModel] = useState(existing.model);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function begin(validate: boolean) {
    setError(null);
    const trimmed = key.trim();
    if (!trimmed) {
      setError("Paste your Anthropic API key to continue.");
      return;
    }
    saveSettings({ ...existing, apiKey: trimmed, model, onboarded: true });
    if (validate) {
      setBusy(true);
      try {
        await validateKey();
      } catch (e) {
        setBusy(false);
        setError(
          (e as Error).message +
            " — you can still continue and fix the key later in Settings."
        );
        return;
      }
      setBusy(false);
    }
    nav("/");
  }

  return (
    <div className="screen">
      <div className="brand" style={{ marginBottom: 26 }}>
        <img src="/coffee/favicon.svg" className="brand-logo" alt="" />
        <span className="brand-name">Bruna</span>
      </div>

      <div className="eyebrow">Your espresso companion</div>
      <h1 className="screen-title" style={{ fontSize: 34 }}>
        Waste fewer beans.
        <br />
        Remember every good shot.
      </h1>
      <p className="lede">
        Photograph a coffee and Bruna reads the bag, then tunes a starting recipe
        to your <strong>Fellow&nbsp;Opus</strong> and{" "}
        <strong>Lelit&nbsp;Anna&nbsp;PL41EM</strong>. Taste, nudge, repeat — until
        you lock in the settings worth keeping.
      </p>

      <div className="card card-pad" style={{ marginTop: 26 }}>
        <label className="field" style={{ marginTop: 0 }}>
          <span className="field-label">Anthropic API key</span>
          <input
            className="input"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="sk-ant-…"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
        </label>
        <p className="faint" style={{ fontSize: 12.5, marginTop: 8, lineHeight: 1.5 }}>
          Stored only on this device. Bruna calls Claude directly from your phone;
          usage is billed to your own Anthropic account. Get a key at{" "}
          <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
            console.anthropic.com
          </a>
          .
        </p>

        <label className="field">
          <span className="field-label">Model</span>
          <select className="input" value={model} onChange={(e) => setModel(e.target.value)}>
            {MODEL_OPTIONS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="callout">
        <strong>Your gear.</strong> {DEFAULT_GEAR.grinder} · {DEFAULT_GEAR.machine} ·{" "}
        {DEFAULT_GEAR.portafilter}. Every recommendation is grounded in these —
        including that the PL41EM has no PID, so temperature is coached as
        warm-up &amp; timing. You can adjust gear later in Settings.
      </div>

      {error && (
        <p style={{ color: "var(--warn)", fontSize: 13.5, marginTop: 16 }}>{error}</p>
      )}

      <div className="stack" style={{ marginTop: 22 }}>
        <button className="btn btn-primary btn-block btn-lg" disabled={busy} onClick={() => begin(true)}>
          {busy ? <span className="spinner" /> : "Verify key & begin"}
        </button>
        <button className="link-btn center" style={{ width: "100%" }} onClick={() => begin(false)}>
          Skip check, begin anyway
        </button>
      </div>
    </div>
  );
}
