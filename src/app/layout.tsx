import { RotateCcw } from "lucide-react";
import type { Metadata, Viewport } from "next";
import { Onest, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";
import { Providers } from "./providers";

// Rebrand V2: display y numerales sin identidad condensada.
const display = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

const body = Onest({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Fuelboard",
  description:
    "Telemetría personal de combustible: nutrición y rendimiento para recomposición y CrossFit.",
  applicationName: "Fuelboard",
  // PWA (Fase 4): manifest lo genera app/manifest.ts. Meta de Apple para que la
  // instalación en iOS abra en modo standalone con la barra de estado integrada.
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Fuelboard",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // El teclado reduce el viewport (en vez de superponerse): así el bottom-sheet de
  // añadir queda POR ENCIMA del teclado en iOS y su input enfocado se ve.
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f8fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1319" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} h-full antialiased`}
    >
      <body className="min-h-dvh">
        <PwaRegister>
          <Providers>{children}</Providers>
        </PwaRegister>
        {/* Bloqueo de orientación: la app está pensada en vertical. El manifest
            (orientation: portrait) lo fija en Android instalado; en navegador/iOS
            no se puede forzar, así que en móvil en horizontal mostramos este aviso
            (CSS puro: landscape + altura corta = teléfono, no tablet/escritorio). */}
        <div
          aria-hidden
          className="rotate-gate fixed inset-0 z-[200] flex-col items-center justify-center gap-3 bg-background px-8 text-center"
        >
          <RotateCcw className="size-8 text-primary" />
          <p className="text-base font-semibold text-foreground">Gira el teléfono</p>
          <p className="text-[13px] text-muted-foreground">
            Fuelboard está pensado para usarse en vertical.
          </p>
        </div>
      </body>
    </html>
  );
}
