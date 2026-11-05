import { identities } from "../audio/identities";
import {
  cinematicStep,
  getSoundscape,
  soundscapes,
} from "../audio/soundscapes";
import { describe, it, expect } from "vitest";
import {
  NoteGenerator,
  pentatonic,
  createPresetSettings,
  presets,
  layers,
} from "../audio/model";
describe("procedural composer", () => {
  it("stays in the scale and avoids consecutive repetitions", () => {
    const g = new NoteGenerator();
    let previous = -1;
    for (let i = 0; i < 1000; i++) {
      const n = g.next(48);
      expect(pentatonic).toContain(n - 48);
      expect(n).not.toBe(previous);
      previous = n;
    }
  });
  it("supports transposition and octaves", () => {
    const g = new NoteGenerator(() => 0);
    expect(pentatonic).toContain(g.next(55, 2) - 55 - 24);
  });
  it("creates independent complete preset configurations", () => {
    for (const p of presets) {
      const a = createPresetSettings(p.id),
        b = createPresetSettings(p.id);
      expect(Object.keys(a.layers)).toEqual([...layers]);
      a.layers.pad.volume = 0;
      expect(b.layers.pad.volume).toBeGreaterThan(0);
    }
  });
});

describe("settings recovery", () => {
  it("uses a known preset for an unknown identifier", () => {
    expect(createPresetSettings("unknown").preset).toBe("ethereal");
  });
});

describe("soundscape harmony", () => {
  it("keeps melodies in each preset's own scale through octave shifts", () => {
    for (const preset of presets) {
      const profile = getSoundscape(preset.id);
      const generator = new NoteGenerator();
      let previous = -1;
      for (let i = 0; i < 100; i++) {
        const note = generator.next(
          preset.root,
          profile.bellOctave,
          profile.scale,
        );
        expect(profile.scale).toContain(
          note - preset.root - 12 * profile.bellOctave,
        );
        expect(note).not.toBe(previous);
        previous = note;
      }
    }
  });
  it("provides a distinct voice and harmony profile for every selectable preset", () => {
    expect(presets.map((p) => p.id).sort()).toEqual(
      Object.keys(soundscapes).sort(),
    );
    expect(
      new Set(presets.map((p) => JSON.stringify(getSoundscape(p.id)))).size,
    ).toBe(presets.length);
  });
});

describe("cinematic phrases", () => {
  for (const [id, profile] of Object.entries(soundscapes).filter(
    ([, p]) => p.pulse,
  )) {
    it(`${id} aligns its bass, harmony and arpeggio across a full progression`, () => {
      const pulse = profile.pulse!;
      const steps = pulse.pattern.length * pulse.bars;
      expect(steps * pulse.step).toBe(profile.phrase);
      for (let step = 0; step < steps * profile.chords.length; step++) {
        const event = cinematicStep(profile, step, 1);
        expect(event.chord).toContain(event.interval - (pulse.octave ?? 12));
        expect(event.phraseStart).toBe(step % steps === 0);
        expect(event.chord).toEqual(profile.chords[Math.floor(step / steps)]);
        expect(event.velocity).toBeGreaterThan(0);
        expect(event.velocity).toBeLessThanOrEqual(0.5);
      }
      expect(
        cinematicStep(profile, steps * profile.chords.length, 1).chord,
      ).toEqual(profile.chords[0]);
    });
    it(`${id} thins activity without changing the harmonic clock`, () => {
      const counts = [0, 0.2, 0.5, 1].map(
        (density) =>
          Array.from({ length: 32 }, (_, step) =>
            cinematicStep(profile, step, density),
          ).filter((e) => e.active).length,
      );
      expect(counts).toEqual([0, 8, 16, 32]);
      expect(cinematicStep(profile, 20, 0).chord).toEqual(
        cinematicStep(profile, 20, 1).chord,
      );
    });
  }
});

describe("preset arrangement separation", () => {
  it("keeps all voices within the polyphony budget at maximum activity", () => {
    expect(Object.keys(identities).sort()).toEqual(
      presets.map((p) => p.id).sort(),
    );
    for (const preset of presets) {
      const p = getSoundscape(preset.id);
      const v = identities[preset.id];
      const notes = Math.max(...p.chords.map((c) => c.length));
      expect(
        notes *
          Math.ceil((v.padHold + p.release + v.strum * (notes - 1)) / p.phrase),
      ).toBeLessThanOrEqual(12);
      const gap = p.pulse?.step ?? Math.min(...v.gaps) * 0.4;
      expect(Math.ceil((v.leadHold + v.leadRelease) / gap)).toBeLessThanOrEqual(
        8,
      );
      expect(v.motif.every((n) => n >= 0 && n < p.scale.length)).toBe(true);
    }
  });
  it("separates the previously overlapping rhythmic pairs in pitch, rhythm and voice", () => {
    for (const [a, b] of [
      ["orbital", "momentum"],
      ["starward", "gravity"],
      ["starward", "distant-suns"],
      ["momentum", "supernova"],
    ]) {
      const x = getSoundscape(a),
        y = getSoundscape(b);
      expect(x.chords).not.toEqual(y.chords);
      expect(x.pulse).not.toEqual(y.pulse);
      expect([
        identities[a].lead,
        identities[a].leadHold,
        identities[a].delayWet,
      ]).not.toEqual([
        identities[b].lead,
        identities[b].leadHold,
        identities[b].delayWet,
      ]);
    }
  });
  it("preserves authored rests even at full activity", () => {
    for (const p of Object.values(soundscapes).filter(
      (p) => p.pulse?.rests?.length,
    )) {
      for (const rest of p.pulse!.rests!) {
        expect(cinematicStep(p, rest, 1).voiced).toBe(false);
      }
      expect(cinematicStep(p, 0, 1).voiced).toBe(true);
    }
  });
});
