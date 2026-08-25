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
  FileText
} from "lucide-react";
import type { ClaveModulo } from "@/lib/modulos";

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