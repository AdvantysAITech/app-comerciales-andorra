import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { construirDocumentoCliente } from "@/lib/documentos/cliente";
import type { Alcance } from "@/lib/ia/salida";
import type { Ruta } from "@/lib/domain/rutas";
import Plantilla from "./plantilla";
import BotonDescargar from "./boton-imprimir";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await supabaseServer();

  const { data: doc } = await supabase
    .from("documentos")
    .select("lead_id")
    .eq("id", id)
    .maybeSingle();

  if (!doc) return { title: "Propuesta Advantys" };

  const { data: lead } = await supabase
    .from("leads")
    .select("empresa")
    .eq("id", doc.lead_id)
    .maybeSingle();

  return {
    title: lead?.empresa
      ? `Propuesta Advantys · ${lead.empresa}`
      : "Propuesta Advantys",
  };
}

export default async function VerDocumento({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // En Next 15+ `params` es una promesa. Se extrae UNA vez aquí y se usa la
  // variable `id` en todo lo demás: pasar `params.id` sin await da undefined,
  // y el enlace de descarga acaba apuntando a /api/documentos/undefined/pdf.
  const { id } = await params;

  const supabase = await supabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  // La RLS de `documentos` ya filtra por comercial. Si la fila no aparece, o no
  // existe o no es suya: en ambos casos 404, y sin dar pistas de cuál de las dos.
  const { data: doc } = await supabase
    .from("documentos")
    .select("id, alcance, validado_en, lead_id")
    .eq("id", id)
    .maybeSingle();

  if (!doc) notFound();

  const { data: lead } = await supabase
    .from("leads")
    .select("uuid_origen, empresa, ruta, precio_presentado")
    .eq("id", doc.lead_id)
    .maybeSingle();

  if (!lead) notFound();

  const documento = construirDocumentoCliente({
    alcance: doc.alcance as Alcance,
    ruta: lead.ruta as Ruta,
    uuid: lead.uuid_origen,
    empresa: lead.empresa,
    precio: lead.precio_presentado,
  });

  /**
   * La validación ya NO bloquea la descarga (decisión de Jacob, 24/08/2026,
   * que modifica el punto 7.6 del DERCAS): el comercial descarga el PDF en
   * cuanto se genera.
   *
   * `validado_en` se conserva y se sigue mostrando aquí porque documenta si
   * la propuesta ha pasado revisión, y esa información le sirve al comercial
   * para decidir si la manda ya o espera. Pero es un aviso, no una puerta.
   */
  const validado = Boolean(doc.validado_en);

  return (
    <>
      <div className="no-imprimir mx-auto flex max-w-[19cm] flex-wrap items-center justify-between gap-3 px-6 py-4">
        <p className="traza">
          {documento.referencia}
          {!validado && (
            <span className="text-block"> · pendiente de validación</span>
          )}
        </p>
        <BotonDescargar id={id} />
      </div>

      {!validado && (
        <div className="no-imprimir mx-auto max-w-[19cm] px-6 pb-4">
          <p className="border-l-2 border-block bg-elevado px-4 py-3 text-sm">
            Esta propuesta todavía no la ha revisado Jacob. Puedes descargarla,
            pero repásala antes de enviársela al cliente.
          </p>
        </div>
      )}

      <Plantilla doc={documento} />
    </>
  );
}