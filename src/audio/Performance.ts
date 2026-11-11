import { Composer, type NoteEvent, type PhrasePlan } from "./Composer";
import type { Settings } from "./model";
/** Two phrase plans only; the caller owns the playback cursor. */
export class Performance {
  private current: PhrasePlan;
  private nextPlan: PhrasePlan;
  constructor(
    readonly composer: Composer,
    settings: Settings,
  ) {
    this.current = composer.next(settings);
    this.nextPlan = composer.next(settings);
  }
  at(position: number, settings: Settings) {
    while (position >= this.nextPlan.start) {
      this.current = this.nextPlan;
      this.nextPlan = this.composer.next(settings);
    }
    return this.current;
  }
  between(from: number, to: number, settings: Settings): NoteEvent[] {
    this.at(from, settings);
    return [...this.current.events, ...this.nextPlan.events].filter(
      (e) => e.time >= from && e.time < to,
    );
  }
  sustaining(position: number, settings: Settings) {
    return this.at(position, settings)
      .events.filter(
        (e) =>
          (e.layer === "pad" || e.layer === "drone") &&
          e.time < position &&
          e.time + e.duration > position,
      )
      .map((e) => ({
        ...e,
        time: position,
        duration: e.time + e.duration - position,
      }));
  }
  diagnostics() {
    return {
      plans: 2,
      events: this.current.events.length + this.nextPlan.events.length,
      ...this.composer.diagnostics(),
    };
  }
}
