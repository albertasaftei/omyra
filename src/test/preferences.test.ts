import { afterEach, describe, expect, it, vi } from "vitest";

async function preferences(saved: Record<string, string> = {}) {
  vi.resetModules();
  const storage = new Map(Object.entries(saved));
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  const { usePreferences } = await import("../state/preferences");
  return { store: usePreferences, storage };
}

afterEach(() => vi.unstubAllGlobals());

describe("preferences store", () => {
  it("preserves master volume when presets replace customized layers", async () => {
    const { store, storage } = await preferences();
    store.getState().setMasterVolume(0.23);
    store.getState().setLayerProperty("bells", "enabled", false);
    store.getState().selectPreset("zen");
    const { settings } = store.getState();
    expect(settings.master).toBe(0.23);
    expect(settings.preset).toBe("zen");
    expect(settings.layers.bells.enabled).toBe(true);
    expect(JSON.parse(storage.get("omyra.settings")!)).toEqual(settings);
  });

  it("updates one layer without mutating existing snapshots or unrelated layers", async () => {
    const { store } = await preferences();
    const before = store.getState().settings;
    store.getState().setLayerProperty("bells", "density", 0.12);
    expect(store.getState().settings.layers.bells.density).toBe(0.12);
    expect(before.layers.bells.density).toBe(0.45);
    expect(store.getState().settings.layers.pad).toBe(before.layers.pad);
  });

  it("recovers legacy preferences and persists color resets", async () => {
    const { store, storage } = await preferences({
      "omyra.settings": JSON.stringify({ preset: "zen", master: 9 }),
      "omyra.color": "#abcdef",
      "omyra.visuals": "off",
      "omyra.background": "unknown",
    });
    expect(store.getState().settings.master).toBe(1);
    expect(store.getState().settings.preset).toBe("zen");
    expect(store.getState().visualsEnabled).toBe(false);
    expect(store.getState().background).toBe("nebula");
    expect(store.getState().customColor).toBe("#abcdef");
    store.getState().setCustomColor("");
    expect(storage.has("omyra.color")).toBe(false);
  });

  it("remains usable when browser storage throws", async () => {
    const { store } = await preferences();
    vi.stubGlobal("localStorage", {
      setItem: () => {
        throw new Error("Storage unavailable");
      },
    });
    expect(() => store.getState().setMasterVolume(0.4)).not.toThrow();
    expect(store.getState().settings.master).toBe(0.4);
  });
});
