import * as Tone from "tone";
import { Composer, type NoteEvent, type PhrasePlan } from "./Composer";
import { Performance } from "./Performance";
import { VoiceRack } from "./VoiceRack";
import { layers, type Settings, type MusicalEvent } from "./model";
export type PlaybackState = "idle" | "starting" | "playing" | "paused";
type RackSlot = {
  rack: VoiceRack;
  performance: Performance;
  position: number;
  anchor: number;
  until: number;
  phrase: number;
};
export class AudioEngine {
  private settings: Settings;
  private state: PlaybackState = "idle";
  private error = "";
  private initialized = false;
  private generation = 0;
  private master?: Tone.Gain;
  private nodes: { dispose(): unknown }[] = [];
  private destination?: Tone.Filter;
  private active?: RackSlot;
  private fading?: VoiceRack;
  private fadeTimer?: ReturnType<typeof setTimeout>;
  private pending?: Promise<void>;
  private desired: string;
  private activeId = "";
  private wantsPlay = false;
  private scheduleId?: number;
  private lastTick = 0;
  private elapsed = 0;
  private elapsedAnchor = 0;
  private listeners = new Set<(event: MusicalEvent) => void>();
  private stateListeners = new Set<() => void>();
  private samples: object[] = [];
  private lastSample = 0;
  private misses = 0;
  private seed?: number;
  constructor(settings: Settings, seed?: number) {
    this.settings = settings;
    this.desired = settings.preset;
    this.seed = seed;
  }
  subscribe(listener: (event: MusicalEvent) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  subscribeState(listener: () => void) {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  }
  get status() {
    return this.state;
  }
  get failure() {
    return this.error;
  }
  get elapsedSeconds() {
    return (
      this.elapsed +
      (this.state === "playing"
        ? Math.max(0, Tone.immediate() - this.elapsedAnchor)
        : 0)
    );
  }
  private notify() {
    for (const f of this.stateListeners) f();
  }
  private setState(state: PlaybackState, error = "") {
    this.state = state;
    this.error = error;
    this.notify();
  }
  private contextChanged = () => {
    if (this.state === "playing" && Tone.getContext().state !== "running")
      this.pause("Audio was interrupted. Press play to continue.");
  };
  private init() {
    if (this.initialized) return;
    this.master = new Tone.Gain(0).toDestination();
    this.nodes.push(this.master);
    const limiter = new Tone.Limiter(-3).connect(this.master);
    this.nodes.push(limiter);
    this.destination = new Tone.Filter(35, "highpass").connect(limiter);
    this.nodes.push(this.destination);
    Tone.getContext().on("statechange", this.contextChanged);
    this.scheduleId = Tone.getTransport().scheduleRepeat(
      (time) => this.tick(time),
      0.05,
    );
    this.initialized = true;
  }
  private position(time = Tone.immediate()) {
    return this.active
      ? this.active.position +
          (this.state === "playing"
            ? Math.max(0, time - this.active.anchor)
            : 0)
      : 0;
  }
  private startTask?: Promise<void>;
  async start() {
    if (this.state === "playing") return;
    if (this.startTask) return this.startTask;
    this.startTask = this.begin();
    try {
      await this.startTask;
    } finally {
      this.startTask = undefined;
    }
  }
  private async begin() {
    this.wantsPlay = true;
    this.setState("starting");
    const generation = this.generation;
    try {
      await Tone.start();
      if (generation !== this.generation || !this.wantsPlay) return;
      this.init();
      await this.ensureRack();
      if (generation !== this.generation || !this.wantsPlay || !this.active)
        return;
      // Suspension must not silently leave the UI in a playing state.
      if (Tone.getContext().state !== "running")
        throw new Error("Audio is suspended");
      const now = Tone.now() + 0.02;
      this.active.anchor = now;
      this.active.until = this.active.position;
      this.active.phrase = -1;
      this.elapsedAnchor = now;
      this.lastTick = now;
      this.setState("playing");
      this.active.rack.output.gain.rampTo(1, 0.4);
      this.master!.gain.rampTo(this.settings.master, 0.5);
      for (const event of this.active.performance.sustaining(
        this.active.position,
        this.settings,
      ))
        this.play(event, now);
      if (Tone.getTransport().state !== "started")
        Tone.getTransport().start(now);
    } catch {
      if (generation === this.generation) {
        this.wantsPlay = false;
        this.setState(
          "paused",
          "Audio could not start. Press play to try again.",
        );
      }
    }
  }
  /** Serial construction coalesces requests; no second pending reverb/rack. */
  private async ensureRack(): Promise<void> {
    if (!this.initialized) return;
    if (this.pending) {
      await this.pending;
      if (!this.active || this.activeId !== this.desired)
        return this.ensureRack();
      return;
    }
    if (
      this.active &&
      this.activeId === this.desired &&
      !this.active.rack.disposed
    )
      return;
    const generation = this.generation;
    this.pending = (async () => {
      while (generation === this.generation) {
        const id = this.desired;
        const rack = new VoiceRack(id, this.destination!);
        try {
          await rack.ready;
        } catch (error) {
          rack.dispose();
          throw error;
        }
        if (generation !== this.generation) {
          rack.dispose();
          return;
        }
        if (id !== this.desired) {
          rack.dispose();
          continue;
        }
        const previous = this.active;
        const continuing = previous && this.activeId === id;
        const performance = continuing
          ? previous.performance
          : new Performance(
              new Composer(
                id,
                this.seed ?? crypto.getRandomValues(new Uint32Array(1))[0],
              ),
              this.settings,
            );
        const now = Tone.now();
        this.clearFading();
        if (previous && !previous.rack.disposed) {
          if (this.state === "playing") {
            previous.rack.output.gain.cancelScheduledValues(Tone.immediate());
            previous.rack.output.gain.rampTo(0, 3);
            previous.rack.release(now);
            this.fading = previous.rack;
            this.fadeTimer = setTimeout(() => this.clearFading(), 3200);
          } else previous.rack.dispose();
        }
        this.active = {
          rack,
          performance,
          position: continuing ? previous.position : 0,
          anchor: now,
          until: continuing ? previous.position : 0,
          phrase: -1,
        };
        this.activeId = id;
        this.applyMix();
        if (this.state === "playing") rack.output.gain.rampTo(1, 3);
        return;
      }
    })();
    try {
      await this.pending;
    } finally {
      this.pending = undefined;
    }
  }
  private clearFading() {
    if (this.fadeTimer) clearTimeout(this.fadeTimer);
    this.fadeTimer = undefined;
    this.fading?.dispose();
    this.fading = undefined;
  }
  pause(message = "", cutoff = Tone.immediate()) {
    this.wantsPlay = false;
    if (this.state === "playing") {
      const now = Math.min(cutoff, Tone.immediate());
      this.elapsed += Math.max(0, now - this.elapsedAnchor);
      if (this.active) {
        this.active.position = this.position(now);
        this.active.until = this.active.position;
      }
    }
    this.setState("paused", message);
    // Disposing the rack cancels Tone's already-submitted future note starts.
    // A short output fade precedes disposal; resume reconstructs voices, not music.
    this.master?.gain.cancelScheduledValues(Tone.immediate());
    this.master?.gain.rampTo(0, 0.04);
    this.clearFading();
    if (this.active && !this.active.rack.disposed) {
      const rack = this.active.rack;
      rack.output.gain.cancelScheduledValues(Tone.immediate());
      rack.output.gain.rampTo(0, 0.04);
      rack.release(Tone.now());
      this.fading = rack;
      this.fadeTimer = setTimeout(() => this.clearFading(), 60);
      // Mark unavailable immediately so a quick resume cannot reuse queued voices.
      rack.retired = true;
    }
  }
  stop() {
    this.pause();
    this.active?.rack.dispose();
    this.active = undefined;
    this.activeId = "";
    this.elapsed = 0;
  }
  apply(settings: Settings) {
    const changed = this.settings.preset !== settings.preset;
    this.settings = settings;
    this.desired = settings.preset;
    if (!this.initialized) return;
    this.applyMix();
    if (changed)
      void this.ensureRack().catch(() => {
        this.pause("The soundscape could not load. Press play to retry.");
      });
  }
  private applyMix(phrase?: PhrasePlan, time = Tone.now()) {
    this.master?.gain.rampTo(
      this.state === "playing" ? this.settings.master : 0,
      0.3,
      time,
    );
    if (!this.active) return;
    const plan =
      phrase ?? this.active.performance.at(this.position(), this.settings);
    for (const layer of layers)
      this.active.rack.buses[layer].gain.rampTo(
        this.settings.layers[layer].enabled
          ? this.settings.layers[layer].volume * plan.dynamics[layer]
          : 0,
        0.4,
        time,
      );
  }
  private play(event: NoteEvent, time: number) {
    if (!this.active || !this.settings.layers[event.layer].enabled) return;
    this.active.rack.play(event, time);
    for (const f of this.listeners)
      f({
        layer: event.layer,
        audioTime: time,
        duration: event.duration,
        intensity: this.settings.layers[event.layer].volume * event.velocity,
      });
  }
  private tick(time: number) {
    if (this.state !== "playing" || !this.active) return;
    if (time - this.lastTick > 2) {
      this.misses++;
      this.pause(
        "Playback was interrupted. Press play to continue.",
        Math.min(this.lastTick, Tone.immediate()),
      );
      return;
    }
    this.lastTick = time;
    const slot = this.active;
    const windowEnd = time + 0.05;
    if (windowEnd <= slot.anchor) return;
    const windowStart = Math.max(time, slot.anchor);
    const position = this.position(windowStart);
    const firstWindow = slot.phrase === -1;
    const plan = slot.performance.at(position, this.settings);
    if (slot.phrase !== plan.index) {
      slot.phrase = plan.index;
      this.applyMix(plan, windowStart);
    }
    const end = this.position(windowEnd);
    for (const event of slot.performance.between(
      firstWindow ? slot.until : Math.max(slot.until, position - 0.001),
      end,
      this.settings,
    ))
      this.play(event, windowStart + Math.max(0, event.time - position));
    slot.until = end;
    if (time - this.lastSample >= 60) {
      this.lastSample = time;
      this.samples.push(this.diagnostics());
      if (this.samples.length > 1440) this.samples.shift();
    }
  }
  diagnostics() {
    const memory = (
      globalThis.performance as globalThis.Performance & {
        memory?: { usedJSHeapSize: number; totalJSHeapSize: number };
      }
    )?.memory;
    return {
      heapBytes: memory?.usedJSHeapSize ?? null,
      heapCapacity: memory?.totalJSHeapSize ?? null,
      status: this.state,
      elapsed: this.elapsedSeconds,
      preset: this.activeId,
      active: this.active && !this.active.rack.disposed ? 1 : 0,
      fading: this.fading ? 1 : 0,
      pending: this.pending ? 1 : 0,
      misses: this.misses,
      voices: this.active?.rack.voiceCounts(),
      composer: this.active?.performance.diagnostics(),
    };
  }
  exportDiagnostics() {
    return JSON.stringify({
      version: 1,
      userAgent: navigator.userAgent,
      cores: navigator.hardwareConcurrency,
      samples: this.samples,
      current: this.diagnostics(),
    });
  }
  dispose() {
    this.generation++;
    this.wantsPlay = false;
    this.clearFading();
    this.active?.rack.dispose();
    this.active = undefined;
    if (this.scheduleId !== undefined)
      Tone.getTransport().clear(this.scheduleId);
    this.scheduleId = undefined;
    if (this.initialized)
      Tone.getContext().off("statechange", this.contextChanged);
    this.nodes.reverse().forEach((n) => n.dispose());
    this.nodes = [];
    this.master = undefined;
    this.destination = undefined;
    this.initialized = false;
    this.state = "idle";
    this.elapsed = 0;
    this.samples = [];
    this.listeners.clear();
    this.stateListeners.clear();
  }
}
