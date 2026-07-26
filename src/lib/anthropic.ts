import { GEAR_BRIEF, baselineRecipe, localAdjustment } from "./gear";
import { getPalateBrief } from "./palate";
import { loadSettings } from "./settings";
import type { Advice, Coffee, CoffeeIdentity, Recipe, Shot } from "./types";

/** Append the learned palate brief to a base system prompt (the learning loop). */
async function withPalate(base: string): Promise<string> {
  const palate = await getPalateBrief();
  return palate ? `${base}\n\n${palate}` : base;
}

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
  tools?: unknown[];
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
        ...(opts.tools && opts.tools.length ? { tools: opts.tools } : {}),
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

/** Normalize a user-typed roaster URL (add https:// if missing). "" if unusable. */
export function normalizeUrl(raw?: string): string {
  const s = (raw || "").trim();
  if (!s) return "";
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    return u.href;
  } catch {
    return "";
  }
}

/**
 * Server-side web_fetch tool scoped to the roaster's own domain. Claude fetches
 * the page (which we place in the message) to pull deeper brewing guidance.
 * No beta header needed on the first-party API.
 */
function webFetchTool(url: string): unknown[] | undefined {
  const href = normalizeUrl(url);
  if (!href) return undefined;
  let host = "";
  try {
    host = new URL(href).hostname;
  } catch {
    return undefined;
  }
  return [
    {
      type: "web_fetch_20260209",
      name: "web_fetch",
      max_uses: 4,
      allowed_domains: [host, `www.${host}`.replace(/^www\.www\./, "www.")],
      max_content_tokens: 6000,
    },
  ];
}

