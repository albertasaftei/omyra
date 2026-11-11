import { identities } from "./identities";
import {
  evolution,
  sections,
  type Transformation,
  type Section,
} from "./evolution";
import { layers, presets, type Layer, type Settings } from "./model";
import { getSoundscape } from "./soundscapes";
export type Instrument = Exclude<Layer, "air"> | "percussion";
export interface NoteEvent {
  time: number;
  duration: number;
  midi: number;
  velocity: number;
  layer: Exclude<Layer, "air">;
  instrument: Instrument;
}
export interface PhrasePlan {
  index: number;
  start: number;
  duration: number;
  chord: number[];
  section: Section;
  dynamics: Record<Layer, number>;
  events: NoteEvent[];
  transformation: Transformation | null;
  motif: number[];
}
export const VOICE_LIMITS: Record<Instrument, number> = {
  pad: 12,
  bells: 8,
  particles: 8,
  drone: 1,
  percussion: 1,
};
export class Composer {
  private randomState: number;
  private phrase = 0;
  private time = 0;
  private chordIndex = 0;
  private repeats = 0;
  private sectionIndex = 0;
  private sectionRemaining = 0;
  private recentNotes: NoteEvent[] = [];
  private recentChords: number[] = [];
  private motifs: number[][] = [];
  private occupied: Record<Instrument, number[]> = {
    pad: [],
    bells: [],
    particles: [],
    drone: [],
    percussion: [],
  };
  readonly preset;
  readonly profile;
  readonly voice;
  readonly rule;
  constructor(
    presetId: string,
    readonly seed: number,
  ) {
    this.preset = presets.find((p) => p.id === presetId) ?? presets[0];
    this.profile = getSoundscape(this.preset.id);
    this.voice = identities[this.preset.id];
    this.rule = evolution[this.preset.id];
    this.randomState = seed >>> 0;
  }
  private random() {
    this.randomState = (this.randomState + 0x6d2b79f5) >>> 0;
    let n = this.randomState;
    n = Math.imul(n ^ (n >>> 15), n | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  }
  private chooseChord() {
    if (!this.phrase) {
      this.repeats = 1;
      return;
    }
    const current = this.profile.chords[this.chordIndex];
    const weights = this.profile.chords.map((chord, index) => {
      if (index === this.chordIndex && this.repeats >= 2) return 0;
      const movement =
        chord.reduce(
          (sum, n, i) => sum + Math.abs(n - current[i % current.length]),
          0,
        ) / chord.length;
      const preference =
        index === (this.chordIndex + 1) % this.profile.chords.length
          ? 6
          : index === this.chordIndex
            ? 3
            : 1;
      return preference / (1 + movement / 24);
    });
    let pick = this.random() * weights.reduce((a, b) => a + b, 0);
    let next = weights.length - 1;
    for (let i = 0; i < weights.length; i++) {
      pick -= weights[i];
      if (pick < 0) {
        next = i;
        break;
      }
    }
    this.repeats = next === this.chordIndex ? this.repeats + 1 : 1;
    this.chordIndex = next;
  }
  next(settings: Settings): PhrasePlan {
    const p = this.profile,
      v = this.voice,
      r = this.rule;
    this.chooseChord();
    if (!this.sectionRemaining) {
      if (this.phrase) this.sectionIndex = (this.sectionIndex + 1) % 4;
      this.sectionRemaining = 2 + Math.floor(this.random() * 3);
    }
    this.sectionRemaining--;
    const section = sections[this.sectionIndex];
    const intensity = r.intensity[this.sectionIndex];
    const chord = p.chords[this.chordIndex];
    const dynamics = Object.fromEntries(
      layers.map((layer) => [
        layer,
        !r.participants.includes(layer)
          ? 0
          : layer === "particles" &&
              (section === "sparse" || section === "release")
            ? 0
            : intensity,
      ]),
    ) as Record<Layer, number>;
    const original = p.pulse?.pattern ?? v.motif;
    const motif = original.slice(0, 16);
    let transformation: Transformation | null = null;
    let omit = -1,
      octave = 0;
    // Revisit the authored motif every fourth phrase, and change at most one feature.
    if (this.phrase % 4 !== 0 && this.random() < r.probability) {
      transformation =
        r.transformations[Math.floor(this.random() * r.transformations.length)];
      if (transformation === "ending")
        motif[motif.length - 1] =
          (motif[motif.length - 1] + 1) %
          (p.pulse ? chord.length : p.scale.length);
      if (transformation === "degree") {
        const i = Math.min(
          motif.length - 2,
          1 + Math.floor(this.random() * Math.max(1, motif.length - 2)),
        );
        motif[i] = (motif[i] + 1) % (p.pulse ? chord.length : p.scale.length);
      }
      if (transformation === "omit")
        omit = Math.max(1, Math.floor(this.random() * motif.length));
      if (transformation === "octave") octave = this.random() < 0.5 ? -12 : 12;
    }
    const events: NoteEvent[] = [];
    const add = (
      instrument: Instrument,
      offset: number,
      duration: number,
      interval: number,
      velocity: number,
    ) => {
      const layer = instrument === "percussion" ? "drone" : instrument;
      if (
        !settings.layers[layer].enabled ||
        !dynamics[layer] ||
        offset >= p.phrase ||
        events.length >= 256
      )
        return;
      events.push({
        instrument,
        layer,
        time: this.time + offset,
        duration,
        midi: this.preset.root + interval,
        velocity,
      });
    };
    chord.forEach((n, i) => add("pad", i * v.strum, v.padHold, n, 0.48));
    if (!p.drive)
      add("drone", 0, Math.max(1, p.phrase - 0.5), chord[0] - 12, 0.5);
    const nearestChord = (n: number) => {
      const options = chord
        .flatMap((c) => [-24, -12, 0, 12, 24, 36, 48].map((o) => c + o))
        .filter((c) => c >= r.register[0] && c <= r.register[1]);
      return options.reduce(
        (a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a),
        options[0],
      );
    };
    const lead = (
      i: number,
      offset: number,
      accent: boolean,
      last: boolean,
    ) => {
      const index = i % motif.length;
      if (index === omit || p.pulse?.rests?.includes(index)) return;
      const density = settings.layers.bells.density;
      if (
        density <= 0 ||
        i % (density < 0.35 ? 4 : density < 0.7 ? 2 : 1) !== 0
      )
        return;
      if (!accent && this.random() > Math.min(1, intensity + 0.2)) return;
      let note = p.pulse
        ? chord[motif[index] % chord.length] + (p.pulse.octave ?? 12)
        : p.scale[motif[index] % p.scale.length] + 12 * p.bellOctave;
      if (note + octave >= r.register[0] && note + octave <= r.register[1])
        note += octave;
      if (accent || last) note = nearestChord(note);
      if (note < r.register[0] || note > r.register[1]) return;
      add(
        "bells",
        offset,
        v.leadHold,
        note,
        accent ? 0.48 : 0.32 + this.random() * 0.06,
      );
    };
    if (p.pulse) {
      const count = Math.round(p.phrase / p.pulse.step);
      for (let i = 0; i < count; i++) {
        lead(
          i,
          i * p.pulse.step,
          (p.pulse.accents ?? [0]).includes(i % motif.length),
          i === count - 1,
        );
        if (p.drive && i % p.drive.bassEvery === 0)
          add(
            "drone",
            i * p.pulse.step,
            p.pulse.step * p.drive.bassEvery * 0.6,
            chord[0] - 12,
            0.45,
          );
        if (
          p.drive?.percussionEvery &&
          section !== "sparse" &&
          i % p.drive.percussionEvery === 0
        )
          add("percussion", i * p.pulse.step, 0.12, chord[0] - 12, 0.4);
      }
    } else {
      let offset = 0.5,
        i = 0;
      while (offset < p.phrase && i < 64) {
        const gap =
          v.gaps[i % v.gaps.length] * (1.4 - settings.layers.bells.density);
        lead(i, offset, i % motif.length === 0, offset + gap >= p.phrase);
        offset += gap;
        i++;
      }
    }
    if (settings.layers.particles.density > 0) {
      const gap =
        (p.pulse
          ? (p.drive?.shimmerEvery ?? 4) * p.pulse.step
          : 8 * p.spacing) *
        (1.5 - settings.layers.particles.density);
      for (
        let offset = gap * 0.75, i = 0;
        offset < p.phrase && i < 64;
        offset += gap, i++
      ) {
        if (
          events.some(
            (e) =>
              e.layer === "bells" &&
              Math.abs(e.time - (this.time + offset)) < 0.18,
          )
        )
          continue;
        add(
          "particles",
          offset,
          v.particleHold,
          chord[(i + 2) % chord.length] + 12 * (v.particleOctave - 1),
          0.28,
        );
      }
    }
    events.sort((a, b) => a.time - b.time);
    const accepted = events.filter((e) => {
      const tail =
        e.instrument === "pad"
          ? p.release
          : e.instrument === "bells"
            ? Math.max(v.leadRelease, 0.8)
            : e.instrument === "particles"
              ? 4
              : e.instrument === "drone"
                ? p.drive
                  ? 0.6
                  : 8
                : 0.4;
      const occupied = this.occupied[e.instrument].filter(
        (end) => end > e.time,
      );
      this.occupied[e.instrument] = occupied;
      // Monophonic synths retrigger their one voice; never allocate a second.
      if (VOICE_LIMITS[e.instrument] === 1) occupied.length = 0;
      if (occupied.length >= VOICE_LIMITS[e.instrument]) return false;
      occupied.push(e.time + e.duration + tail);
      this.recentNotes.push(e);
      if (this.recentNotes.length > 64) this.recentNotes.shift();
      return true;
    });
    this.recentChords.push(this.chordIndex);
    if (this.recentChords.length > 16) this.recentChords.shift();
    this.motifs.push(motif);
    if (this.motifs.length > 4) this.motifs.shift();
    const plan: PhrasePlan = {
      index: this.phrase++,
      start: this.time,
      duration: p.phrase,
      chord: [...chord],
      section,
      dynamics,
      events: accepted,
      transformation,
      motif: [...motif],
    };
    this.time += p.phrase;
    return plan;
  }
  diagnostics() {
    return {
      notes: this.recentNotes.length,
      chords: this.recentChords.length,
      motifs: this.motifs.length,
      phrase: this.phrase,
      randomState: this.randomState,
      occupied: Object.fromEntries(
        Object.entries(this.occupied).map(([key, value]) => [
          key,
          value.length,
        ]),
      ),
    };
  }
}
