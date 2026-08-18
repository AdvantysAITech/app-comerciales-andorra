import type { Metadata } from "next";
import { DM_Sans, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

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
    <html lang="es" className={cn("dark font-sans", geist.variable)}>
      <body className="antialiased">{children}</body>
    </html>
  );
}