import { useEffect, useState } from "react";
import { AudioEngine } from "./audio/AudioEngine";
import { startPresetPlaylist } from "./audio/presetPlaylist";
import { usePreferences } from "./state/preferences";
export function usePlayerSession() {
  const [audioEngine] = useState(
    () => new AudioEngine(usePreferences.getState().settings),
  );
  const [playbackStatus, setPlaybackStatus] = useState<
    "idle" | "starting" | "playing" | "paused"
  >("idle");
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [playbackError, setPlaybackError] = useState("");
  const [isAmbientDisplay, setAmbientDisplay] = useState(false);
  const [isPageHidden, setPageHidden] = useState(document.hidden);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  useEffect(() => {
    const unsubscribeState = audioEngine.subscribeState(() => {
      setPlaybackStatus(audioEngine.status);
      setPlaybackError(audioEngine.failure);
      setElapsedSeconds(Math.floor(audioEngine.elapsedSeconds));
    });
    audioEngine.apply(usePreferences.getState().settings);
    const unsubscribePreferences = usePreferences.subscribe(
      (state, previous) => {
        if (state.settings !== previous.settings)
          audioEngine.apply(state.settings);
      },
    );
    return () => {
      unsubscribeState();
      unsubscribePreferences();
    };
  }, [audioEngine]);
  useEffect(() => {
    const handleVisibilityChange = () => setPageHidden(document.hidden);
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAmbientDisplay(false);
        if (document.fullscreenElement)
          void document.exitFullscreen().catch(() => {});
      }
    };
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) setAmbientDisplay(false);
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      window.removeEventListener("keydown", handleEscape);
      audioEngine.dispose();
    };
  }, [audioEngine]);
  useEffect(() => {
    if (playbackStatus !== "playing") return;
    const id = setInterval(
      () => setElapsedSeconds(Math.floor(audioEngine.elapsedSeconds)),
      1000,
    );
    return () => clearInterval(id);
  }, [playbackStatus, audioEngine]);
  useEffect(() => {
    if (!shuffleEnabled) return;
    return startPresetPlaylist(audioEngine);
  }, [shuffleEnabled, audioEngine]);

  function toggleShuffle() {
    if (!shuffleEnabled) usePreferences.getState().selectRandomPreset();
    setShuffleEnabled(!shuffleEnabled);
  }

  async function togglePlayback() {
    if (playbackStatus === "playing") {
      audioEngine.pause();
      setPlaybackStatus("paused");
      return;
    }
    setPlaybackStatus("starting");
    setPlaybackError("");
    try {
      await audioEngine.start();
      setPlaybackStatus(audioEngine.status);
      setPlaybackError(audioEngine.failure);
    } catch {
      setPlaybackStatus("paused");
      setPlaybackError(
        "Audio could not start. Check your browser’s audio permissions and try again.",
      );
    }
  }
  async function toggleAmbientDisplay() {
    if (isAmbientDisplay) {
      setAmbientDisplay(false);
      if (document.fullscreenElement)
        await document.exitFullscreen().catch(() => {});
    } else {
      setAmbientDisplay(true);
      await document.documentElement.requestFullscreen?.().catch(() => {});
    }
  }
  return {
    audioEngine,
    shuffleEnabled,
    toggleShuffle,
    playbackStatus,
    playbackError,
    isAmbientDisplay,
    isPageHidden,
    elapsedSeconds,
    togglePlayback,
    toggleAmbientDisplay,
  };
}
