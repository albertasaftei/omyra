# OMYRA

A browser-based generative ambient instrument. React + TypeScript + Vite, Tone.js audio, and selectable GLSL backgrounds rendered with React Three Fiber. No backend or prerecorded tracks.


## Architecture

`src/audio/` owns synthesis, clock scheduling, composition and settings types. It imports no UI or rendering modules. The UI sends configuration changes; the visualizer subscribes to musical events. Audio scheduling does not depend on animation frames. A shared effects chain and bounded synth voices avoid per-note node allocation.


### React composition and state

`src/state/preferences.ts` owns shared sound settings and visual preferences in Zustand. Components use selectors and named actions; multi-field selections use `useShallow`. The store preserves the existing localStorage keys and settings validation, and writes only changed preferences. Audio settings reach the engine through a subscription rather than a render-driven effect.

`App` composes `SoundControls` and `VisualPreferences`. `src/usePlayerSession.ts` owns the engine lifecycle, playback, elapsed time, visibility and fullscreen integration. These transient values stay local to the mounted session; sound controls consume shared settings directly. WebGL uniforms and musical event values remain renderer-owned resources.

The composition review found a single large component combining unrelated responsibilities, rather than boolean-prop or render-prop proliferation. Focused components and domain actions address that coupling without introducing a compound-component/context API for controls that have no variant consumers. React 19 is already in use, and no `forwardRef` migration is needed.

### Generative composition and resource bounds

`Composer` is pure TypeScript with injected seeded randomness. `Performance` holds
only current/next plans (256 events per plan). It retains at most 64 note-history
entries, 16 chord choices, and four 16-step motifs. Each preset's `evolution`
rules specify transformations, probabilities, register and four section levels.
The first phrase establishes the original motif, which returns every fourth
phrase. Existing chord vocabularies keep the tonal center recognizable.

The engine schedules only the next 50 ms from each audio-clock callback (plus
Tone's lookahead), rebuilds voices after pause to cancel queued note starts,
and serializes asynchronous rack initialization. At most one active, one fading,
and one pending rack are retained. Diagnostics keep at most 1,440 minute samples;
the export includes optional Chromium heap metrics, resource counts and browser
metadata. Safari's unavailable heap metric is recorded as null, not zero.
Composition state and audio are never written to local storage.
