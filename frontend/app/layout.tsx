import type { Metadata, Viewport } from "next";
import { Manrope, Inter, Geist_Mono } from "next/font/google";
import { Providers } from "@/app/providers";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
import { AppToaster } from "@/components/ui/sonner";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "The Curated Life",
  description:
    "Espacio personal para seguir tus finanzas, entrenamientos, compras y nutricion con calma y claridad.",
  applicationName: "The Curated Life",
  appleWebApp: {
    capable: true,
    title: "Curated Life",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f9faf2",
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${manrope.variable} ${inter.variable} ${geistMono.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <Providers>{children}</Providers>
        <ServiceWorkerRegistration />
        <AppToaster />
      </body>
    </html>
  );
}
