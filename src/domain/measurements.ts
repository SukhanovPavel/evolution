import { z } from "zod";

const amount = (max: number) =>
  z
    .number()
    .min(20)
    .max(max)
    .refine((v) => Number(v.toFixed(1)) === v)
    .nullable();

export const measurementSchema = z
  .object({
    weight_kg: amount(500),
    chest_cm: amount(350),
    waist_cm: amount(350),
    hips_cm: amount(350),
  })
  .refine((value) => Object.values(value).some((v) => v !== null));

export type MeasurementValues = z.infer<typeof measurementSchema>;
export type Measurement = MeasurementValues & { local_date: string };
