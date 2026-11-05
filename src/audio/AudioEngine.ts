import { identities } from "./identities";
import { VoiceRack } from "./VoiceRack";
import { cinematicStep, getSoundscape } from "./soundscapes";
import * as Tone from "tone";
import {
  layers,
  presets,
  NoteGenerator,
  type Settings,
  type Layer,
  type MusicalEvent,
} from "./model";
export class AudioEngine {
  private settings: Settings;
  private initialized = false;
  private playing = false;
  private master!: Tone.Gain;
  private highpass!: Tone.Filter;
  private generation = 0;
  private rack!: VoiceRack;
  private retired = new Map<VoiceRack, ReturnType<typeof setTimeout>>();
  private nodes: { dispose(): unknown }[] = [];
  private generators = {
    bells: new NoteGenerator(),
    particles: new NoteGenerator(),
  };
  private chord = 0;
  private melodyStep = 0;
  private pulseStart: number | null = null;
  private pulseStep = -1;
  private scheduleId?: number;
  private next = { pad: 0, bells: 0, drone: 0, air: 0, particles: 0 };
  private listeners = new Set<(event: MusicalEvent) => void>();
  private startPromise: Promise<void> | null = null;
  constructor(settings: Settings) {
    this.settings = settings;
  }
  subscribe(listener: (event: MusicalEvent) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private init() {
    this.master = new Tone.Gain(0).toDestination();
    const limiter = new Tone.Limiter(-3).connect(this.master);
    const highpass = new Tone.Filter(35, "highpass").connect(limiter);
    this.highpass = highpass;
    this.nodes.push(this.master, limiter, highpass);
    this.rack = new VoiceRack(this.settings.preset, highpass);
    this.scheduleId = Tone.getTransport().scheduleRepeat(
      (time) => this.tick(time),
      0.25,
    );
    this.initialized = true;
  }
  async start() {
    if (this.startPromise) return this.startPromise;
    this.startPromise = this.begin();
    try {
      await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }
  private async begin() {
    const generation = this.generation;
    await Tone.start();
    if (generation !== this.generation) return;
    if (this.playing) return;
    if (!this.initialized) this.init();
    await this.rack.ready;
    if (generation !== this.generation) return;
    this.rack.output.gain.rampTo(1, 2);
    this.playing = true;
    this.pulseStart = null;
    this.pulseStep = -1;
    this.next = { pad: 0, bells: 0, drone: 0, air: 0, particles: 0 };
    this.apply(this.settings);
    this.master.gain.rampTo(this.settings.master, 2);
    Tone.getTransport().start();
  }
  pause() {
    if (!this.playing) return;
    this.playing = false;
    const now = Tone.now();
    this.master.gain.rampTo(0, 0.5);
    Tone.getTransport().pause();
    this.rack.release(now);
  }
  stop() {
    this.pause();
    if (this.initialized) Tone.getTransport().stop();
  }
  apply(settings: Settings) {
    const presetChanged = this.settings.preset !== settings.preset;
    this.settings = settings;
    if (!this.initialized) return;
    if (presetChanged) {
      const previous = this.rack;
      previous.output.gain.rampTo(0, 3);
      previous.release(Tone.now());
      this.retired.set(
        previous,
        setTimeout(() => {
          previous.dispose();
          this.retired.delete(previous);
        }, 3500),
      );
      this.rack = new VoiceRack(settings.preset, this.highpass);
      const incoming = this.rack;
      void incoming.ready.then(() => {
        if (this.initialized && this.rack === incoming)
          incoming.output.gain.rampTo(1, 3);
      });
      this.chord = 0;
      this.melodyStep = 0;
      this.pulseStart = null;
      this.pulseStep = -1;
      this.generators = {
        bells: new NoteGenerator(),
        particles: new NoteGenerator(),
      };
      this.next = { pad: 0, bells: 1, drone: 0, air: 0, particles: 3 };
    }
    this.master.gain.rampTo(this.playing ? settings.master : 0, 0.4);
    for (const l of layers)
      this.rack.buses[l].gain.rampTo(
        settings.layers[l].enabled ? settings.layers[l].volume : 0,
        1.2,
      );
  }
  private emit(layer: Layer, time: number, duration: number) {
    for (const f of this.listeners)
      f({
        layer,
        audioTime: time,
        duration,
        intensity: this.settings.layers[layer].volume,
      });
  }
  private tick(time: number) {
    if (!this.playing) return;
    const position = Tone.getTransport().seconds;
    const profile = getSoundscape(this.settings.preset);
    const voice = identities[this.settings.preset] ?? identities.ethereal;
    const root = (
      presets.find((p) => p.id === this.settings.preset) ?? presets[0]
    ).root;
    if (profile.pulse) {
      this.pulseStart ??= position;
      const step = Math.floor(
        (position - this.pulseStart + 0.001) / profile.pulse.step,
      );
      if (step === this.pulseStep) return;
      this.pulseStep = step;
      const event = cinematicStep(
        profile,
        step,
        this.settings.layers.bells.density,
      );
      const hz = (interval: number) =>
        Tone.Frequency(root + interval, "midi").toFrequency();
      const enabled = (layer: Layer) => this.settings.layers[layer].enabled;
      if (event.phraseStart) {
        if (enabled("pad")) {
          event.chord.forEach((interval, index) =>
            this.rack.pad.triggerAttackRelease(
              hz(interval),
              voice.padHold,
              time + index * voice.strum,
              0.46 * event.swell,
            ),
          );
          this.emit("pad", time, profile.phrase);
        }
        if (enabled("drone") && !profile.drive) {
          this.rack.drone.triggerAttackRelease(
            hz(event.chord[0] - 12),
            profile.phrase - 0.5,
            time,
            0.5,
          );
          this.emit("drone", time, profile.phrase);
        }
        if (enabled("air")) this.emit("air", time, profile.phrase);
      }
      if (profile.drive && enabled("drone")) {
        if (step % profile.drive.bassEvery === 0) {
          const duration = profile.pulse.step * profile.drive.bassEvery * 0.6;
          this.rack.drone.triggerAttackRelease(
            hz(event.chord[0] - 12),
            duration,
            time,
            0.45 * event.swell,
          );
          this.emit("drone", time, duration);
        }
        if (
          profile.drive.percussionEvery &&
          step % profile.drive.percussionEvery === 0
        ) {
          this.rack.percussion?.triggerAttackRelease(
            hz(event.chord[0] - 12),
            0.12,
            time,
            0.4 * event.swell,
          );
        }
      }
      if (enabled("bells") && event.active && event.voiced) {
        const duration = voice.leadHold;
        this.rack.bells.triggerAttackRelease(
          hz(event.interval),
          duration,
          time,
          event.velocity,
        );
        this.emit("bells", time, duration + profile.bellDecay);
      }
      const particleDensity = this.settings.layers.particles.density;
      const particleStride =
        (profile.drive?.shimmerEvery ?? 4) *
        (particleDensity < 0.35 ? 4 : particleDensity < 0.7 ? 2 : 1);
      if (
        enabled("particles") &&
        particleDensity > 0 &&
        step % particleStride === 2
      ) {
        this.rack.particles.triggerAttackRelease(
          hz(
            event.chord[
              (Math.floor(step / particleStride) + 2) % event.chord.length
            ] +
              (voice.particleOctave - 1) * 12,
          ),
          voice.particleHold,
          time,
          0.28 * event.swell,
        );
        this.emit("particles", time, 4);
      }
      return;
    }
    for (const l of layers) {
      const config = this.settings.layers[l];
      if (!config.enabled || position < this.next[l]) continue;
      const density = config.density;
      if (l === "pad") {
        const chord = profile.chords[this.chord++ % profile.chords.length];
        chord.forEach((interval, index) =>
          this.rack.pad.triggerAttackRelease(
            Tone.Frequency(root + interval, "midi").toFrequency(),
            voice.padHold,
            time + index * voice.strum,
            0.5,
          ),
        );
        this.next.pad = position + profile.phrase;
        this.emit(l, time, profile.phrase);
      }
      if (l === "drone") {
        this.rack.drone.triggerRelease(time);
        this.rack.drone.triggerAttack(
          Tone.Frequency(root - 12, "midi").toFrequency(),
          time + 0.05,
          0.6,
        );
        this.next.drone = position + 65;
        this.emit(l, time, 65);
      }
      if (l === "air") {
        this.next.air = position + 8;
        this.emit(l, time, 8);
      }
      if (l === "bells" || l === "particles") {
        if (density > 0) {
          const n =
            l === "bells"
              ? root +
                profile.bellOctave * 12 +
                profile.scale[
                  voice.motif[this.melodyStep % voice.motif.length] %
                    profile.scale.length
                ]
              : this.generators.particles.next(
                  root,
                  voice.particleOctave,
                  profile.scale,
                );
          this.rack[l].triggerAttackRelease(
            Tone.Frequency(n, "midi").toFrequency(),
            l === "bells" ? voice.leadHold : voice.particleHold,
            time,
            0.35 + Math.random() * 0.25,
          );
          this.emit(l, time, 4);
        }
        this.next[l] =
          position +
          (l === "bells"
            ? voice.gaps[this.melodyStep++ % voice.gaps.length] *
              (1.4 - density)
            : profile.spacing * (5 + (1 - density) * 14 + Math.random() * 6));
      }
    }
  }
  dispose() {
    this.generation++;
    this.stop();
    if (this.scheduleId !== undefined)
      Tone.getTransport().clear(this.scheduleId);
    for (const [rack, timer] of this.retired) {
      clearTimeout(timer);
      rack.dispose();
    }
    this.retired.clear();
    this.rack?.dispose();
    this.nodes.reverse().forEach((n) => n.dispose());
    this.nodes = [];
    this.listeners.clear();
    this.initialized = false;
  }
}
