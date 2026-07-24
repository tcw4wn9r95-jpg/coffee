import type { MaintenanceLog } from "./db";

/**
 * Maintenance tasks for the user's gear, drawn from the manufacturers' own
 * care guidance:
 *
 * - Fellow Opus care guide (fellowproducts.com): brush chaff after each session;
 *   deep-clean the burrs periodically; wipe hopper.
 * - Lelit Anna PL41EM user manual + Lelit's cleaning notes: rinse/flush the group
 *   daily; detergent backflush weekly with a blind basket; descale the boiler
 *   roughly every 2–3 months (sooner in hard water); keep the steam wand purged
 *   and wiped after every use.
 *
 * Kept intentionally short — this is a home espresso setup, not a cafe.
 */

export type Cadence = "daily" | "weekly" | "biweekly" | "monthly" | "quarterly";

export interface MaintenanceStep {
  /** One clear instruction, imperative voice. */
  text: string;
  /** Optional supporting detail (why / a warning / a tip). */
  detail?: string;
}

export interface MaintenanceTask {
  id: string;
  name: string;
  /** Which piece of gear this task is for. */
  gear: "grinder" | "machine";
  cadence: Cadence;
  /** Frequency in days — drives "next due" math. */
  everyDays: number;
  /** Short line the dashboard card shows. */
  blurb: string;
  /** ~ minutes to complete. Shown as a small chip. */
  minutes: number;
  /** Which animation to play on the step screen. */
  anim: "brush" | "backflush" | "detergent" | "screen" | "descale";
  /** Sourced from the manufacturer's guidance — see file header. */
  source: string;
  steps: MaintenanceStep[];
}

export const MAINTENANCE_TASKS: MaintenanceTask[] = [
  {
    id: "opus-brush",
    name: "Brush the grinder chaff",
    gear: "grinder",
    cadence: "daily",
    everyDays: 1,
    minutes: 1,
    blurb: "Keeps stale grounds out of your next dose.",
    anim: "brush",
    source: "Fellow Opus care guide",
    steps: [
      {
        text: "Empty the hopper and run the grinder dry for ~5 seconds.",
        detail: "Clears any beans stranded in the burrs.",
      },
      {
        text: "Unlatch the front catch and lift the grounds bin out.",
      },
      {
        text: "Use the supplied brush to sweep chaff off the burrs and the exit chute.",
        detail: "Fellow recommends the natural-bristle brush that ships with the Opus.",
      },
      {
        text: "Tap the grounds bin over the bin, wipe with a dry cloth, and reseat it.",
      },
    ],
  },
  {
    id: "opus-deep",
    name: "Deep-clean the Opus burrs",
    gear: "grinder",
    cadence: "biweekly",
    everyDays: 14,
    minutes: 10,
    blurb: "Coffee oils dull the burrs — a fortnightly reset keeps grinds sharp.",
    anim: "brush",
    source: "Fellow Opus care guide",
    steps: [
      {
        text: "Unplug the grinder. Empty and remove the hopper.",
      },
      {
        text: "Twist the upper burr counter-clockwise to unlock, then lift it out.",
        detail: "Fellow marks the unlock arrow on the burr collar.",
      },
      {
        text: "Brush both burrs thoroughly — front and back — and vacuum any residue.",
        detail: "Don't wet the burrs; moisture and metal burrs don't mix.",
      },
      {
        text: "Wipe the burr chamber with a dry microfibre cloth.",
      },
      {
        text: "Reseat the upper burr; twist clockwise until it clicks home.",
        detail: "Re-zero the grind setting after refitting — the reference point moves slightly.",
      },
    ],
  },
  {
    id: "anna-water-backflush",
    name: "Water backflush",
    gear: "machine",
    cadence: "daily",
    everyDays: 2,
    minutes: 2,
    blurb: "Flushes coffee residue out of the 3-way solenoid.",
    anim: "backflush",
    source: "Lelit Anna manual",
    steps: [
      {
        text: "With the machine warm, lock in the portafilter fitted with the blind (rubber) basket.",
      },
      {
        text: "Start the brew cycle for ~10 seconds — pressure builds behind the blind basket.",
      },
      {
        text: "Stop and wait 5 seconds — the 3-way valve releases into the drip tray.",
        detail: "You should hear the characteristic hiss of water dumping.",
      },
      {
        text: "Repeat five times, then remove the portafilter and wipe the group seal.",
      },
    ],
  },
  {
    id: "anna-detergent-backflush",
    name: "Detergent backflush",
    gear: "machine",
    cadence: "weekly",
    everyDays: 7,
    minutes: 10,
    blurb: "Dissolves coffee oils the water flush can't move.",
    anim: "detergent",
    source: "Lelit Anna manual · Puly Caff / Cafiza dosing",
    steps: [
      {
        text: "Warm the machine fully (20+ min). Fit the blind basket in the portafilter.",
      },
      {
        text: "Add ~3 g (½ teaspoon) of espresso-machine detergent into the blind basket.",
        detail: "Puly Caff or Cafiza — never dish soap; it foams uncontrollably.",
      },
      {
        text: "Lock the portafilter in. Run brew for 10s, off for 10s. Repeat 5 times.",
      },
      {
        text: "Remove the portafilter, empty & rinse the basket completely.",
      },
      {
        text: "Refit the clean blind basket and repeat the 10-on / 10-off cycle 5 more times with plain water to rinse.",
        detail: "Any lingering detergent taste means one more water cycle.",
      },
      {
        text: "Pull a small throwaway shot with a normal basket — sniff & taste to confirm no soap.",
      },
    ],
  },
  {
    id: "anna-shower-screen",
    name: "Group gasket & shower screen",
    gear: "machine",
    cadence: "monthly",
    everyDays: 45,
    minutes: 15,
    blurb: "A soaked shower screen tastes cleaner than a scrubbed one.",
    anim: "screen",
    source: "Lelit Anna manual · Home-Barista consensus",
    steps: [
      {
        text: "Turn the machine off and let the group cool.",
      },
      {
        text: "Unscrew the central bolt holding the shower screen; remove the screen and dispersion block.",
      },
      {
        text: "Soak both in warm water + espresso detergent for 10–15 minutes.",
      },
      {
        text: "Scrub the group gasket with a soft brush — check the rubber for cracks or hardening.",
        detail: "Replace the gasket if it's flattened or letting the portafilter sit past the 6-o'clock position.",
      },
      {
        text: "Rinse everything thoroughly and reassemble — snug, not overtightened.",
      },
    ],
  },
  {
    id: "anna-descale",
    name: "Descale the boiler",
    gear: "machine",
    cadence: "quarterly",
    everyDays: 90,
    minutes: 30,
    blurb: "Removes limescale — critical on a single-boiler with no PID.",
    anim: "descale",
    source: "Lelit Anna manual · descaler dosing on the bottle",
    steps: [
      {
        text: "Empty the water tank. Fill with fresh water + descaler per the bottle's dose.",
        detail: "Lelit-branded descaler is safest; citric acid works but follow a proven ratio.",
      },
      {
        text: "Turn the machine on and let it warm up so descaler reaches the boiler.",
      },
      {
        text: "Draw 100 ml through the steam wand into a jug, then 100 ml through the group.",
      },
      {
        text: "Turn off, wait 15–20 minutes for the descaler to work.",
        detail: "This dwell time is what actually removes scale — don't skip it.",
      },
      {
        text: "Drain the tank. Refill with plain water and flush 2 full tanks through the group + wand to rinse.",
        detail: "Any acidic taste in the water = one more rinse tank.",
      },
      {
        text: "Log this descale — the next one is due in ~3 months (sooner if your water is hard).",
      },
    ],
  },
];

