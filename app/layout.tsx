import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";

const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--fuente-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Plataforma Advantys",
  description: "Plataforma interna de Advantys AI",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={sans.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}