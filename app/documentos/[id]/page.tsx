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
   * 7.6 distingue VER de ENTREGAR.
   *
   * El comercial ve siempre su propuesta en pantalla: la genera él, y sin
   * poder leerla trabaja a ciegas hasta que alguien la valide. Lo que queda
   * bloqueado hasta la validación es la DESCARGA, porque el PDF es lo que se
   * reenvía por email y lo que acaba en manos del cliente.
   *
   * Este bloque solo decide qué se pinta. El control que de verdad cuenta está
   * en el route handler del PDF, que devuelve 403 mientras `validado_en` sea
   * null: una URL de descarga se comparte sin pensarlo, una pantalla no.
   *
   * Esta vista es siempre la del cliente — sin horas, sin suelo de negociación
   * y sin desviación. Eso vive en /documentos/[id]/interno, con alcance total.
   */
  const validado = Boolean(doc.validado_en);

  return (
    <>
      <div className="no-imprimir mx-auto flex max-w-[19cm] flex-wrap items-center justify-between gap-3 px-6 py-4">
        <p className="traza">{documento.referencia}</p>
        {validado ? (
          <BotonDescargar id={id} />
        ) : (
          <p className="traza normal-case text-tinta-media">
            Pendiente de validación · todavía no se puede descargar
          </p>
        )}
      </div>

      {!validado && (
        <div className="no-imprimir mx-auto max-w-[19cm] px-6 pb-4">
          <p className="border-l-2 border-block bg-elevado px-4 py-3 text-sm">
            Así queda la propuesta. Jacob tiene que revisarla antes de que pueda
            entregarse al cliente: hasta entonces el PDF no está disponible.
          </p>
        </div>
      )}

      <Plantilla doc={documento} />
    </>
  );
}