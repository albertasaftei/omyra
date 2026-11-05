# OMYRA

A browser-based procedural ambient instrument. React + TypeScript + Vite, Tone.js audio, and a selectable GLSL backgrounds rendered with React Three Fiber. No backend or prerecorded tracks.

## Run

```sh
npm install
npm run dev
```

`npm run build` creates the production bundle. `npm test` checks composer invariants.

`npm run lint` checks the code with Oxlint. `npm run lint:fix` applies automatic lint fixes. `npm run format` formats the project with Prettier; `npm run format:check` checks formatting without changing files.

Click Play to initialize audio. Five independently controlled layers generate major-pentatonic soundscapes. Four presets change tonal center, layer balance and activity. Preferences are saved locally. Visuals can be disabled completely or expanded into ambient display; Escape exits ambient mode. Low power, balanced and high rendering resolution are available.

## Architecture

`src/audio/` owns synthesis, clock scheduling, composition and settings types. It imports no UI or rendering modules. The UI sends configuration changes; the visualizer subscribes to musical events. Audio scheduling does not depend on animation frames. A shared effects chain and bounded synth voices avoid per-note node allocation.

## Status

Initial playable implementation. Automated composer checks and production build are included. Listening evaluation, real-device browser checks, background audio behavior, and a 60-minute CPU/memory session still require validation. Visual profiles currently vary resolution; finer shader/particle quality profiles and analyser-driven detail are future refinements. Continuous Pad/Drone/Air layers expose volume and enable controls; event activity controls apply to Bells and Particles.

### React composition and state

`src/state/preferences.ts` owns shared sound settings and visual preferences in Zustand. Components use selectors and named actions; multi-field selections use `useShallow`. The store preserves the existing localStorage keys and settings validation, and writes only changed preferences. Audio settings reach the engine through a subscription rather than a render-driven effect.

`App` composes `SoundControls` and `VisualPreferences`. `src/usePlayerSession.ts` owns the engine lifecycle, playback, elapsed time, visibility and fullscreen integration. These transient values stay local to the mounted session; sound controls consume shared settings directly. WebGL uniforms and musical event values remain renderer-owned resources.

The composition review found a single large component combining unrelated responsibilities, rather than boolean-prop or render-prop proliferation. Focused components and domain actions address that coupling without introducing a compound-component/context API for controls that have no variant consumers. React 19 is already in use, and no `forwardRef` migration is needed.
