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

  /**
   * 7.6: el documento de cliente no se puede ver hasta que Jacob valida.
   *
   * Esta comprobación protege la PANTALLA. La que protege el fichero está en
   * el route handler del PDF, y es la que de verdad cuenta: una URL de
   * descarga es lo que alguien reenvía por email sin pensarlo.
   */
  if (!doc.validado_en) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <p className="traza">Pendiente de validación</p>
        <p className="mt-3 text-sm text-tinta-media">
          Este documento todavía no está validado. Jacob tiene que revisarlo antes
          de que pueda entregarse al cliente.
        </p>
      </div>
    );
  }

  const documento = construirDocumentoCliente({
    alcance: doc.alcance as Alcance,
    ruta: lead.ruta as Ruta,
    uuid: lead.uuid_origen,
    empresa: lead.empresa,
    precio: lead.precio_presentado,
  });

  return (
    <>
      <div className="no-imprimir mx-auto flex max-w-[19cm] items-center justify-between px-6 py-4">
        <p className="traza">{documento.referencia}</p>
        <BotonDescargar id={id} />
      </div>

      <Plantilla doc={documento} />
    </>
  );
}