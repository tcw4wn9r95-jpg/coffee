import { GEAR_BRIEF, baselineRecipe, localAdjustment } from "./gear";
import { loadSettings } from "./settings";
import type { Advice, Coffee, CoffeeIdentity, Recipe, Shot } from "./types";

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

export class ClaudeError extends Error {}

interface ContentBlock {
  type: string;
  text?: string;
  source?: { type: "base64"; media_type: string; data: string };
}

async function callClaude(opts: {
  system: string;
  content: ContentBlock[];
  maxTokens?: number;
}): Promise<string> {
  const { apiKey, model } = loadSettings();
  if (!apiKey) throw new ClaudeError("No API key set. Add your Anthropic key in Settings.");

  let res: Response;
  try {
    res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": API_VERSION,
        // Enables direct browser calls (CORS). Key stays on-device.
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model,
        max_tokens: opts.maxTokens ?? 1024,
        system: opts.system,
        messages: [{ role: "user", content: opts.content }],
      }),
    });
  } catch {
    throw new ClaudeError(
      "Couldn't reach Claude. Check your connection and try again."
    );
  }

  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.error?.message || "";
    } catch {
      /* ignore */
    }
    if (res.status === 401)
      throw new ClaudeError("Your API key was rejected (401). Check it in Settings.");
    if (res.status === 429)
      throw new ClaudeError("Rate limited by Anthropic (429). Wait a moment and retry.");
    throw new ClaudeError(
      `Claude request failed (${res.status})${detail ? `: ${detail}` : ""}`
    );
  }

  const data = await res.json();
  const text: string = (data.content || [])
    .filter((b: ContentBlock) => b.type === "text")
    .map((b: ContentBlock) => b.text)
    .join("\n");
  return text;
}

/** Extract the first JSON object from a model response, tolerant of fences. */
function extractJSON<T>(text: string): T {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1) throw new ClaudeError("Claude didn't return JSON.");
  const slice = t.slice(start, end + 1);
  try {
    return JSON.parse(slice) as T;
  } catch {
    throw new ClaudeError("Couldn't parse Claude's response.");
  }
}

function coerceRecipe(raw: Partial<Recipe> | undefined): Recipe {
  const base = baselineRecipe();
  if (!raw) return base;
  const dose = num(raw.dose, base.dose);
  const yieldG = num(raw.yieldG, base.yieldG);
  return {
    grinderMacro: clamp(num(raw.grinderMacro, base.grinderMacro), 1, 41),
    grinderMicro: clamp(num(raw.grinderMicro, base.grinderMicro), 0, 2),
    dose,
    yieldG,
    ratio: raw.ratio || `1:${(yieldG / dose).toFixed(1)}`,
    timeSeconds: clamp(num(raw.timeSeconds, base.timeSeconds), 10, 60),
    tamp: raw.tamp || base.tamp,
    temperature: raw.temperature || base.temperature,
    preInfusion: raw.preInfusion || base.preInfusion,
    notes: raw.notes || "",
  };
}
const num = (v: unknown, d: number) =>
  typeof v === "number" && !Number.isNaN(v) ? v : Number(v) || d;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ---------------------------------------------------------------------------
// 1) Read the bag → identity + starting recipe
// ---------------------------------------------------------------------------
const RECIPE_SYSTEM = `You are Bruna, a world-class espresso barista and dial-in coach. You recommend
starting espresso recipes for ONE specific home setup. Be precise, practical,
and grounded ONLY in the gear described. Never recommend anything the machine
can't do (e.g. never give a numeric brew temperature — this machine has no PID).

${GEAR_BRIEF}

Read the photo of the coffee bag/label. Identify the coffee and infer a sensible
STARTING espresso recipe for this exact gear. Lighter roasts generally want a
finer grind, hotter workflow, and can take a slightly longer ratio; darker
roasts want a touch coarser and cooler. Respect the 18–20 g basket.

Respond with STRICT JSON only, no prose, in exactly this shape:
{
  "identity": {
    "name": string,                // best guess of the coffee's name
    "roaster": string,             // "" if unknown
    "origin": string,              // "" if unknown
    "process": string,             // washed/natural/honey/""
    "roastLevel": "light"|"light-medium"|"medium"|"medium-dark"|"dark"|"unknown",
    "tastingNotes": string[]       // notes printed on the bag, or inferred flavours
  },
  "recipe": {
    "grinderMacro": number,        // Opus outer click, 1-4 for espresso
    "grinderMicro": number,        // Opus inner micro ticks, 0-2
    "dose": number,                // grams, 18-20
    "yieldG": number,              // grams out
    "ratio": string,               // e.g. "1:2"
    "timeSeconds": number,         // target seconds from first drops
    "tamp": string,                // short tamping cue
    "temperature": string,         // WORKFLOW guidance (warm-up / temp surf), NOT a number
    "preInfusion": string,         // manual pre-infusion guidance
    "notes": string                // one-line rationale tying to this coffee
  }
}
If the image is unreadable, still return a safe medium-roast baseline and set
identity.name to "Unknown coffee".`;

export interface CoffeeAnalysis {
  identity: CoffeeIdentity;
  recipe: Recipe;
}

