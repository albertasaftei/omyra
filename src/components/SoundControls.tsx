import { Select } from "./Select";
import {
  Volume2,
  Shuffle,
  ChevronLeft,
  ChevronRight,
  Waves,
  Bell,
  Radio,
  Wind,
  Orbit,
} from "lucide-react";
import { layers, presets, presetCategories } from "../audio/model";
import { usePreferences, selectCurrentPreset } from "../state/preferences";
import { useShallow } from "zustand/react/shallow";
const layerMetadataById = {
  pad: { name: "Pad", detail: "Slow, unfolding harmonies", icon: Waves },
  bells: { name: "Bells", detail: "Little moments of light", icon: Bell },
  drone: { name: "Drone", detail: "A grounding undertone", icon: Radio },
  air: { name: "Air", detail: "A breath of atmosphere", icon: Wind },
  particles: {
    name: "Particles",
    detail: "Distant, delicate echoes",
    icon: Orbit,
  },
};
export function SoundControls({
  shuffleEnabled,
  onToggleShuffle,
}: {
  shuffleEnabled: boolean;
  onToggleShuffle: () => void;
}) {
  const { settings, setLayerProperty, setMasterVolume, selectPreset } =
    usePreferences(
      useShallow((s) => ({
        settings: s.settings,
        setLayerProperty: s.setLayerProperty,
        setMasterVolume: s.setMasterVolume,
        selectPreset: s.selectPreset,
      })),
    );
  const preset = usePreferences(selectCurrentPreset);
  const presetIndex = presets.findIndex(
    (presetOption) => presetOption.id === preset.id,
  );
  function stepPreset(direction: number) {
    selectPreset(
      presets[(presetIndex + direction + presets.length) % presets.length].id,
    );
  }
  return (
    <>
      {" "}
      <section className="soundscapes" aria-label="Choose a soundscape">
        <div className="preset-picker">
          <div className="preset-select">
            <span className="preset-label">Soundscape</span>
            <Select
              label="Soundscape"
              value={preset.id}
              onChange={selectPreset}
              options={presets.map((p) => ({
                value: p.id,
                label: p.name,
                group: presetCategories[p.category],
              }))}
            />
          </div>
          <div className="preset-navigation">
            <button
              className={`preset-step shuffle-button ${shuffleEnabled ? "is-active" : ""}`}
              aria-label="Shuffle playlist"
              aria-pressed={shuffleEnabled}
              aria-describedby="shuffle-help"
              title="Random soundscape every 3 minutes of playback"
              onClick={onToggleShuffle}
            >
              <Shuffle size={17} strokeWidth={1.4} />
              <span className="sr-only">Shuffle playlist</span>
            </button>
            <button
              className="preset-step"
              aria-label="Previous soundscape"
              onClick={() => stepPreset(-1)}
            >
              <ChevronLeft size={18} strokeWidth={1.4} />
            </button>
            <button
              className="preset-step"
              aria-label="Next soundscape"
              onClick={() => stepPreset(1)}
            >
              <ChevronRight size={18} strokeWidth={1.4} />
            </button>
          </div>
        </div>
        <p id="shuffle-help" className="shuffle-help" aria-live="polite">
          {shuffleEnabled
            ? "Shuffle on · a new soundscape every 3 minutes of playback"
            : "Shuffle off"}
        </p>
      </section>
      <div className="control-bar">
        <div className="master">
          <Volume2 size={17} strokeWidth={1.4} />
          <input
            aria-label="Master volume"
            type="range"
            min="0"
            max="1"
            step=".01"
            value={settings.master}
            onChange={(e) => setMasterVolume(+e.target.value)}
          />
          <output>{Math.round(settings.master * 100)}%</output>
        </div>
      </div>
      <section
        id="sound-controls"
        className="sound-controls"
        aria-label="Sound layers"
      >
        <div className="panel-heading">
          <h2>Sound layers</h2>
        </div>
        <div className="layer-list">
          {layers.map((layer) => {
            const layerMetadata = layerMetadataById[layer],
              Icon = layerMetadata.icon,
              layerConfig = settings.layers[layer];
            return (
              <div className="layer" key={layer}>
                <button
                  role="switch"
                  aria-checked={layerConfig.enabled}
                  aria-label={`Enable ${layerMetadata.name}`}
                  className={`layer-toggle ${layerConfig.enabled ? "enabled" : ""}`}
                  onClick={() =>
                    setLayerProperty(layer, "enabled", !layerConfig.enabled)
                  }
                >
                  <Icon size={19} strokeWidth={1.3} />
                  <span>{layerMetadata.name}</span>
                  <span className="toggle-state">
                    {layerConfig.enabled ? "On" : "Off"}
                  </span>
                </button>
                <label className="layer-volume">
                  <span className="sr-only">{layerMetadata.name} volume</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step=".01"
                    value={layerConfig.volume}
                    onChange={(e) =>
                      setLayerProperty(layer, "volume", +e.target.value)
                    }
                  />
                  <output>{Math.round(layerConfig.volume * 100)}%</output>
                </label>
                {layer === "bells" || layer === "particles" ? (
                  <label className="density">
                    Activity
                    <input
                      aria-label={`${layerMetadata.name} density`}
                      type="range"
                      min="0"
                      max="1"
                      step=".01"
                      value={layerConfig.density}
                      onChange={(e) =>
                        setLayerProperty(layer, "density", +e.target.value)
                      }
                    />
                  </label>
                ) : (
                  <span className="layer-detail">{layerMetadata.detail}</span>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
