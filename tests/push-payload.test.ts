import { describe, expect, it } from "vitest";
import { pushPayload } from "@/domain/push-payload";
import { ru } from "@/i18n/ru";

describe("varied push copy", () => {
  it.each([30, 60, 90, 120])(
    "varies every scheduled slot at %i minute intervals",
    (interval) => {
      const titles: string[] = [];
      for (
        let minute = 9 * 60 + interval;
        minute < 18 * 60;
        minute += interval
      ) {
        const time = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
        const key = `2026-11-13:${time}:movement`;
        const payload = pushPayload("movement", key);
        titles.push(payload.title);
        expect(payload).toEqual(pushPayload("movement", key));
        expect(payload.tag).toBe(`evolution-${key}`);
        expect(payload.url).toBe("/movement");
        expect(payload.body.length).toBeLessThanOrEqual(400);
      }
      expect(new Set(titles).size).toBeGreaterThan(1);
      expect(
        titles.every((title, i) => i === 0 || title !== titles[i - 1]),
      ).toBe(true);
    },
  );

  it("cycles through all movement options, including quiet breaks and safe alternatives", () => {
    const bodies = Array.from(
      { length: 11 },
      (_, day) =>
        pushPayload(
          "movement",
          `2026-11-${String(day + 1).padStart(2, "0")}:10:00:movement`,
        ).body,
    );
    expect(new Set(bodies).size).toBe(11);
    expect(bodies.some((body) => body.includes("приседаний"))).toBe(true);
    expect(bodies.some((body) => body.includes("отжиманий от стены"))).toBe(
      true,
    );
    expect(bodies.some((body) => body.includes("Без турника"))).toBe(true);
    expect(
      bodies.filter((body) => body.includes(ru.pushExerciseSafety)),
    ).toHaveLength(9);
  });

  it.each(["food", "rest"])(
    "varies %s across days without exercise instructions",
    (kind) => {
      const messages = Array.from({ length: 5 }, (_, day) =>
        pushPayload(kind, `2026-11-${day + 10}:12:30:movement`),
      );
      expect(new Set(messages.map((m) => m.title)).size).toBe(5);
      for (const message of messages) {
        expect(message.body).not.toContain(ru.pushExerciseSafety);
        expect(message.url).toBe(kind === "food" ? "/nutrition" : "/today");
      }
    },
  );

  it("keeps test notifications and malformed-key fallbacks usable", () => {
    expect(pushPayload("test", "test").body).toBe(ru.pushTestBody);
    expect(pushPayload("movement", "invalid").title).toBeTruthy();
  });
});
