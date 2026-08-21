import { NextResponse } from "next/server";
import { buscarContacto } from "@/lib/ghl/contactos";
import { getUsuarioSesion } from "@/lib/supabase/route-auth";

/** Aviso orientativo mientras el comercial rellena: ¿ya conocemos a esta persona?
 *  Es informativo. Quien decide de verdad si crea o actualiza es el upsert. */
export async function GET(request: Request) {
  if (!(await getUsuarioSesion())) {
    return NextResponse.json({ error: "Sesión caducada" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email") ?? undefined;
  const telefono = searchParams.get("telefono") ?? undefined;
  if (!email && !telefono) return NextResponse.json({ contacto: null });

  try {
    const contacto = await buscarContacto({ email, telefono });
    if (!contacto) return NextResponse.json({ contacto: null });

    return NextResponse.json({
      contacto: {
        id: contacto.id,
        nombre: contacto.contactName,
        empresa: contacto.companyName,
      },
    });
  } catch {
    // Si el lookup falla, seguimos: el upsert no duplica de todas formas.
    return NextResponse.json({ contacto: null });
  }
}