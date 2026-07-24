import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loadSettings, saveSettings, MODEL_OPTIONS } from "../lib/settings";
import { validateKey } from "../lib/anthropic";
import { getLearningStats, type LearningStats } from "../lib/palate";
import { exportAll, importAll, clearAll, type BackupBundle } from "../lib/db";
import { useToast } from "../components/Toast";
import { BackIcon, BeanIcon } from "../components/Icons";

export function Settings() {
  const nav = useNavigate();
  const toast = useToast();
  const [s, setS] = useState(loadSettings());
  const [checking, setChecking] = useState(false);
  const [keyStatus, setKeyStatus] = useState<string | null>(null);
  const [stats, setStats] = useState<LearningStats | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getLearningStats().then(setStats);
  }, []);

  function persist(next: typeof s) {
    setS(next);
    saveSettings(next);
  }

  async function check() {
    saveSettings(s);
    setChecking(true);
    setKeyStatus(null);
    try {
      await validateKey();
      setKeyStatus("✓ Key works.");
    } catch (e) {
      setKeyStatus((e as Error).message);
    } finally {
      setChecking(false);
    }
  }

  async function doExport() {
    const bundle = await exportAll();
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bruna-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Backup downloaded");
  }

  async function doImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const bundle = JSON.parse(await file.text()) as BackupBundle;
      await importAll(bundle);
      toast("Backup restored");
    } catch {
      toast("Couldn't read that backup file");
    }
  }

  return (
    <div className="screen">
      <button className="link-btn row" onClick={() => nav("/")}>
        <BackIcon size={18} /> Shelf
      </button>
      <h1 className="screen-title" style={{ marginTop: 14 }}>Settings</h1>

      <h2 style={{ fontSize: 18, marginTop: 24 }}>Claude</h2>
      <div className="card card-pad" style={{ marginTop: 12 }}>
        <label className="field" style={{ marginTop: 0 }}>
          <span className="field-label">Anthropic API key</span>
          <input
            className="input"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="sk-ant-…"
            value={s.apiKey}
            onChange={(e) => persist({ ...s, apiKey: e.target.value })}
          />
        </label>
        <label className="field">
          <span className="field-label">Model</span>
          <select className="input" value={s.model} onChange={(e) => persist({ ...s, model: e.target.value })}>
            {MODEL_OPTIONS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </label>
        <div className="row" style={{ marginTop: 14, gap: 10 }}>
          <button className="btn btn-ghost" onClick={check} disabled={checking}>
            {checking ? <span className="spinner spinner-clay" /> : "Test key"}
          </button>
          {keyStatus && (
            <span style={{ fontSize: 13, color: keyStatus.startsWith("✓") ? "var(--good)" : "var(--warn)" }}>
              {keyStatus}
            </span>
          )}
        </div>
      </div>
      <p className="faint" style={{ fontSize: 12, marginTop: 8 }}>
        Your key is stored only on this device and sent directly to Anthropic.
      </p>

      <h2 style={{ fontSize: 18, marginTop: 26 }}>What Bruna has learned</h2>
      <div className="card card-pad" style={{ marginTop: 12 }}>
        <div className="row" style={{ gap: 11, alignItems: "flex-start" }}>
          <span className="learning-badge-icon">
            <BeanIcon size={18} />
          </span>
          <div style={{ flex: 1 }}>
            {stats && stats.tastings > 0 ? (
              <p style={{ fontSize: 14.5, lineHeight: 1.5 }}>
                Learning from <strong>{stats.tastings}</strong> tasting
                {stats.tastings === 1 ? "" : "s"}
                {stats.loved > 0 ? (
                  <>
                    {" "}(<strong>{stats.loved}</strong> you loved)
                  </>
                ) : null}{" "}
                across <strong>{stats.coffees}</strong> coffee
                {stats.coffees === 1 ? "" : "s"}. Each tasting sharpens the grind
                and settings Bruna suggests next.
              </p>
            ) : (
              <p style={{ fontSize: 14.5, lineHeight: 1.5 }} className="muted">
                Nothing yet. Run a guided tasting on a shot and Bruna starts
                learning what you like — then folds it into future recommendations.
              </p>
            )}
          </div>
        </div>
      </div>

      <h2 style={{ fontSize: 18, marginTop: 26 }}>Gear</h2>
      <div className="card card-pad stack" style={{ marginTop: 12 }}>
        <label className="field" style={{ marginTop: 0 }}>
          <span className="field-label">Grinder</span>
          <input className="input" value={s.gear.grinder} onChange={(e) => persist({ ...s, gear: { ...s.gear, grinder: e.target.value } })} />
        </label>
        <label className="field" style={{ marginTop: 0 }}>
          <span className="field-label">Machine</span>
          <input className="input" value={s.gear.machine} onChange={(e) => persist({ ...s, gear: { ...s.gear, machine: e.target.value } })} />
        </label>
        <label className="field" style={{ marginTop: 0 }}>
          <span className="field-label">Portafilter / basket</span>
          <input className="input" value={s.gear.portafilter} onChange={(e) => persist({ ...s, gear: { ...s.gear, portafilter: e.target.value } })} />
        </label>
      </div>
      <p className="faint" style={{ fontSize: 12, marginTop: 8 }}>
        Bruna's espresso reasoning is tuned to the Opus + Anna PL41EM. Editing gear
        updates the labels; the built-in gear expertise stays Opus/Anna-specific.
      </p>

      <h2 style={{ fontSize: 18, marginTop: 26 }}>Backup</h2>
      <p className="muted" style={{ fontSize: 13.5, marginTop: 4 }}>
        Your journey lives on this device only. Export to move it to a new phone.
      </p>
      <div className="row" style={{ marginTop: 12, gap: 10 }}>
        <button className="btn btn-ghost" onClick={doExport}>Export JSON</button>
        <button className="btn btn-ghost" onClick={() => importRef.current?.click()}>Import JSON</button>
        <input ref={importRef} type="file" accept="application/json" className="hidden-file" onChange={doImport} />
      </div>

      <div className="divider" />
      <button
        className="link-btn"
        style={{ color: "var(--warn)" }}
        onClick={async () => {
          if (confirm("Erase all coffees and shots on this device? This can't be undone.")) {
            await clearAll();
            toast("All data cleared");
          }
        }}
      >
        Erase all data
      </button>

      <p className="faint center" style={{ fontSize: 11.5, marginTop: 30 }}>
        Bruna · a quiet companion for better espresso
      </p>
    </div>
  );
}
