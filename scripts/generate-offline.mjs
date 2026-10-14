import { writeFileSync } from "node:fs";
const ru = (await import("../src/i18n/ru.ts")).ru;
writeFileSync(
  "public/offline.html",
  `<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${ru.brand}</title><body><main><h1>${ru.brand}</h1><p>${ru.offline}</p><a href="/today">${ru.retry}</a></main></body></html>`,
);