export async function analyzeCoffeePhoto(
  base64: string,
  mediaType: string
): Promise<CoffeeAnalysis> {
  const text = await callClaude({
    system: RECIPE_SYSTEM,
    maxTokens: 1100,
    content: [
      {
        type: "image",
        source: { type: "base64", media_type: mediaType, data: base64 },
      },
      {
        type: "text",
        text: "Identify this coffee and give my starting espresso recipe for my gear. JSON only.",
      },
    ],
  });
  const parsed = extractJSON<{ identity: CoffeeIdentity; recipe: Partial<Recipe> }>(text);
  const id = parsed.identity || ({ name: "Unknown coffee" } as CoffeeIdentity);
  return {
    identity: {
      name: id.name || "Unknown coffee",
      roaster: id.roaster || undefined,
      origin: id.origin || undefined,
      process: id.process || undefined,
      roastLevel: id.roastLevel || "unknown",
      tastingNotes: Array.isArray(id.tastingNotes)
        ? id.tastingNotes.filter(Boolean).slice(0, 8)
        : [],
    },
    recipe: coerceRecipe(parsed.recipe),
  };
}

/** When there's no photo — infer a recipe from typed coffee details. */
export async function recipeFromText(identity: CoffeeIdentity): Promise<Recipe> {
  const text = await callClaude({
    system: RECIPE_SYSTEM,
    maxTokens: 900,
    content: [
      {
        type: "text",
        text:
          "No photo. Here are the coffee details as JSON. Return the SAME JSON shape " +
          "(identity + recipe); keep my identity fields, just add the recipe.\n\n" +
          JSON.stringify({ identity }),
      },
    ],
  });
  const parsed = extractJSON<{ recipe: Partial<Recipe> }>(text);
  return coerceRecipe(parsed.recipe);
}

// ---------------------------------------------------------------------------
// 2) Taste feedback → next single adjustment
// ---------------------------------------------------------------------------
const ADJUST_SYSTEM = `You are Bruna, a world-class espresso dial-in coach. The barista just pulled a
shot on the gear below, logged what actually happened, and rated the taste on
six 0–100 sliders. Diagnose extraction and prescribe the SMALLEST high-leverage
change to move toward a shot they'll love. Change ONE primary variable at a time
(usually grind first). Keep dose and yield fixed unless taste is already balanced
but flat. Ground everything in the gear — remember: NO PID, so temperature advice
is workflow (warm-up / temperature surfing / flush), never a number.

${GEAR_BRIEF}

Slider meaning (0 = low/left, 100 = high/right):
- acidity: flat ↔ sharp/sour (high can mean under-extracted)
- sweetness: low ↔ high (want high)
- bitterness: none ↔ harsh (high can mean over-extracted)
- body: thin/watery ↔ thick/syrupy
- aftertaste: short ↔ long & pleasant
- balance: unbalanced ↔ harmonious
verdict: "love" | "close" | "off".

Respond with STRICT JSON only:
{
  "onTarget": boolean,            // true only if verdict is "love" or clearly dialed
  "diagnosis": string,           // 1-2 sentences: what the taste says about extraction
  "summary": string,             // short headline of the change, e.g. "Grind 1 tick finer"
  "changes": [                   // usually 1 item, at most 2
    { "field": string, "from": string, "to": string, "why": string }
  ],
  "nextRecipe": {                // the FULL updated recipe to pull next
    "grinderMacro": number, "grinderMicro": number, "dose": number, "yieldG": number,
    "ratio": string, "timeSeconds": number, "tamp": string, "temperature": string,
    "preInfusion": string, "notes": string
  },
  "predictedEffect": string      // what to expect in the cup next time
}`;

function shotSummary(shots: Shot[]): string {
  return shots
    .map((s, i) => {
      const f = s.flavor;
      return `Shot ${i + 1}: grind Opus ${s.recipe.grinderMacro}+${s.recipe.grinderMicro}micro, ${s.recipe.dose}g→${s.recipe.yieldG}g in ${s.actual.timeSeconds ?? s.recipe.timeSeconds}s. Taste[acid ${f.acidity} sweet ${f.sweetness} bitter ${f.bitterness} body ${f.body} after ${f.aftertaste} balance ${f.balance}] verdict=${f.verdict}. ${s.actual.observations || ""}`.trim();
    })
    .join("\n");
}

export async function suggestAdjustment(
  coffee: Coffee,
  history: Shot[],
  current: Shot
): Promise<Advice> {
  const all = [...history, current];
  const payload = {
    coffee: {
      name: coffee.name,
      roaster: coffee.roaster,
      origin: coffee.origin,
      process: coffee.process,
      roastLevel: coffee.roastLevel,
      tastingNotes: coffee.tastingNotes,
    },
    currentRecipe: current.recipe,
    currentActuals: current.actual,
    currentTaste: current.flavor,
    history: shotSummary(all),
  };
  try {
    const text = await callClaude({
      system: ADJUST_SYSTEM,
      maxTokens: 1000,
      content: [
        {
          type: "text",
          text:
            "Here is the shot log and the latest taste. Give the next single adjustment. JSON only.\n\n" +
            JSON.stringify(payload, null, 2),
        },
      ],
    });
    const parsed = extractJSON<Partial<Advice>>(text);
    return {
      onTarget: !!parsed.onTarget || current.flavor.verdict === "love",
      summary: parsed.summary || "Adjust and re-taste.",
      diagnosis: parsed.diagnosis || "",
      changes: Array.isArray(parsed.changes) ? parsed.changes.slice(0, 2) : [],
      nextRecipe: coerceRecipe(parsed.nextRecipe as Partial<Recipe>),
      predictedEffect: parsed.predictedEffect || "",
      source: "claude",
    };
  } catch (e) {
    // Graceful offline / error fallback so the loop still works.
    if (e instanceof ClaudeError) {
      // Fall back to the built-in SCA-method engine so the loop still works.
      return localAdjustment(current.recipe, current.flavor, all);
    }
    throw e;
  }
}

/** Lightweight key check used during onboarding. */
export async function validateKey(): Promise<void> {
  await callClaude({
    system: "Reply with the single word: ok",
    maxTokens: 8,
    content: [{ type: "text", text: "ping" }],
  });
}