export function getTask(id: string): MaintenanceTask | undefined {
  return MAINTENANCE_TASKS.find((t) => t.id === id);
}

export type Status = "never" | "ok" | "due" | "overdue";

export interface TaskStatus {
  task: MaintenanceTask;
  log?: MaintenanceLog;
  status: Status;
  /** ms since last done (0 if never). */
  ageMs: number;
  /** Timestamp of when it becomes due (undefined if never done). */
  nextDueAt?: number;
}

const DAY = 86_400_000;

export function statusOf(task: MaintenanceTask, log?: MaintenanceLog): TaskStatus {
  if (!log) {
    return { task, log, status: "never", ageMs: 0 };
  }
  const age = Date.now() - log.lastDoneAt;
  const window = task.everyDays * DAY;
  const nextDueAt = log.lastDoneAt + window;
  let status: Status = "ok";
  if (age > window * 1.5) status = "overdue";
  else if (age > window) status = "due";
  return { task, log, status, ageMs: age, nextDueAt };
}

export async function fetchAllStatuses(): Promise<TaskStatus[]> {
  const { listMaintenance } = await import("./db");
  const logs = await listMaintenance();
  const byId = new Map(logs.map((l) => [l.taskId, l]));
  return MAINTENANCE_TASKS.map((t) => statusOf(t, byId.get(t.id)));
}

/** "3 days ago", "yesterday", "just now". */
export function relTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(diff / 3_600_000);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(diff / DAY);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

/** "in 3 days", "today", "5 days late". */
export function whenDue(status: TaskStatus): string {
  if (status.status === "never") return "never done";
  const nextAt = status.nextDueAt!;
  const diff = nextAt - Date.now();
  if (diff <= 0) {
    const days = Math.max(1, Math.floor(-diff / DAY));
    return days === 1 ? "due today" : `${days} days late`;
  }
  const days = Math.ceil(diff / DAY);
  if (days === 1) return "due tomorrow";
  return `due in ${days} days`;
}

export function cadenceLabel(t: MaintenanceTask): string {
  switch (t.cadence) {
    case "daily":
      return t.everyDays === 1 ? "Every day" : `Every ${t.everyDays} days`;
    case "weekly":
      return "Weekly";
    case "biweekly":
      return "Every 2 weeks";
    case "monthly":
      return "Monthly";
    case "quarterly":
      return "Every 3 months";
  }
}
