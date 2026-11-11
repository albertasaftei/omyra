import React, { Component, Suspense, lazy } from "react";
import { Play, Pause, Maximize2, Minimize2 } from "lucide-react";
import { usePlayerSession } from "./usePlayerSession";
import {
  usePreferences,
  selectCurrentPreset,
  selectVisualColor,
} from "./state/preferences";
import { SoundControls } from "./components/SoundControls";
import { VisualPreferences } from "./components/VisualPreferences";
import "./styles.css";
const BackgroundVisualizer = lazy(
  () => import("./visualizer/BackgroundVisualizer"),
);
class VisualizerErrorBoundary extends Component<
  { children: React.ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFailure();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
export default function App() {
  const {
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
  } = usePlayerSession();
  const visualColor = usePreferences(selectVisualColor);
  const preset = usePreferences(selectCurrentPreset);
  const visualsEnabled = usePreferences((s) => s.visualsEnabled);
  const colorMode = usePreferences((s) => s.colorMode);
  const visualQuality = usePreferences((s) => s.visualQuality);
  const background = usePreferences((s) => s.background);
  const setVisualsEnabled = usePreferences((s) => s.setVisualsEnabled);
  return (
    <main
      className={isAmbientDisplay ? "app ambient" : "app"}
      style={{ "--accent": visualColor } as React.CSSProperties}
    >
      <div className="atmosphere" aria-hidden="true">
        {visualsEnabled && (
          <VisualizerErrorBoundary onFailure={() => setVisualsEnabled(false)}>
            <Suspense fallback={null}>
              <BackgroundVisualizer
                engine={audioEngine}
                color={visualColor}
                colorMode={colorMode}
                visualQuality={visualQuality}
                background={background}
                paused={isPageHidden}
              />
            </Suspense>
          </VisualizerErrorBoundary>
        )}
      </div>
      <header className="site-header">
        <a className="wordmark" href="/" aria-label="OMYRA home">
          OMYRA
        </a>
        <span className="brand-description">Generative ambient sound</span>
        <button
          className="quiet-button display-button"
          onClick={toggleAmbientDisplay}
          aria-label={
            isAmbientDisplay ? "Exit ambient display" : "Enter ambient display"
          }
        >
          {isAmbientDisplay ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          <span>{isAmbientDisplay ? "Exit display" : "Ambient display"}</span>
        </button>
      </header>
      <section className="listening" aria-label="Soundscape player">
        <div className="soundscape-copy" key={preset.id}>
          <h1>{preset.name}</h1>
          <p className="description">{preset.description}</p>
        </div>
        <button
          className={`play-button ${playbackStatus === "playing" ? "is-playing" : ""}`}
          onClick={togglePlayback}
          disabled={playbackStatus === "starting"}
          aria-label={
            playbackStatus === "playing"
              ? "Pause soundscape"
              : "Play soundscape"
          }
        >
          <span className="play-icon" aria-hidden="true">
            <Play size={22} fill="currentColor" strokeWidth={1} />
          </span>
          <span className="pause-icon" aria-hidden="true">
            <Pause size={22} fill="currentColor" strokeWidth={1} />
          </span>
        </button>
        <div className="play-state" aria-live="polite">
          {playbackStatus === "starting"
            ? "Starting…"
            : playbackStatus === "playing"
              ? "Playing"
              : playbackStatus === "paused"
                ? "Paused"
                : "Press play to begin"}
          {elapsedSeconds > 0 && (
            <span className="elapsed">
              {Math.floor(elapsedSeconds / 60)
                .toString()
                .padStart(2, "0")}
              :{(elapsedSeconds % 60).toString().padStart(2, "0")}
            </span>
          )}
        </div>
        {playbackError && (
          <p className="error" role="alert">
            {playbackError}
          </p>
        )}
      </section>
      <div className="console">
        <SoundControls
          shuffleEnabled={shuffleEnabled}
          onToggleShuffle={toggleShuffle}
        />
        <VisualPreferences />
      </div>
    </main>
  );
}
