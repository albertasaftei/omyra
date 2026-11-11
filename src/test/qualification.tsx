/** Development-only browser entry, not imported by the application build. */
import * as Tone from "tone";
import { createRoot } from "react-dom/client";
import { Composer } from "../audio/Composer";
import { VoiceRack } from "../audio/VoiceRack";
import { AudioEngine } from "../audio/AudioEngine";
import { createPresetSettings, presets, layers } from "../audio/model";
import BackgroundVisualizer from "../visualizer/BackgroundVisualizer";
import { backgrounds } from "../visualizer/backgrounds";
const status = document.querySelector("#status")!;
const previews = document.querySelector("#previews")!;
const visualRoot = createRoot(document.querySelector("#visuals")!);
let engine: AudioEngine | undefined;
let timer: ReturnType<typeof setInterval> | undefined;
let started = 0,
  stage = -1;
let urls: string[] = [];
let rendering = false;
const errors: string[] = [];
window.addEventListener("error", (e) => {
  errors.push(e.message);
  if (errors.length > 32) errors.shift();
});
window.addEventListener("unhandledrejection", (e) => {
  errors.push(String(e.reason));
  if (errors.length > 32) errors.shift();
});
function wav(buffer: Tone.ToneAudioBuffer) {
  const data = buffer.getChannelData(0),
    bytes = new ArrayBuffer(44 + data.length * 2),
    view = new DataView(bytes);
  const str = (offset: number, s: string) =>
    [...s].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  str(0, "RIFF");
  view.setUint32(4, 36 + data.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  str(36, "data");
  view.setUint32(40, data.length * 2, true);
  let power = 0,
    peak = 0;
  for (const x of data) {
    power += x * x;
    peak = Math.max(peak, Math.abs(x));
  }
  const rms = Math.sqrt(power / data.length);
  const gain = Math.min(0.08 / Math.max(rms, 1e-8), 0.8 / Math.max(peak, 1e-8));
  data.forEach((x, i) =>
    view.setInt16(
      44 + i * 2,
      Math.max(-32768, Math.min(32767, x * gain * 32767)),
      true,
    ),
  );
  return {
    url: URL.createObjectURL(new Blob([bytes], { type: "audio/wav" })),
    peak,
    rms,
  };
}
document.querySelector("#render")!.addEventListener("click", async () => {
  if (rendering || engine) return;
  rendering = true;
  status.textContent = "";
  previews.replaceChildren();
  urls.forEach(URL.revokeObjectURL);
  urls = [];
  try {
    for (const preset of presets) {
      const settings = createPresetSettings(preset.id),
        composer = new Composer(preset.id, 42);
      const plans = Array.from({ length: 4 }, () => composer.next(settings));
      let rack: VoiceRack | undefined;
      try {
        const buffer = await Tone.Offline(
          async () => {
            rack = new VoiceRack(preset.id, Tone.getDestination());
            await rack.ready;
            rack.output.gain.value = settings.master;
            for (const plan of plans) {
              for (const layer of layers)
                rack.buses[layer].gain.setValueAtTime(
                  settings.layers[layer].volume * plan.dynamics[layer],
                  plan.start,
                );
              for (const event of plan.events)
                rack.play(event, event.time + 0.05);
            }
          },
          composer.profile.phrase * 4 + 16,
          2,
          22050,
        );
        const result = wav(buffer);
        urls.push(result.url);
        status.textContent += `${preset.id}: ${Number.isFinite(result.rms) && result.rms > 0 && result.peak < 1 ? "PASS" : "FAIL"} peak=${result.peak.toFixed(5)} rms=${result.rms.toFixed(5)}\n`;
        const label = document.createElement("p");
        label.textContent = preset.name + " — matched RMS preview";
        const player = document.createElement("audio");
        player.controls = true;
        player.src = result.url;
        previews.append(label, player);
        buffer.dispose();
      } catch (error) {
        status.textContent += `${preset.id}: ERROR ${String(error)}\n`;
      } finally {
        rack?.dispose();
      }
    }
    status.textContent += "RENDERS COMPLETE";
  } finally {
    rendering = false;
  }
});
function draw() {
  if (!engine) return;
  const i = Math.max(0, stage);
  visualRoot.render(
    <BackgroundVisualizer
      engine={engine}
      color="#8179b9"
      colorMode="drift"
      visualQuality="balanced"
      background={backgrounds[i % backgrounds.length].id}
      paused={document.hidden}
    />,
  );
}
document.addEventListener("visibilitychange", draw);
function stop() {
  if (timer) clearInterval(timer);
  timer = undefined;
  engine?.pause();
  status.textContent += "\nENDURANCE STOPPED (not a pass)";
}
document.querySelector("#endurance")!.addEventListener("click", async () => {
  if (rendering || timer) return;
  engine?.dispose();
  engine = new AudioEngine(createPresetSettings("supernova"), 42);
  await engine.start();
  if (engine.status !== "playing") {
    status.textContent = engine.failure;
    return;
  }
  started = performance.now();
  stage = 0;
  draw();
  timer = setInterval(() => {
    if (!engine) return;
    const seconds = (performance.now() - started) / 1000;
    // First 12h: continuous high-activity scene. Next 12h: alternate hourly.
    const nextStage =
      seconds < 43200 ? 0 : 1 + Math.floor((seconds - 43200) / 3600);
    if (nextStage !== stage) {
      stage = nextStage;
      engine.apply(
        createPresetSettings(presets[(stage - 1) % presets.length].id),
      );
      draw();
    }
    status.textContent = JSON.stringify(
      {
        seconds,
        target: 86400,
        browser: navigator.userAgent,
        cores: navigator.hardwareConcurrency,
        hidden: document.hidden,
        errors,
        ...engine.diagnostics(),
      },
      null,
      2,
    );
    if (seconds >= 86400) {
      if (timer) clearInterval(timer);
      timer = undefined;
      engine.pause();
      status.textContent +=
        "\n24 HOURS ELAPSED — review diagnostics and listening evidence before acceptance";
    }
  }, 1000);
});
document.querySelector("#stop")!.addEventListener("click", stop);
document.querySelector("#export")!.addEventListener("click", () => {
  if (!engine) return;
  const url = URL.createObjectURL(
    new Blob(
      [
        JSON.stringify({
          started,
          browser: navigator.userAgent,
          errors,
          diagnostics: JSON.parse(engine.exportDiagnostics()),
        }),
      ],
      { type: "application/json" },
    ),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "omyra-endurance.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
window.addEventListener(
  "pagehide",
  () => {
    if (timer) clearInterval(timer);
    engine?.dispose();
    urls.forEach(URL.revokeObjectURL);
    visualRoot.unmount();
  },
  { once: true },
);
