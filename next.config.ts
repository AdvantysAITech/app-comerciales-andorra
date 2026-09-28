import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer"],
  devIndicators: false,
  // Las plantillas PDF se leen del disco en tiempo de ejecución y el trazado no
  // las ve. Hay que listar cada ruta que pueda renderizar: la validación vive
  // fuera de /api (`/documentos/[id]/validar`) y `publicarEnCrm` puede
  // regenerar el PDF desde ahí. Las claves son globs de picomatch contra la
  // ruta, así que los corchetes del segmento dinámico van escapados.
  outputFileTracingIncludes: {
    "/api/**": ["./assets/plantillas/*.pdf"],
    "/documentos/\\[id\\]/validar": ["./assets/plantillas/*.pdf"],
  },
};

export default nextConfig;