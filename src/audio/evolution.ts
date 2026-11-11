import type { Layer } from "./model";
export type Transformation = "ending" | "degree" | "omit" | "octave";
export type Section = "sparse" | "developing" | "crest" | "release";
export const sections: Section[] = ["sparse", "developing", "crest", "release"];
export interface EvolutionRule {
  transformations: Transformation[];
  probability: number;
  intensity: [number, number, number, number];
  participants: Layer[];
  register: [number, number]; // MIDI relative to root
}
const rule = (
  transformations: Transformation[],
  probability: number,
  intensity: EvolutionRule["intensity"],
  register: [number, number],
  participants: Layer[] = ["pad", "bells", "drone", "air", "particles"],
): EvolutionRule => ({
  transformations,
  probability,
  intensity,
  register,
  participants,
});
export const evolution: Record<string, EvolutionRule> = {
  ethereal: rule(["ending", "omit"], 0.3, [0.45, 0.65, 0.8, 0.4], [24, 36]),
  zen: rule(
    ["ending", "omit"],
    0.18,
    [0.25, 0.4, 0.55, 0.2],
    [12, 24],
    ["pad", "bells", "air", "particles"],
  ),
  "deep-space": rule(
    ["degree", "omit"],
    0.25,
    [0.35, 0.55, 0.75, 0.3],
    [12, 24],
  ),
  "golden-hour": rule(
    ["ending", "degree"],
    0.45,
    [0.45, 0.7, 0.85, 0.4],
    [12, 24],
  ),
  "moon-garden": rule(
    ["omit", "ending", "octave"],
    0.45,
    [0.3, 0.55, 0.75, 0.25],
    [24, 48],
  ),
  "tidal-dream": rule(
    ["ending", "omit"],
    0.25,
    [0.35, 0.6, 0.8, 0.3],
    [24, 36],
  ),
  "velvet-night": rule(
    ["ending", "degree", "omit"],
    0.4,
    [0.35, 0.55, 0.7, 0.3],
    [12, 24],
  ),
  aurora: rule(["ending", "octave"], 0.45, [0.4, 0.65, 0.9, 0.35], [24, 48]),
  starward: rule(["ending", "omit"], 0.3, [0.45, 0.65, 0.85, 0.4], [12, 36]),
  orbital: rule(
    ["degree", "omit", "octave"],
    0.5,
    [0.35, 0.6, 0.85, 0.3],
    [24, 48],
  ),
  "distant-suns": rule(
    ["ending", "degree"],
    0.35,
    [0.35, 0.6, 0.85, 0.3],
    [-12, 24],
  ),
  eventide: rule(["ending", "omit"], 0.4, [0.4, 0.6, 0.8, 0.35], [-12, 24]),
  momentum: rule(["degree", "omit"], 0.55, [0.5, 0.75, 1, 0.4], [-12, 24]),
  gravity: rule(["ending", "omit"], 0.35, [0.45, 0.7, 0.95, 0.35], [-12, 24]),
  supernova: rule(
    ["degree", "octave", "ending"],
    0.6,
    [0.45, 0.75, 1, 0.35],
    [12, 48],
  ),
};
