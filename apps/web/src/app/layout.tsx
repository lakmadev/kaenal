import type { Metadata, Viewport } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { themeInitScript } from "@/lib/theme";
import "@/styles/globals.css";

/**
 * Fonts are self-hosted via `next/font` (no layout shift, no third-party
 * request): Archivo for UI, JetBrains Mono for entity codes/IDs/numbers (04 §2).
 * Their CSS variables feed the design tokens (see `globals.css`).
 */
const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Kaenal", template: "%s · Kaenal" },
  description: "Quality & Safety Management for regulated manufacturing.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f4f5" },
    { media: "(prefers-color-scheme: dark)", color: "#131315" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <html lang="en" className={`${archivo.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <head>
        {/* Sets data-theme before paint to prevent a flash of the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
