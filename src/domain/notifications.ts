import { z } from "zod";
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const notificationSettingsSchema = z
  .object({
    enabled: z.boolean(),
    food_enabled: z.boolean(),
    food_time: time,
    movement_enabled: z.boolean(),
    work_start: time,
    work_end: time,
    movement_interval: z.union([
      z.literal(30),
      z.literal(60),
      z.literal(90),
      z.literal(120),
    ]),
    weekdays_only: z.boolean(),
  })
  .refine((v) => v.work_start < v.work_end, {
    path: ["work_end"],
    message: "INVALID_WORK_WINDOW",
  });
export type NotificationSettings = z.infer<typeof notificationSettingsSchema>;
export const defaultNotificationSettings: NotificationSettings = {
  enabled: false,
  food_enabled: true,
  food_time: "12:30",
  movement_enabled: true,
  work_start: "09:00",
  work_end: "18:00",
  movement_interval: 60,
  weekdays_only: true,
};
export function allowedPushEndpoint(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      ([
        "fcm.googleapis.com",
        "updates.push.services.mozilla.com",
        "web.push.apple.com",
      ].includes(url.hostname) ||
        url.hostname.endsWith(".notify.windows.com"))
    );
  } catch {
    return false;
  }
}
export const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2048).refine(allowedPushEndpoint),
  keys: z.object({
    p256dh: z.string().regex(/^[A-Za-z0-9_-]{87}=$|^[A-Za-z0-9_-]{87}$/),
    auth: z.string().regex(/^[A-Za-z0-9_-]{22}(==)?$/),
  }),
});
