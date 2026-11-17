import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
const fake = vi.hoisted(() => ({
  time: 0,
  callback: undefined as undefined | ((time: number) => void),
  state: "running",
  handler: undefined as undefined | (() => void),
  racks: [] as any[],
  defer: false,
  fail: false,
  transport: "stopped",
}));
vi.mock("tone", () => {
  class Node {
    gain = { rampTo: vi.fn(), cancelScheduledValues: vi.fn() };
    connect() {
      return this;
    }
    toDestination() {
      return this;
    }
    dispose = vi.fn();
  }
  const context = {
    get state() {
      return fake.state;
    },
    on: (_s: string, fn: () => void) => {
      fake.handler = fn;
    },
    off: () => {
      fake.handler = undefined;
    },
  };
  const transport = {
    get state() {
      return fake.transport;
    },
    scheduleRepeat: (fn: (t: number) => void) => {
      fake.callback = fn;
      return 1;
    },
    clear: () => {
      fake.callback = undefined;
    },
    start: () => {
      fake.transport = "started";
    },
  };
  return {
    Gain: Node,
    Limiter: Node,
    Filter: Node,
    start: async () => {},
    getContext: () => context,
    getTransport: () => transport,
    immediate: () => fake.time,
    now: () => fake.time + 0.1,
  };
});
vi.mock("../audio/VoiceRack", () => ({
  VoiceRack: class {
    retired = false;
    dead = false;
    output = { gain: { rampTo: vi.fn(), cancelScheduledValues: vi.fn() } };
    buses = Object.fromEntries(
      ["pad", "bells", "drone", "air", "particles"].map((l) => [
        l,
        { gain: { rampTo: vi.fn() } },
      ]),
    );
    ready: Promise<void>;
    resolve!: () => void;
    reject!: (e: Error) => void;
    play = vi.fn();
    release = vi.fn();
    voiceCounts = () => ({ pad: 0, bells: 0, particles: 0 });
    constructor(readonly id: string) {
      this.ready = new Promise((resolve, reject) => {
        this.resolve = resolve;
        this.reject = reject;
      });
      fake.racks.push(this);
      if (fake.fail) this.reject(new Error("render failed"));
      else if (!fake.defer) this.resolve();
    }
    get disposed() {
      return this.dead || this.retired;
    }
    dispose() {
      this.dead = true;
    }
  },
}));
import { AudioEngine } from "../audio/AudioEngine";
import { createPresetSettings } from "../audio/model";
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
beforeEach(() => {
  vi.useFakeTimers();
  Object.assign(fake, {
    time: 0,
    callback: undefined,
    state: "running",
    handler: undefined,
    racks: [],
    defer: false,
    fail: false,
    transport: "stopped",
  });
});
afterEach(() => vi.useRealTimers());
describe("audio ownership and lifecycle", () => {
  it("pause cancels queued voices and resumes the same composition and seed", async () => {
    const e = new AudioEngine(createPresetSettings("starward"), 42);
    await e.start();
    fake.time = 1;
    fake.callback!(1);
    const before = e.diagnostics().composer;
    e.pause();
    expect(fake.racks[0].retired).toBe(true);
    const elapsed = e.elapsedSeconds;
    fake.time = 100;
    expect(e.elapsedSeconds).toBe(elapsed);
    await e.start();
    expect(fake.racks[0].dead).toBe(true);
    expect(e.diagnostics().composer).toEqual(before);
    expect(e.status).toBe("playing");
    e.dispose();
  });
  it("coalesces rapid selections while keeping at most three live racks", async () => {
    const e = new AudioEngine(createPresetSettings("ethereal"), 42);
    await e.start();
    fake.defer = true;
    e.apply(createPresetSettings("zen"));
    e.apply(createPresetSettings("gravity"));
    e.apply(createPresetSettings("supernova"));
    expect(fake.racks.length).toBe(2);
    fake.racks[1].resolve();
    await flush();
    expect(fake.racks[1].dead).toBe(true);
    expect(fake.racks[2].id).toBe("supernova");
    fake.racks[2].resolve();
    await flush();
    expect(e.diagnostics().preset).toBe("supernova");
    expect(fake.racks.filter((r) => !r.dead).length).toBeLessThanOrEqual(3);
    vi.advanceTimersByTime(3300);
    expect(fake.racks.filter((r) => !r.dead).length).toBe(1);
    e.dispose();
  });
  it("plays Zen's opening pad when switching presets during playback", async () => {
    const e = new AudioEngine(createPresetSettings("ethereal"), 42);
    await e.start();
    fake.time = 1;
    fake.callback!(1);
    e.apply(createPresetSettings("zen"));
    await flush();

    const zen = fake.racks[1];
    fake.callback!(1.03);
    expect(zen.play).not.toHaveBeenCalled();
    fake.callback!(1.13);
    expect(zen.play).toHaveBeenCalledWith(
      expect.objectContaining({ layer: "pad", time: 0 }),
      1.13,
    );
    e.dispose();
  });
  it("uses the same calibrated gain when starting and fading in a preset", async () => {
    const direct = new AudioEngine(createPresetSettings("zen"), 42);
    await direct.start();
    const [zenGain] = fake.racks[0].output.gain.rampTo.mock.lastCall;
    expect(zenGain).toBeGreaterThan(1);
    direct.dispose();

    const switched = new AudioEngine(createPresetSettings("starward"), 42);
    await switched.start();
    const starward = fake.racks[1];
    expect(starward.output.gain.rampTo.mock.lastCall[0]).toBeLessThan(1);

    switched.apply(createPresetSettings("zen"));
    await flush();
    expect(starward.output.gain.rampTo).toHaveBeenLastCalledWith(0, 3);
    expect(fake.racks[2].output.gain.rampTo).toHaveBeenLastCalledWith(
      zenGain,
      3,
    );
    switched.dispose();
  });
  it("disposes pending initialization without reviving a destroyed engine", async () => {
    fake.defer = true;
    const e = new AudioEngine(createPresetSettings(), 42);
    const start = e.start();
    await flush();
    e.dispose();
    fake.racks[0].resolve();
    await start;
    expect(fake.racks[0].dead).toBe(true);
    expect(e.status).toBe("idle");
    expect(fake.callback).toBeUndefined();
    e.dispose();
  });
  it("recovers from failed reverb initialization", async () => {
    fake.fail = true;
    const e = new AudioEngine(createPresetSettings(), 42);
    await e.start();
    expect(e.status).toBe("paused");
    expect(fake.racks[0].dead).toBe(true);
    fake.fail = false;
    await e.start();
    expect(e.status).toBe("playing");
    e.dispose();
  });
  it("interruptions freeze playback and never catch up missed notes", async () => {
    const e = new AudioEngine(createPresetSettings("momentum"), 42);
    await e.start();
    fake.time = 1;
    fake.callback!(1);
    fake.state = "suspended";
    fake.handler!();
    expect(e.status).toBe("paused");
    const elapsed = e.elapsedSeconds;
    fake.time = 600;
    expect(e.elapsedSeconds).toBe(elapsed);
    fake.state = "running";
    await e.start();
    fake.time = 601;
    fake.callback!(601);
    expect(e.status).toBe("playing");
    e.dispose();
  });
  it("does not count an unsignalled sleep gap as listening or advance composition", async () => {
    const e = new AudioEngine(createPresetSettings("supernova"), 42);
    await e.start();
    fake.time = 1;
    fake.callback!(1);
    const before = e.diagnostics().composer;
    const elapsed = e.elapsedSeconds;
    fake.racks[0].play.mockClear();
    fake.time = 3600;
    fake.callback!(3600);
    expect(e.status).toBe("paused");
    expect(e.elapsedSeconds).toBe(elapsed);
    expect(e.diagnostics().composer).toEqual(before);
    expect(fake.racks[0].play).not.toHaveBeenCalled();
    await e.start();
    expect(e.diagnostics().composer).toEqual(before);
    fake.time = 3601;
    fake.callback!(3601);
    expect(e.elapsedSeconds).toBeLessThan(2);
    e.pause();
    vi.advanceTimersByTime(100);
    expect(() => {
      e.pause();
      e.stop();
      e.dispose();
      e.dispose();
    }).not.toThrow();
  });
  it("schedules only near the callback and silences user-disabled layers", async () => {
    const settings = createPresetSettings("supernova");
    const e = new AudioEngine(settings, 42);
    await e.start();
    for (let i = 1; i < 20; i++) {
      fake.time = i * 0.05;
      fake.callback!(fake.time);
    }
    for (const [event, time] of fake.racks[0].play.mock.calls) {
      expect(time).toBeGreaterThanOrEqual(0);
      expect(time).toBeLessThan(2);
      expect(event.duration).toBeGreaterThan(0);
    }
    settings.layers.bells.enabled = false;
    e.apply(settings);
    fake.racks[0].play.mockClear();
    for (let i = 20; i < 40; i++) {
      fake.time = i * 0.05;
      fake.callback!(fake.time);
    }
    expect(
      fake.racks[0].play.mock.calls.every(
        ([event]: any[]) => event.layer !== "bells",
      ),
    ).toBe(true);
    e.dispose();
  });
});
