// Mirrors tokens.css for places that need values in JS (Leaflet pins, canvas, charts).
// Read through CSS variables so there is still one source of truth.

export function cssVar(name: string, fallback = "") {
  if (typeof window === "undefined") {
    return fallback;
  }
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export const breakpoints = {
  mobile: 768,
  tablet: 1024,
} as const;

export type Tone = "green" | "amber" | "red" | "gray" | "clay" | "blue";
