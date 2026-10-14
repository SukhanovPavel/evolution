import type { MetadataRoute } from "next";
import { ru } from "@/i18n/ru";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: ru.brand,
    short_name: ru.brand,
    description: ru.tagline,
    start_url: "/today",
    scope: "/",
    display: "standalone",
    lang: "ru",
    background_color: "#f6f7f2",
    theme_color: "#326c50",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
