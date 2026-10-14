import { ru } from "./ru";
export type Locale = "ru" | "en";
type Translatable<T> = T extends string
  ? string
  : T extends readonly (infer V)[]
    ? readonly Translatable<V>[]
    : T extends object
      ? { [K in keyof T]: Translatable<T[K]> }
      : T;
export type Dictionary = Translatable<typeof ru>;
export const dictionaries: Partial<Record<Locale, Dictionary>> = { ru };
export function dictionary(locale: Locale = "ru") {
  return dictionaries[locale] ?? ru;
}
