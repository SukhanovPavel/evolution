import { ru } from "@/i18n/ru";

// Use the scheduled local slot, never delivery time: retries/devices get the same copy.
export function pushPayload(kind: string, eventKey: string) {
  const slot = /^(\d{4}-\d{2}-\d{2}):(\d{2}):(\d{2}):/.exec(eventKey);
  const day = slot
    ? Math.floor(Date.parse(slot[1] + "T00:00:00Z") / 86400000)
    : 0;
  const halfHour = slot
    ? Number(slot[2]) * 2 + Math.floor(Number(slot[3]) / 30)
    : 0;
  const variants =
    kind === "food"
      ? ru.pushFoodVariants
      : kind === "rest"
        ? ru.pushRestVariants
        : ru.pushMovementVariants;
  const index = Number.isFinite(day)
    ? (((day + halfHour) % variants.length) + variants.length) % variants.length
    : 0;
  const copy =
    kind === "test"
      ? { title: ru.pushTestTitle, body: ru.pushTestBody }
      : variants[index];
  // Quiet breaks remain exercise-free; exercise suggestions always allow skipping.
  const exercise = kind === "movement" && index !== 1 && index !== 6;
  return {
    title: copy.title,
    body: copy.body + (exercise ? " " + ru.pushExerciseSafety : ""),
    url:
      kind === "food"
        ? "/nutrition"
        : kind === "movement"
          ? "/movement"
          : "/today",
    tag: `evolution-${eventKey}`,
  };
}
