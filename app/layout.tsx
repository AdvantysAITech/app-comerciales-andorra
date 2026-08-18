import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { ProveedorTema, CLAVE_TEMA } from "@/components/tema/proveedor-tema";

/**
 * Tipografia. Claude usa Styrene, que es de licencia comercial y no se puede
 * servir desde aqui. DM Sans es el sustituto libre mas cercano: mismas
 * proporciones geometricas, terminaciones rectas y una "a" de un solo piso.
 */
const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--fuente-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Plataforma Advantys",
  description: "Plataforma interna de Advantys AI",
};

/**
 * Se ejecuta antes del primer pintado, en el mismo hilo: sin esto la pagina
 * aparece en claro y salta a oscuro cuando hidrata React. Va sin formatear y
 * con try/catch porque en navegacion privada localStorage puede lanzar.
 */
const SCRIPT_TEMA = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  CLAVE_TEMA,
)});var o=t==="oscuro"||((t===null||t==="sistema")&&matchMedia("(prefers-color-scheme: dark)").matches);var e=document.documentElement;e.classList.toggle("dark",o);e.dataset.tema=o?"oscuro":"claro";}catch(_){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: el script de arriba toca <html> antes de que
    // React compare servidor y cliente. Es el unico nodo donde se espera.
    <html lang="es" className={sans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body className="antialiased">
        <ProveedorTema>{children}</ProveedorTema>
      </body>
    </html>
  );
}