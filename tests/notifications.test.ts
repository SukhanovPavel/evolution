import { describe, it, expect } from "vitest";
import {
  allowedPushEndpoint,
  defaultNotificationSettings,
  notificationSettingsSchema,
  subscriptionSchema,
} from "@/domain/notifications";
describe("notification settings and delivery targets", () => {
  it("defaults to opt-out and rejects overnight/invalid schedules", () => {
    expect(defaultNotificationSettings.enabled).toBe(false);
    expect(
      notificationSettingsSchema.safeParse(defaultNotificationSettings).success,
    ).toBe(true);
    expect(
      notificationSettingsSchema.safeParse({
        ...defaultNotificationSettings,
        work_start: "18:00",
        work_end: "09:00",
      }).success,
    ).toBe(false);
    expect(
      notificationSettingsSchema.safeParse({
        ...defaultNotificationSettings,
        movement_interval: 1,
      }).success,
    ).toBe(false);
    expect(
      notificationSettingsSchema.safeParse({
        ...defaultNotificationSettings,
        food_time: "25:00",
      }).success,
    ).toBe(false);
  });
  it("allows known providers and blocks SSRF/credentials/alternate ports", () => {
    expect(
      allowedPushEndpoint("https://fcm.googleapis.com/fcm/send/test"),
    ).toBe(true);
    expect(allowedPushEndpoint("https://web.push.apple.com/test")).toBe(true);
    for (const url of [
      "http://fcm.googleapis.com/x",
      "https://127.0.0.1/x",
      "https://fcm.googleapis.com.evil.test/x",
      "https://user@fcm.googleapis.com/x",
      "https://fcm.googleapis.com:8443/x",
    ])
      expect(allowedPushEndpoint(url)).toBe(false);
  });
  it("rejects malformed encryption keys", () => {
    expect(
      subscriptionSchema.safeParse({
        endpoint: "https://fcm.googleapis.com/fcm/send/test",
        keys: { p256dh: "bad", auth: "bad" },
      }).success,
    ).toBe(false);
  });
});
