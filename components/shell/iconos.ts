/**
 * Mapa clave de modulo -> icono.
 *
 * Separado del catalogo porque un componente de React no es serializable y no puede
 * viajar de un Server Component a un Client Component. Solo se importa desde cliente.
 */
import type { LucideIcon } from "lucide-react";
import {
  UserPlus,
  Nfc,
  ClipboardList,
  ShieldCheck,
  Building2,
  TrendingUp,
  Settings,
  FileText,
  SquareKanban,
  Wrench,
} from "lucide-react";
import type { ClaveModulo } from "@/lib/modulos";
import type { ClaveEnlaceExterno } from "@/lib/enlaces-externos";

export const ICONOS: Record<ClaveModulo, LucideIcon> = {
  captacion: UserPlus,
  nfc: Nfc,
  consultoria: ClipboardList,
  iso42001: ShieldCheck,
  spinoffs: Building2,
  rentabilidad: TrendingUp,
  admin: Settings,
  documentos: FileText,
};

/**
 * Iconos de los accesos externos. Mapa aparte del de modulos porque las claves
 * son de otro tipo: asi TypeScript obliga a dar icono a cada enlace nuevo y no
 * deja mezclar una clave de modulo con una de enlace por descuido.
 */
export const ICONOS_EXTERNOS: Record<ClaveEnlaceExterno, LucideIcon> = {
  crm: SquareKanban,
  soporte: Wrench,
};