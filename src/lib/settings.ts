import type { AppSettings } from "./types";
import { DEFAULT_GEAR } from "./gear";

const KEY = "bruna.settings.v1";

export const DEFAULT_MODEL = "claude-sonnet-5";

export const MODEL_OPTIONS = [
  { id: "claude-sonnet-5", label: "Sonnet 5 — balanced (recommended)" },
  { id: "claude-opus-4-8", label: "Opus 4.8 — most capable" },
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5 — fastest / cheapest" },
];

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      return {
        apiKey: parsed.apiKey ?? "",
        model: parsed.model ?? DEFAULT_MODEL,
        gear: parsed.gear ?? DEFAULT_GEAR,
        onboarded: parsed.onboarded ?? false,
      };
    }
  } catch {
    /* ignore */
  }
  return { apiKey: "", model: DEFAULT_MODEL, gear: DEFAULT_GEAR, onboarded: false };
}

export function saveSettings(s: AppSettings): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function hasKey(): boolean {
  return loadSettings().apiKey.trim().length > 0;
}
