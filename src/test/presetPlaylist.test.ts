import { afterEach, describe, expect, it, vi } from "vitest";
import {
  startPresetPlaylist,
  PRESET_PLAYBACK_SECONDS,
} from "../audio/presetPlaylist";
import { presets } from "../audio/model";
import { usePreferences } from "../state/preferences";

const cleanups: (() => void)[] = [];
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("shuffle playlist", () => {
  it("always chooses another valid preset while preserving master volume", () => {
    usePreferences.getState().setMasterVolume(0.23);
    for (const random of [0, 0.5, 0.999999]) {
      vi.spyOn(Math, "random").mockReturnValue(random);
      for (const preset of presets) {
        usePreferences.getState().selectPreset(preset.id);
        usePreferences.getState().selectRandomPreset();
        const { settings } = usePreferences.getState();
        expect(settings.preset).not.toBe(preset.id);
        expect(presets.some((option) => option.id === settings.preset)).toBe(
          true,
        );
        expect(settings.master).toBe(0.23);
      }
    }
  });

  it("advances after three playback minutes and waits through pauses", () => {
    vi.useFakeTimers();
    const engine = {
      elapsedSeconds: 0,
      status: "playing" as "playing" | "paused",
    };
    const selectRandom = vi.spyOn(
      usePreferences.getState(),
      "selectRandomPreset",
    );
    cleanups.push(startPresetPlaylist(engine));
    engine.elapsedSeconds = PRESET_PLAYBACK_SECONDS - 1;
    vi.advanceTimersByTime(1000);
    expect(selectRandom).not.toHaveBeenCalled();
    engine.status = "paused";
    vi.advanceTimersByTime(600000);
    expect(selectRandom).not.toHaveBeenCalled();
    engine.status = "playing";
    engine.elapsedSeconds = PRESET_PLAYBACK_SECONDS;
    vi.advanceTimersByTime(1000);
    expect(selectRandom).toHaveBeenCalledTimes(1);
    engine.elapsedSeconds += PRESET_PLAYBACK_SECONDS;
    vi.advanceTimersByTime(1000);
    expect(selectRandom).toHaveBeenCalledTimes(2);
  });

  it("resets after manual selection and stops when disabled", () => {
    vi.useFakeTimers();
    const engine = { elapsedSeconds: 0, status: "playing" as const };
    const selectRandom = vi.spyOn(
      usePreferences.getState(),
      "selectRandomPreset",
    );
    const stop = startPresetPlaylist(engine);
    cleanups.push(stop);
    engine.elapsedSeconds = 150;
    const differentPreset = presets.find(
      (p) => p.id !== usePreferences.getState().settings.preset,
    )!;
    usePreferences.getState().selectPreset(differentPreset.id);
    engine.elapsedSeconds = 180;
    vi.advanceTimersByTime(1000);
    expect(selectRandom).not.toHaveBeenCalled();
    engine.elapsedSeconds = 330;
    vi.advanceTimersByTime(1000);
    expect(selectRandom).toHaveBeenCalledTimes(1);
    stop();
    engine.elapsedSeconds = 1000;
    vi.advanceTimersByTime(600000);
    expect(selectRandom).toHaveBeenCalledTimes(1);
  });
});
