import type { NoteEvent } from "./Composer";
import { identities } from "./identities";
import * as Tone from "tone";
import { layers, type Layer } from "./model";
import { getSoundscape } from "./soundscapes";

/** One self-contained scene, so outgoing notes can fade without being retuned. */
export class VoiceRack {
  private isDisposed = false;
  retired = false;
  get disposed() {
    return this.isDisposed || this.retired;
  }
  readonly output = new Tone.Gain(0);
  readonly buses = {} as Record<Layer, Tone.Gain>;
  readonly pad: Tone.PolySynth;
  readonly bells: Tone.PolySynth<Tone.FMSynth> | Tone.PolySynth<Tone.Synth>;
  readonly particles: Tone.PolySynth<Tone.AMSynth>;
  readonly drone: Tone.Synth;
  readonly percussion?: Tone.MembraneSynth;
  readonly ready: Promise<void>;
  private nodes: { dispose(): unknown }[] = [this.output];
  constructor(presetId: string, destination: Tone.ToneAudioNode) {
    try {
      const soundscape = getSoundscape(presetId);
      const voice = identities[presetId] ?? identities.ethereal;
      this.output.connect(destination);
      const reverb = new Tone.Reverb({
        decay: soundscape.reverb,
        preDelay: 0.06,
        wet: soundscape.wet,
      }).connect(this.output);
      this.nodes.push(reverb);
      this.ready = reverb.ready;
      const delay = new Tone.PingPongDelay({
        delayTime: soundscape.delay,
        feedback: soundscape.feedback,
        wet: voice.delayWet,
      }).connect(reverb);
      this.nodes.push(delay);
      const chorus = new Tone.Chorus({
        frequency: 0.18,
        delayTime: 3.5,
        depth: 0.35,
        wet: voice.chorusWet,
      })
        .connect(reverb)
        .start();
      this.nodes.push(chorus);
      for (const layer of layers) {
        const filter = new Tone.Filter({
          frequency:
            layer === "air"
              ? voice.airCutoff
              : layer === "drone"
                ? 650
                : soundscape.cutoff,
          type: "lowpass",
          rolloff: -24,
          Q: 0.5,
        });
        filter.connect(
          layer === "bells" || layer === "particles"
            ? delay
            : layer === "pad"
              ? chorus
              : reverb,
        );
        const pan = new Tone.AutoPanner({
          frequency: soundscape.motion * (layer === "particles" ? 1.7 : 1),
          depth: layer === "drone" ? 0 : voice.panDepth,
        })
          .connect(filter)
          .start();
        this.buses[layer] = new Tone.Gain(0).connect(pan);
        this.nodes.push(filter, pan, this.buses[layer]);
      }
      this.pad = new Tone.PolySynth(Tone.Synth, {
        oscillator: soundscape.pulse?.organ
          ? { type: "custom", partials: [1, 0.45, 0.18, 0.12, 0.04] }
          : { type: soundscape.pad, spread: 12, count: 3 },
        envelope: {
          attack: soundscape.attack,
          decay: 3,
          sustain: 0.65,
          release: soundscape.release,
        },
        volume: -22,
      }).connect(this.buses.pad);
      this.nodes.push(this.pad);
      this.pad.maxPolyphony = 12;
      this.bells =
        voice.lead === "fm" || voice.lead === "felt"
          ? new Tone.PolySynth(Tone.FMSynth, {
              harmonicity: soundscape.bellRatio,
              modulationIndex: soundscape.bellIndex,
              oscillator: soundscape.pulse?.organ
                ? { type: "custom", partials: [1, 0.3, 0.08, 0.05] }
                : { type: "sine" },
              modulation: { type: "sine" },
              envelope: {
                attack: voice.leadAttack,
                decay: soundscape.bellDecay,
                sustain: soundscape.pulse?.organ ? 0.35 : 0,
                release: voice.leadRelease,
              },
              modulationEnvelope: {
                attack: 0.008,
                decay: soundscape.bellDecay * 0.4,
                sustain: 0,
                release: 0.8,
              },
              volume: voice.leadGain,
            }).connect(this.buses.bells)
          : new Tone.PolySynth(Tone.Synth, {
              oscillator:
                voice.lead === "organ"
                  ? {
                      type: "custom",
                      partials:
                        presetId === "gravity"
                          ? [1, 0.65, 0.3, 0.22, 0.1]
                          : [1, 0.3, 0.08, 0.05],
                    }
                  : voice.lead === "reed"
                    ? { type: "amsine", harmonicity: soundscape.particleRatio }
                    : { type: "custom", partials: [1, 0.35, 0.15, 0.05] },
              envelope: {
                attack: voice.leadAttack,
                decay: soundscape.bellDecay,
                sustain: voice.lead === "harp" ? 0 : 0.55,
                release: voice.leadRelease,
              },
              volume: voice.leadGain,
            }).connect(this.buses.bells);
      this.nodes.push(this.bells);
      this.bells.maxPolyphony = 8;
      this.particles = new Tone.PolySynth(Tone.AMSynth, {
        harmonicity: soundscape.particleRatio,
        oscillator: { type: "sine" },
        modulation: { type: "sine" },
        envelope: {
          attack: soundscape.particleAttack,
          decay: 2,
          sustain: 0.12,
          release: 4,
        },
        modulationEnvelope: { attack: 0.8, decay: 1, sustain: 0.3, release: 3 },
        volume: -27,
      }).connect(this.buses.particles);
      this.nodes.push(this.particles);
      this.particles.maxPolyphony = 8;
      this.drone = new Tone.Synth({
        oscillator: { type: "sine" },
        envelope: soundscape.drive
          ? { attack: 0.04, decay: 0.4, sustain: 0.25, release: 0.6 }
          : { attack: 6, decay: 2, sustain: 0.8, release: 8 },
        volume: -24,
      }).connect(this.buses.drone);
      this.nodes.push(this.drone);
      if (soundscape.drive?.percussionEvery) {
        this.percussion = new Tone.MembraneSynth({
          pitchDecay: 0.025,
          octaves: 1.5,
          oscillator: { type: "sine" },
          envelope: { attack: 0.01, decay: 0.5, sustain: 0, release: 0.4 },
          volume: -30,
        }).connect(this.buses.drone);
        this.nodes.push(this.percussion);
      }
      const air = new Tone.Noise({ type: "pink", volume: -34 });
      const breath = new Tone.Tremolo({
        frequency: soundscape.motion,
        depth: voice.airDepth,
        wet: 1,
      })
        .connect(this.buses.air)
        .start();
      air.connect(breath).start();
      this.nodes.push(breath, air);
    } catch (error) {
      this.dispose();
      throw error;
    }
  }
  play(event: NoteEvent, time: number) {
    if (this.disposed) return;
    const instrument = this[event.instrument];
    instrument?.triggerAttackRelease(
      Tone.Frequency(event.midi, "midi").toFrequency(),
      event.duration,
      time,
      event.velocity,
    );
  }
  voiceCounts() {
    return {
      pad: this.pad.activeVoices,
      bells: this.bells.activeVoices,
      particles: this.particles.activeVoices,
    };
  }
  release(time: number) {
    if (this.isDisposed) return;
    this.pad.releaseAll(time);
    this.bells.releaseAll(time);
    this.particles.releaseAll(time);
    this.drone.triggerRelease(time);
    this.percussion?.triggerRelease(time);
  }
  dispose() {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.nodes.reverse().forEach((node) => node.dispose());
  }
}
