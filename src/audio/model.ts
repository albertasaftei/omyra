export const layers = ["pad", "bells", "drone", "air", "particles"] as const;
export type Layer = (typeof layers)[number];
export interface LayerConfig {
  enabled: boolean;
  volume: number;
  density: number;
}
export interface Settings {
  preset: string;
  master: number;
  layers: Record<Layer, LayerConfig>;
}
export interface MusicalEvent {
  layer: Layer;
  intensity: number;
  audioTime: number;
  duration: number;
}
export const presetCategories = {
  ambient: "Ambient · Calm & spacious",
  cinematic: "Cinematic · Gentle momentum",
  intense: "Intense · Cinematic energy",
} as const;
export const presets = [
  {
    id: "ethereal",
    category: "ambient" as const,
    name: "Ethereal",
    subtitle: "Weightless · luminous · expansive",
    description: "Somewhere between a distant star and a daydream.",
    root: 48,
    color: "#8179b9",
    volumes: [0.65, 0.42, 0.35, 0.23, 0.3],
    density: 0.45,
  },
  {
    id: "zen",
    category: "ambient" as const,
    name: "Zen",
    subtitle: "Quiet · spacious · unhurried",
    description: "Room for the silence between each thought.",
    root: 50,
    color: "#779f9b",
    volumes: [0.45, 0.3, 0.25, 0.18, 0.12],
    density: 0.18,
  },
  {
    id: "deep-space",
    category: "ambient" as const,
    name: "Deep Space",
    subtitle: "Deep · drifting · infinite",
    description: "Let the familiar fall away. Drift a little further.",
    root: 41,
    color: "#657fae",
    volumes: [0.55, 0.18, 0.65, 0.4, 0.25],
    density: 0.28,
  },
  {
    id: "golden-hour",
    category: "ambient" as const,
    name: "Golden Hour",
    subtitle: "Warm · soft · sunlit",
    description: "The last light of a day with nowhere left to go.",
    root: 55,
    color: "#bd9672",
    volumes: [0.6, 0.45, 0.24, 0.17, 0.3],
    density: 0.6,
  },
  {
    id: "moon-garden",
    category: "ambient" as const,
    name: "Moon Garden",
    subtitle: "Delicate · nocturnal · crystalline",
    description: "Tiny chimes caught in the stillness of a moonlit garden.",
    root: 50,
    color: "#9394bd",
    volumes: [0.48, 0.48, 0.24, 0.2, 0.35],
    density: 0.32,
  },
  {
    id: "tidal-dream",
    category: "ambient" as const,
    name: "Tidal Dream",
    subtitle: "Oceanic · breathing · weightless",
    description: "Soft tides of sound, arriving and gently slipping away.",
    root: 45,
    color: "#6caaa9",
    volumes: [0.6, 0.2, 0.42, 0.48, 0.3],
    density: 0.24,
  },
  {
    id: "velvet-night",
    category: "ambient" as const,
    name: "Velvet Night",
    subtitle: "Intimate · mellow · hushed",
    description:
      "Felt-soft keys and warm harmonies after the world goes quiet.",
    root: 48,
    color: "#9b829e",
    volumes: [0.5, 0.55, 0.3, 0.12, 0.16],
    density: 0.4,
  },
  {
    id: "aurora",
    category: "ambient" as const,
    name: "Aurora",
    subtitle: "Shimmering · floating · iridescent",
    description: "Slow ribbons of light and crystal tones above the clouds.",
    root: 48,
    color: "#80b4a4",
    volumes: [0.62, 0.32, 0.28, 0.22, 0.42],
    density: 0.38,
  },
  {
    id: "starward",
    category: "cinematic" as const,
    name: "Starward",
    subtitle: "Cinematic · searching · expansive",
    description: "A warm organ pulse, carrying you toward a distant horizon.",
    root: 45,
    color: "#929abf",
    volumes: [0.58, 0.55, 0.38, 0.14, 0.22],
    density: 0.8,
  },
  {
    id: "orbital",
    category: "cinematic" as const,
    name: "Orbital",
    subtitle: "Flowing · luminous · propulsive",
    description: "Interlocking points of light, moving in a gentle orbit.",
    root: 48,
    color: "#75a9ba",
    volumes: [0.48, 0.48, 0.28, 0.12, 0.3],
    density: 0.85,
  },
  {
    id: "distant-suns",
    category: "cinematic" as const,
    name: "Distant Suns",
    subtitle: "Hopeful · sweeping · patient",
    description: "Slow-building harmonies and a quiet sense of wonder.",
    root: 48,
    color: "#c3a07d",
    volumes: [0.62, 0.48, 0.32, 0.16, 0.2],
    density: 0.75,
  },
  {
    id: "eventide",
    category: "cinematic" as const,
    name: "Eventide",
    subtitle: "Reflective · rippling · intimate",
    description: "Soft keys trace a repeating path through the evening.",
    root: 50,
    color: "#a08da9",
    volumes: [0.48, 0.55, 0.25, 0.12, 0.18],
    density: 0.8,
  },
  {
    id: "momentum",
    category: "intense" as const,
    name: "Momentum",
    subtitle: "Driving · bright · flowing",
    description:
      "Quick arpeggios and a soft bass pulse, always moving forward.",
    root: 48,
    color: "#84b6ba",
    volumes: [0.48, 0.58, 0.42, 0.12, 0.28],
    density: 0.85,
  },
  {
    id: "gravity",
    category: "intense" as const,
    name: "Gravity",
    subtitle: "Dark · powerful · cinematic",
    description: "Deep organ harmonies and distant drums draw you into orbit.",
    root: 45,
    color: "#8687b4",
    volumes: [0.6, 0.52, 0.5, 0.18, 0.24],
    density: 0.8,
  },
  {
    id: "supernova",
    category: "intense" as const,
    name: "Supernova",
    subtitle: "Radiant · rising · expansive",
    description: "Interwoven sequences gather into a slow wave of light.",
    root: 48,
    color: "#c18eaa",
    volumes: [0.55, 0.56, 0.45, 0.18, 0.4],
    density: 0.9,
  },
];
export function createPresetSettings(id = "ethereal"): Settings {
  const preset = presets.find((preset) => preset.id === id) ?? presets[0];
  return {
    preset: preset.id,
    master: 0.72,
    layers: Object.fromEntries(
      layers.map((layer, i) => [
        layer,
        { enabled: true, volume: preset.volumes[i], density: preset.density },
      ]),
    ) as Settings["layers"],
  };
}
export function readStoredSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem("omyra.settings") ?? "null");
    const base = createPresetSettings(raw?.preset);
    if (!raw) return base;
    const normalizeLevel = (n: unknown, fallback: number) =>
      typeof n === "number" && Number.isFinite(n)
        ? Math.max(0, Math.min(1, n))
        : fallback;
    base.master = normalizeLevel(raw.master, base.master);
    for (const layer of layers) {
      const layerConfig = raw.layers?.[layer];
      if (layerConfig)
        base.layers[layer] = {
          enabled:
            typeof layerConfig.enabled === "boolean"
              ? layerConfig.enabled
              : true,
          volume: normalizeLevel(layerConfig.volume, base.layers[layer].volume),
          density: normalizeLevel(
            layerConfig.density,
            base.layers[layer].density,
          ),
        };
    }
    return base;
  } catch {
    return createPresetSettings();
  }
}
export const pentatonic = [0, 2, 4, 7, 9];
export class NoteGenerator {
  private previous = -1;
  constructor(private random: () => number = Math.random) {}
  next(root: number, octave = 0, scale: readonly number[] = pentatonic) {
    const candidates = scale
      .map((_, i) => i)
      .filter((i) => i !== this.previous);
    const weights = candidates.map((i) =>
      this.previous < 0 ? 1 : 1 / (1 + Math.abs(i - this.previous)),
    );
    let choice = this.random() * weights.reduce((a, b) => a + b, 0);
    let index = candidates[candidates.length - 1];
    for (let i = 0; i < candidates.length; i++) {
      choice -= weights[i];
      if (choice <= 0) {
        index = candidates[i];
        break;
      }
    }
    this.previous = index;
    return root + scale[index] + 12 * octave;
  }
}