// ---------------------------------------------------------------------------
// 1) Read the bag → identity + starting recipe
// ---------------------------------------------------------------------------
const RECIPE_SYSTEM = `You are Bruna, a world-class espresso barista and dial-in coach. You recommend
starting espresso recipes for ONE specific home setup. Be precise, practical,
and grounded ONLY in the gear described. Never recommend anything the machine
can't do (e.g. never give a numeric brew temperature — this machine has no PID).

${GEAR_BRIEF}

Read the photo of the coffee bag/label like a specialty barista cataloguing a
new arrival. Study BOTH the front and any visible back-label text and pull as
much provenance as you can — bean variety/cultivar, process, region and country,
altitude, producer/farm/washing-station, harvest. Then infer a sensible STARTING
espresso recipe for this exact gear. Lighter roasts generally want a finer grind,
hotter workflow, and can take a slightly longer ratio; darker roasts want a touch
coarser and cooler. Respect the 18–20 g basket.

IMPORTANT: Fill every field you can actually read or confidently infer from the
label. If a field is genuinely not shown and can't be inferred, return "" (empty)
— do NOT invent farms, altitudes, varieties, or notes that aren't supported by
the bag. Be specific when the label is specific (e.g. variety "SL28, SL34",
process "washed", altitude "1,900–2,100 masl", region "Guji", origin "Ethiopia").

ROASTER WEBSITE: if a roaster URL is provided, USE the web_fetch tool to read
that page. Roasters usually publish richer detail there — full origin/process
story, and often explicit brew guidance (recommended ratio, grind, temperature,
and the flavour they're aiming for). Use it to fill in blank fields and to
sharpen the recipe (e.g. if they recommend a longer ratio or a specific
temperature, respect it within this gear's limits). Summarise what the roaster
says — their intended flavour profile and any brew recommendations — in the
identity field "roasterGuidance" (≤ 60 words), "" if no useful page.

Respond with STRICT JSON only, no prose, in exactly this shape:
{
  "identity": {
    "name": string,                // the coffee's name as printed
    "roaster": string,             // roaster / brand, "" if unknown
    "origin": string,              // country of origin, "" if unknown
    "region": string,              // region / locality / zone, "" if unknown
    "producer": string,            // farm / producer / co-op / washing station, "" if unknown
    "variety": string,             // cultivar(s), e.g. "Heirloom", "Bourbon, Caturra", "" if unknown
    "species": string,             // "Arabica" | "Robusta" | "blend" | "" if unknown
    "process": string,             // washed/natural/honey/anaerobic/..., "" if unknown
    "altitude": string,            // e.g. "1,900–2,100 masl", "" if unknown
    "harvest": string,             // harvest year/season, "" if unknown
    "roastLevel": "light"|"light-medium"|"medium"|"medium-dark"|"dark"|"unknown",
    "roastDate": string,           // if printed, "" otherwise
    "decaf": boolean,              // true only if the label says decaf
    "roasterGuidance": string,     // ≤60-word summary of the roaster page (flavour + brew tips), "" if none
    "tastingNotes": string[]       // flavour notes printed on the bag (preferred), else inferred
  },
  "recipe": {
    "grinderMacro": number,        // Opus outer click, 1-4 for espresso (lower = finer)
    "grinderMicro": number,        // Opus inner ticks TOWARD THE "−" MARK, 0-2 (finer)
    "dose": number,                // grams, 18-20
    "yieldG": number,              // grams out
    "ratio": string,               // e.g. "1:2"
    "timeSeconds": number,         // target seconds from first drops
    "tamp": string,                // tamp cue with explicit force in kg (≈15 kg) + level-not-hard reminder
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
  mediaType: string,
  website?: string
): Promise<CoffeeAnalysis> {
  const url = normalizeUrl(website);
  const content: ContentBlock[] = [
    {
      type: "image",
      source: { type: "base64", media_type: mediaType, data: base64 },
    },
    {
      type: "text",
      text:
        "Catalogue this coffee in full detail and give my starting espresso recipe for my gear." +
        (url
          ? ` The roaster's page for this coffee is ${url} — fetch it with web_fetch and use its origin details and any brew guidance.`
          : "") +
        " JSON only.",
    },
  ];
  const text = await callClaude({
    system: await withPalate(RECIPE_SYSTEM),
    maxTokens: url ? 2200 : 1500,
    tools: url ? webFetchTool(url) : undefined,
    content,
  });
  const parsed = extractJSON<{ identity: CoffeeIdentity; recipe: Partial<Recipe> }>(text);
  const identity = normalizeIdentity(parsed.identity);
  if (url) identity.website = url; // keep the user's URL regardless of what Claude echoes
  return {
    identity,
    recipe: coerceRecipe(parsed.recipe),
  };
}

const str = (v: unknown): string | undefined => {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t && t.toLowerCase() !== "unknown" ? t : undefined;
};

/** Trim, drop empty/"unknown" fields, and clamp arrays from a raw identity. */
export function normalizeIdentity(raw: CoffeeIdentity | undefined): CoffeeIdentity {
  const id = raw || ({ name: "Unknown coffee" } as CoffeeIdentity);
  return {
    name: str(id.name) || "Unknown coffee",
    roaster: str(id.roaster),
    origin: str(id.origin),
    region: str(id.region),
    producer: str(id.producer),
    variety: str(id.variety),
    species: str(id.species),
    process: str(id.process),
    altitude: str(id.altitude),
    harvest: str(id.harvest),
    roastLevel: id.roastLevel || "unknown",
    roastDate: str(id.roastDate),
    decaf: id.decaf === true || undefined,
    website: normalizeUrl(id.website) || undefined,
    roasterGuidance: str(id.roasterGuidance),
    tastingNotes: Array.isArray(id.tastingNotes)
      ? id.tastingNotes.map((n) => str(n)).filter((n): n is string => !!n).slice(0, 10)
      : [],
  };
}

