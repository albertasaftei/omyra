import React from "react";
import { Select } from "./Select";
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
        <h2>Background settings</h2>
        <button
          className="quiet-button"
          aria-pressed={visualsEnabled}
          aria-controls="visual-settings"
          onClick={() => setVisualsEnabled(!visualsEnabled)}
        >
          <span
            className={visualsEnabled ? "visual-dot active" : "visual-dot"}
          />
          Visuals {visualsEnabled ? "on" : "off"}
        </button>
      </div>
      <div
        id="visual-settings"
        className="visual-settings-disclosure"
        data-open={visualsEnabled}
        inert={!visualsEnabled}
      >
        <div className="visual-settings-clip">
          <div className="visual-controls">
            <div className="background-choice">
              <span>Background</span>
              <Select
                label="Background"
                value={background}
                onChange={(value) => setBackground(parseBackgroundId(value))}
                options={backgrounds.map((b) => ({
                  value: b.id,
                  label: b.name,
                }))}
              />
            </div>
            <div className="color-mode-choice">
              <span>Color mode</span>
              <Select
                label="Color mode"
                value={colorMode}
                onChange={(value) =>
                  setColorMode(value === "drift" ? "drift" : "fixed")
                }
                options={[
                  { value: "fixed", label: "Fixed" },
                  { value: "drift", label: "Drift" },
                ]}
              />
            </div>
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
            <div className="quality-choice">
              <span>Quality</span>
              <Select
                label="Visual quality"
                value={visualQuality}
                onChange={setVisualQuality}
                options={[
                  { value: "low", label: "Low power" },
                  { value: "balanced", label: "Balanced" },
                  { value: "high", label: "High quality" },
                ]}
              />
            </div>
          </div>
        </div>
      </div>
      <span className="footer-description">Composed in the moment.</span>
    </footer>
  );
}
