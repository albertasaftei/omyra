export const backgrounds = [
  { id: "nebula", name: "Nebula" },
  { id: "orbital", name: "Orbital particles" },
  { id: "trails", name: "Meteor shower" },
  { id: "waves", name: "Harmonic waves" },
  { id: "celestial", name: "Spiral galaxy" },
] as const;

export type BackgroundId = (typeof backgrounds)[number]["id"];

export function parseBackgroundId(value: string): BackgroundId {
  return (
    backgrounds.find((background) => background.id === value)?.id ?? "nebula"
  );
}
