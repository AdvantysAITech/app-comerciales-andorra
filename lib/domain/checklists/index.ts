/** Punto único de entrada al motor de checklists. */

import type { Ruta } from "../rutas";
import type { Checklist } from "./tipos";
import { CHECKLIST_RUTA_1, CHECKLIST_RUTA_2 } from "./consultoria";
import { CHECKLIST_RUTA_3 } from "./implantacion-sistema";
import { CHECKLIST_RUTA_4, CHECKLIST_RUTA_5 } from "./adhoc-iso";
import { CHECKLIST_RUTA_6, CHECKLIST_RUTA_7 } from "./spinoff";

export const CHECKLISTS: Record<Ruta, Checklist> = {
  ruta_1: CHECKLIST_RUTA_1,
  ruta_2: CHECKLIST_RUTA_2,
  ruta_3: CHECKLIST_RUTA_3,
  ruta_4: CHECKLIST_RUTA_4,
  ruta_5: CHECKLIST_RUTA_5,
  ruta_6: CHECKLIST_RUTA_6,
  ruta_7: CHECKLIST_RUTA_7,
};

export * from "./tipos";
export { MODULOS_SISTEMA, MODULO_APP_MEDIDA } from "./implantacion-sistema";