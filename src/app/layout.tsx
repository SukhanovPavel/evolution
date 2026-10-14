import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
export const metadata: Metadata = {
  title: "Evolution — маленькие шаги",
  description: "Питание, движение и восстановление в вашем ритме",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
