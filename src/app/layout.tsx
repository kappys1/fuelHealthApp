import type { Metadata, Viewport } from "next";
import {
  Barlow_Condensed,
  Barlow_Semi_Condensed,
  Instrument_Sans,
} from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

// Display / cifras (Barlow Semi Condensed) — 05-DISENO §3
const display = Barlow_Semi_Condensed({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-display",
});

// Cifras XL del gauge (Barlow Condensed)
const condensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-condensed",
});

// Cuerpo (Instrument Sans, variable)
const body = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Fuelboard",
  description:
    "Telemetría personal de combustible: nutrición y rendimiento para recomposición y CrossFit.",
  applicationName: "Fuelboard",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F2F4EF" },
    { media: "(prefers-color-scheme: dark)", color: "#0F1613" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${display.variable} ${condensed.variable} ${body.variable} h-full antialiased`}
    >
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