/** When there's no photo — infer a recipe from typed coffee details. */
export async function recipeFromText(
  identity: CoffeeIdentity
): Promise<{ recipe: Recipe; roasterGuidance?: string }> {
  const url = normalizeUrl(identity.website);
  const text = await callClaude({
    system: await withPalate(RECIPE_SYSTEM),
    maxTokens: url ? 1600 : 900,
    tools: url ? webFetchTool(url) : undefined,
    content: [
      {
        type: "text",
        text:
          "No photo. Here are the coffee details as JSON. Return the SAME JSON shape " +
          "(identity + recipe); keep my identity fields, just add the recipe" +
          (url
            ? ` and fetch the roaster page ${url} with web_fetch to fill roasterGuidance and sharpen the recipe`
            : "") +
          ".\n\n" +
          JSON.stringify({ identity }),
      },
    ],
  });
  const parsed = extractJSON<{ identity?: CoffeeIdentity; recipe: Partial<Recipe> }>(text);
  return {
    recipe: coerceRecipe(parsed.recipe),
    roasterGuidance: str(parsed.identity?.roasterGuidance),
  };
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

REPORTED FAULTS: if the barista listed specific faults (e.g. "Too bitter",
"Too sour", "Too weak/watery", "Not sweet enough", "Ashy/burnt", "Channeled"),
treat them as the strongest signal and target them directly — sour/thin/fast =
under-extracted → finer; bitter/harsh/dry/slow = over-extracted → coarser;
channeling/spraying is a puck-prep problem (WDT, level, tamp square), NOT a grind
change on its own.

CONTRAST WITH THE ROASTER: the coffee's tasting notes and roasterGuidance describe
what this coffee is SUPPOSED to taste like (the roaster's intended profile, and
sometimes their brew recommendations). Diagnose the gap between what the barista
tasted and that intended profile, name it in the diagnosis (e.g. "the roaster is
going for jasmine and stone fruit, but you're getting bitterness — that's
over-extraction masking the florals"), and move toward it. If the roaster gave a
brew recommendation, honour it within this gear's limits.

GRIND PRECISION (important): the Opus adjusts in macro clicks (~50 µm) and inner
micro-ticks (⅓ of a click, ~17 µm). ALWAYS state a grind change as an explicit
DIRECTION + MAGNITUDE in Opus terms — e.g. "1 micro-tick finer (⅓ click, ~17 µm)"
or "1 full click coarser (~50 µm)". Near the target, prefer single micro-tick
moves; only jump a whole click when the shot is far off. Never say "a bit finer"
without the number. Reflect the exact target in nextRecipe.grinderMacro/grinderMicro,
and put the precise "N micro-ticks/clicks finer/coarser" in the change's "from"→"to"
and "why".

Respond with STRICT JSON only:
{
  "onTarget": boolean,            // true only if verdict is "love" or clearly dialed
  "diagnosis": string,           // 1-2 sentences: what the taste says about extraction
  "summary": string,             // short headline w/ direction+magnitude, e.g. "Grind 1 micro-tick finer (~17 µm)"
  "changes": [                   // usually 1 item, at most 2
    { "field": string, "from": string, "to": string, "why": string }  // "why" states direction + magnitude for grind
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
      const faults = f.faults?.length ? ` faults=[${f.faults.join(", ")}]` : "";
      return `Shot ${i + 1}: grind Opus ${s.recipe.grinderMacro}+${s.recipe.grinderMicro}micro, ${s.recipe.dose}g→${s.recipe.yieldG}g in ${s.actual.timeSeconds ?? s.recipe.timeSeconds}s. Taste[acid ${f.acidity} sweet ${f.sweetness} bitter ${f.bitterness} body ${f.body} after ${f.aftertaste} balance ${f.balance}] verdict=${f.verdict}${faults}. ${s.actual.observations || ""}`.trim();
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
      variety: coffee.variety,
      tastingNotes: coffee.tastingNotes,
      roasterIntendedProfile: coffee.roasterGuidance,
    },
    currentRecipe: current.recipe,
    currentActuals: current.actual,
    currentTaste: current.flavor,
    reportedFaults: current.flavor.faults,
    history: shotSummary(all),
  };
  try {
    const text = await callClaude({
      system: await withPalate(ADJUST_SYSTEM),
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
      const fallback = localAdjustment(current.recipe, current.flavor, all);
      return { ...fallback, fallbackReason: e.message };
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
