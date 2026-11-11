import type { AudioEngine } from "./AudioEngine";
import { usePreferences } from "../state/preferences";

export const PRESET_PLAYBACK_SECONDS = 180;

/** Advance on the audio clock so pauses also pause the playlist countdown. */
export function startPresetPlaylist(
  engine: Pick<AudioEngine, "elapsedSeconds" | "status">,
) {
  let nextSwitch = engine.elapsedSeconds + PRESET_PLAYBACK_SECONDS;
  const unsubscribe = usePreferences.subscribe((state, previous) => {
    if (state.settings.preset !== previous.settings.preset) {
      nextSwitch = engine.elapsedSeconds + PRESET_PLAYBACK_SECONDS;
    }
  });
  const timer = setInterval(() => {
    if (engine.status !== "playing" || engine.elapsedSeconds < nextSwitch)
      return;
    usePreferences.getState().selectRandomPreset();
    nextSwitch = engine.elapsedSeconds + PRESET_PLAYBACK_SECONDS;
  }, 1000);

  return () => {
    clearInterval(timer);
    unsubscribe();
  };
}
