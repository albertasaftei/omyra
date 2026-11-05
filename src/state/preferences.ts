import { create } from "zustand";
import {
  readStoredSettings,
  createPresetSettings,
  presets,
  type Settings,
  type Layer,
  type LayerConfig,
} from "../audio/model";
import {
  parseBackgroundId,
  type BackgroundId,
} from "../visualizer/backgrounds";
function readStoredPreference(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

interface Preferences {
  settings: Settings;
  visualsEnabled: boolean;
  colorMode: "fixed" | "drift";
  setColorMode: (value: "fixed" | "drift") => void;
  customColor: string;
  background: BackgroundId;
  visualQuality: string;
  selectPreset: (id: string) => void;
  setMasterVolume: (master: number) => void;
  setLayerProperty: <K extends keyof LayerConfig>(
    layer: Layer,
    key: K,
    value: LayerConfig[K],
  ) => void;
  setVisualsEnabled: (value: boolean) => void;
  setCustomColor: (value: string) => void;
  setBackground: (value: BackgroundId) => void;
  setVisualQuality: (value: string) => void;
}
export const usePreferences = create<Preferences>((set) => {
  const savedColor = readStoredPreference("omyra.color", "");
  return {
    settings: readStoredSettings(),
    visualsEnabled: readStoredPreference("omyra.visuals", "on") === "on",
    colorMode:
      readStoredPreference("omyra.colorMode", "fixed") === "drift"
        ? "drift"
        : "fixed",
    setColorMode: (colorMode) => set({ colorMode }),
    customColor: /^#[0-9a-f]{6}$/i.test(savedColor) ? savedColor : "",
    background: parseBackgroundId(
      readStoredPreference("omyra.background", "nebula"),
    ),
    visualQuality: readStoredPreference("omyra.quality", "balanced"),
    selectPreset: (id) =>
      set((s) => ({
        settings: { ...createPresetSettings(id), master: s.settings.master },
      })),
    setMasterVolume: (master) =>
      set((s) => ({ settings: { ...s.settings, master } })),
    setLayerProperty: (layer, key, value) =>
      set((s) => ({
        settings: {
          ...s.settings,
          layers: {
            ...s.settings.layers,
            [layer]: { ...s.settings.layers[layer], [key]: value },
          },
        },
      })),
    setVisualsEnabled: (visualsEnabled) => set({ visualsEnabled }),
    setCustomColor: (customColor) => set({ customColor, colorMode: "fixed" }),
    setBackground: (background) => set({ background }),
    setVisualQuality: (visualQuality) => set({ visualQuality }),
  };
});
// Keep the existing storage keys and validated hydration for saved installations.
usePreferences.subscribe((state, previous) => {
  try {
    if (state.settings !== previous.settings)
      localStorage.setItem("omyra.settings", JSON.stringify(state.settings));
    if (state.visualsEnabled !== previous.visualsEnabled)
      localStorage.setItem(
        "omyra.visuals",
        state.visualsEnabled ? "on" : "off",
      );
    if (state.colorMode !== previous.colorMode)
      localStorage.setItem("omyra.colorMode", state.colorMode);
    if (state.visualQuality !== previous.visualQuality)
      localStorage.setItem("omyra.quality", state.visualQuality);
    if (state.background !== previous.background)
      localStorage.setItem("omyra.background", state.background);
    if (state.customColor !== previous.customColor) {
      if (state.customColor)
        localStorage.setItem("omyra.color", state.customColor);
      else localStorage.removeItem("omyra.color");
    }
  } catch {
    /* Preferences remain usable when browser storage is unavailable. */
  }
});
export const selectCurrentPreset = (s: Preferences) =>
  presets.find((p) => p.id === s.settings.preset) ?? presets[0];
export const selectVisualColor = (s: Preferences) =>
  s.customColor || selectCurrentPreset(s).color;
