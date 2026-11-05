import React from "react";
import { Pencil } from "lucide-react";
import { backgrounds, parseBackgroundId } from "../visualizer/backgrounds";
import { usePreferences, selectVisualColor } from "../state/preferences";
import { useShallow } from "zustand/react/shallow";
const backgroundColors = [
  { name: "Candlelight", value: "#c69b68" },
  { name: "Rosewood", value: "#b77e8c" },
  { name: "Lavender", value: "#9b8bc4" },
  { name: "Sage", value: "#8fa995" },
  { name: "Dusk", value: "#7d99b8" },
];
export function VisualPreferences() {
  const {
    visualsEnabled,
    customColor,
    colorMode,
    setColorMode,
    background,
    visualQuality,
    setVisualsEnabled,
    setCustomColor,
    setBackground,
    setVisualQuality,
  } = usePreferences(
    useShallow((s) => ({
      visualsEnabled: s.visualsEnabled,
      customColor: s.customColor,
      colorMode: s.colorMode,
      setColorMode: s.setColorMode,
      background: s.background,
      visualQuality: s.visualQuality,
      setVisualsEnabled: s.setVisualsEnabled,
      setCustomColor: s.setCustomColor,
      setBackground: s.setBackground,
      setVisualQuality: s.setVisualQuality,
    })),
  );
  const visualColor = usePreferences(selectVisualColor);
  return (
    <footer className="visual-preferences">
      <div className="visual-heading">
        <h2>BackgroundId settings</h2>
        <button
          className="quiet-button"
          aria-pressed={visualsEnabled}
          onClick={() => setVisualsEnabled(!visualsEnabled)}
        >
          <span
            className={visualsEnabled ? "visual-dot active" : "visual-dot"}
          />
          Visuals {visualsEnabled ? "on" : "off"}
        </button>
      </div>
      {visualsEnabled && (
        <div className="visual-controls">
          <label className="background-choice">
            <span>BackgroundId</span>
            <select
              aria-label="Background"
              value={background}
              onChange={(e) => setBackground(parseBackgroundId(e.target.value))}
            >
              {backgrounds.map((backgroundOption) => (
                <option key={backgroundOption.id} value={backgroundOption.id}>
                  {backgroundOption.name}
                </option>
              ))}
            </select>
          </label>
          <label className="color-mode-choice">
            <span>Color mode</span>
            <select
              aria-label="Color mode"
              value={colorMode}
              onChange={(event) =>
                setColorMode(event.target.value === "drift" ? "drift" : "fixed")
              }
            >
              <option value="fixed">Fixed</option>
              <option value="drift">Drift</option>
            </select>
          </label>
          <div className="palette-row">
            <span className="preference-label">Color</span>
            <div className="palette-options">
              <div
                className="color-palette"
                role="group"
                aria-label="Cozy background colors"
              >
                {backgroundColors.map((color) => (
                  <button
                    key={color.value}
                    className="color-swatch"
                    aria-label={color.name}
                    title={color.name}
                    aria-pressed={
                      colorMode === "fixed" &&
                      customColor.toLowerCase() === color.value
                    }
                    onClick={() => setCustomColor(color.value)}
                    style={{ "--swatch": color.value } as React.CSSProperties}
                  >
                    <span />
                  </button>
                ))}
              </div>
              <label className="color-choice" title="Choose a custom color">
                <span
                  className="custom-color-icon"
                  style={{ "--swatch": visualColor } as React.CSSProperties}
                >
                  <Pencil size={13} strokeWidth={1.7} aria-hidden="true" />
                </span>
                <input
                  type="color"
                  aria-label="Choose a custom background color"
                  value={visualColor}
                  onChange={(e) => setCustomColor(e.target.value)}
                />
              </label>
            </div>
          </div>
          <label className="quality-choice">
            <span>Quality</span>
            <select
              aria-label="Visual quality"
              value={visualQuality}
              onChange={(e) => setVisualQuality(e.target.value)}
            >
              <option value="low">Low power</option>
              <option value="balanced">Balanced</option>
              <option value="high">High visualQuality</option>
            </select>
          </label>
        </div>
      )}
      <span className="footer-description">Composed in the moment.</span>
    </footer>
  );
}
