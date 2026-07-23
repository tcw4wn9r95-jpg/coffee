import type { RoastLevel } from "./types";

interface RoastMeta {
  label: string;
  /** Roasted-bean colour, light → dark, for the dot + illustrated bag body. */
  bean: string;
  /** A softer tint of the bean colour for backgrounds / bag panels. */
  tint: string;
}

const MAP: Record<RoastLevel, RoastMeta> = {
  light: { label: "Light", bean: "#B07A46", tint: "#E7CBA6" },
  "light-medium": { label: "Light-medium", bean: "#9A6234", tint: "#DCB88F" },
  medium: { label: "Medium", bean: "#7C4A28", tint: "#C99C72" },
  "medium-dark": { label: "Medium-dark", bean: "#5E3620", tint: "#A9754E" },
  dark: { label: "Dark", bean: "#3E2418", tint: "#6E4530" },
  unknown: { label: "Roast unknown", bean: "#8A7663", tint: "#C9BBA9" },
};

export function roastMeta(level?: RoastLevel): RoastMeta {
  return MAP[level ?? "unknown"] ?? MAP.unknown;
}

export function roastLabel(level?: RoastLevel): string {
  return roastMeta(level).label;
}

export function roastColor(level?: RoastLevel): string {
  return roastMeta(level).bean;
}

/** Where a roast sits on a 0–1 light→dark scale (for gradients / fills). */
export function roastDepth(level?: RoastLevel): number {
  const order: RoastLevel[] = [
    "light",
    "light-medium",
    "medium",
    "medium-dark",
    "dark",
  ];
  const i = order.indexOf(level ?? "unknown");
  return i === -1 ? 0.5 : i / (order.length - 1);
}
