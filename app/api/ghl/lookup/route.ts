import { NextResponse } from "next/server";
import { buscarContacto } from "@/lib/ghl/contactos";
import { tieneConflictoIndependencia } from "@/lib/ghl/oportunidades";
import { usuarioActual } from "@/lib/supabase/server";

/** Aviso orientativo mientras el comercial rellena. La validación real es POST /api/leads. */
export async function GET(request: Request) {
  if (!(await usuarioActual())) {
    return NextResponse.json({ error: "Sesión caducada" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email") ?? undefined;
  const telefono = searchParams.get("telefono") ?? undefined;
  if (!email && !telefono) return NextResponse.json({ contacto: null });

  try {
    const contacto = await buscarContacto({ email, telefono });
    if (!contacto) return NextResponse.json({ contacto: null, conflictoAuditoria: false });

    const { conflicto } = await tieneConflictoIndependencia(contacto.id);
    return NextResponse.json({
      contacto: {
        id: contacto.id,
        nombre: contacto.contactName,
        empresa: contacto.companyName,
      },
      conflictoAuditoria: conflicto,
    });
  } catch {
    // Si el lookup falla, seguimos: el upsert no duplica de todas formas.
    return NextResponse.json({ contacto: null, conflictoAuditoria: false });
  }
}