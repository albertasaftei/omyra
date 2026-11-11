import { describe, it, expect } from "vitest";
import { Composer, VOICE_LIMITS } from "../audio/Composer";
import { Performance } from "../audio/Performance";
import { createPresetSettings, presets } from "../audio/model";
import { evolution } from "../audio/evolution";
import { identities } from "../audio/identities";

describe("seeded composition", () => {
  for (const preset of presets) {
    it(`${preset.id}: reproducible, evolving and harmonically bounded`, () => {
      const settings = createPresetSettings(preset.id);
      const a = new Composer(preset.id, 42),
        b = new Composer(preset.id, 42),
        c = new Composer(preset.id, 84);
      const first = [],
        other = [];
      for (let i = 0; i < 32; i++) {
        const plan = a.next(settings);
        first.push(plan);
        other.push(c.next(settings));
        expect(plan).toEqual(b.next(settings));
        expect(plan.events.length).toBeLessThanOrEqual(256);
        if (i % 4 === 0) {
          expect(plan.transformation).toBe(null);
          expect(plan.motif).toEqual(
            a.profile.pulse?.pattern ?? identities[preset.id].motif,
          );
        }
        const pitchClasses = plan.chord.map((n) => ((n % 12) + 12) % 12);
        for (const e of plan.events) {
          expect(e.duration).toBeGreaterThan(0);
          expect(e.time).toBeGreaterThanOrEqual(plan.start);
          expect(e.time).toBeLessThan(plan.start + plan.duration);
          if (e.layer === "particles" || e.layer === "drone")
            expect(pitchClasses).toContain(
              (((e.midi - preset.root) % 12) + 12) % 12,
            );
          if (e.layer === "bells") {
            expect(e.midi - preset.root).toBeGreaterThanOrEqual(
              evolution[preset.id].register[0],
            );
            expect(e.midi - preset.root).toBeLessThanOrEqual(
              evolution[preset.id].register[1],
            );
            const pulse = a.profile.pulse;
            if (pulse) {
              const step =
                Math.round((e.time - plan.start) / pulse.step) %
                pulse.pattern.length;
              expect(pulse.rests ?? []).not.toContain(step);
            }
          }
        }
        for (const value of Object.values(plan.dynamics)) {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(1);
        }
      }
      expect(first).not.toEqual(other);
      expect(new Set(first.map((p) => p.section)).size).toBe(4);
      expect(first.some((p) => p.transformation !== null)).toBe(true);
      for (let i = 2; i < first.length; i++)
        expect(
          JSON.stringify(first[i].chord) ===
            JSON.stringify(first[i - 1].chord) &&
            JSON.stringify(first[i - 1].chord) ===
              JSON.stringify(first[i - 2].chord),
        ).toBe(false);
    });
  }
  it("never emits notes for disabled layers or zero lead/particle activity", () => {
    for (const preset of presets) {
      const s = createPresetSettings(preset.id);
      for (const layer of Object.values(s.layers)) layer.enabled = false;
      expect(new Composer(preset.id, 1).next(s).events).toEqual([]);
      s.layers.bells.enabled = true;
      s.layers.bells.density = 0;
      s.layers.particles.enabled = true;
      s.layers.particles.density = 0;
      expect(new Composer(preset.id, 1).next(s).events).toEqual([]);
    }
  });
  it("planning and repeated reads do not advance state on pause", () => {
    const s = createPresetSettings("starward");
    const c = new Composer("starward", 42);
    const p = new Performance(c, s);
    const before = c.diagnostics();
    const events = p.between(1, 2, s);
    expect(p.between(1, 2, s)).toEqual(events);
    expect(c.diagnostics()).toEqual(before);
    expect(
      p.sustaining(2, s).every((e) => e.time === 2 && e.duration > 0),
    ).toBe(true);
  });
});

describe("accelerated 24-hour composition endurance", () => {
  for (const preset of presets)
    it(`${preset.id}: 3 seeds with bounded histories, plans and tails`, () => {
      for (const seed of [1, 42, 987]) {
        const settings = createPresetSettings(preset.id);
        settings.layers.bells.density = 1;
        settings.layers.particles.density = 1;
        const composer = new Composer(preset.id, seed);
        const performance = new Performance(composer, settings);
        let previous = "",
          repeats = 0;
        const sections = new Set();
        for (let time = 0; time < 86400; time += composer.profile.phrase) {
          const p = performance.at(time, settings);
          const key = JSON.stringify(p.chord);
          repeats = key === previous ? repeats + 1 : 1;
          previous = key;
          if (repeats > 2) throw new Error("Repeated harmony beyond limit");
          sections.add(p.section);
          const d = performance.diagnostics();
          if (
            d.plans !== 2 ||
            d.events > 512 ||
            d.notes > 64 ||
            d.chords > 16 ||
            d.motifs > 4
          )
            throw new Error("Unbounded composer");
          for (const [voice, count] of Object.entries(d.occupied))
            if (count > VOICE_LIMITS[voice as keyof typeof VOICE_LIMITS])
              throw new Error("Polyphony exceeded");
          if (
            p.events.some(
              (e) =>
                !Number.isFinite(e.time + e.duration + e.midi + e.velocity),
            )
          )
            throw new Error("Invalid event");
        }
        expect(sections.size).toBe(4);
      }
    }, 60000);
});
