import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { sesionActual } from "@/lib/permisos";
import { DEFINICION_RUTA, type Ruta } from "@/lib/domain/rutas";
import type { Alcance } from "@/lib/ia/salida";
import BotonValidar from "./boton-validar";

export const dynamic = "force-dynamic";

const euros = (n: number) =>
  n.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export default async function DocumentoInterno({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  /**
   * Solo alcance total. Esta pantalla enseña horas, suelo de negociación y
   * desviación — justo lo que la sección 8 prohíbe mostrar al comercial.
   *
   * Va aquí, en el servidor que compone la página, y no ocultando campos: si
   * los datos viajaran al navegador, estarían a un clic en las herramientas
   * de desarrollador aunque no se pintaran.
   */
  const sesion = await sesionActual();
  if (!sesion || sesion.alcances.documentos !== "total") notFound();

  const supabase = await supabaseServer();

  const { data: doc } = await supabase
    .from("documentos")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!doc) notFound();

  const { data: lead } = await supabase
    .from("leads")
    .select("empresa, ruta, precio_presentado, precio_suelo, precio_desglose, motivos_revision, comercial_email")
    .eq("id", doc.lead_id)
    .maybeSingle();
  if (!lead) notFound();

  const alcance = doc.alcance as Alcance;
  const desglose = (lead.precio_desglose ?? []) as { concepto: string; importe: number }[];
  const motivos = (lead.motivos_revision ?? []) as string[];

  const horas = alcance.alcance_incluido.reduce(
    (s, b) => s + (b.horas_min + b.horas_max) / 2,
    0,
  );

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <p className="traza">Documento interno · no se entrega al cliente</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{lead.empresa}</h1>
      <p className="mt-1 text-sm text-tinta-media">
        {DEFINICION_RUTA[lead.ruta as Ruta].nombre} · recogido por {lead.comercial_email}
      </p>

      {motivos.length > 0 && (
        <div className="mt-6 border-l-2 border-block bg-elevado px-5 py-4">
          <p className="traza">Por qué necesita revisión</p>
          <ul className="mt-2 space-y-1 text-sm">
            {motivos.map((m, i) => <li key={i}>· {m}</li>)}
          </ul>
        </div>
      )}

      <section className="mt-8">
        <p className="traza mb-3">Precio</p>
        <table className="w-full text-sm">
          <tbody>
            {desglose.map((l, i) => (
              <tr key={i} className="border-t border-line">
                <td className="py-2">{l.concepto}</td>
                <td className="py-2 text-right tabular-nums">{euros(l.importe)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-line font-medium">
              <td className="py-2">Calculado por el motor</td>
              <td className="py-2 text-right tabular-nums">
                {lead.precio_presentado === null ? "—" : euros(lead.precio_presentado)}
              </td>
            </tr>
            {/* El precio editado a mano es libre y no se bloquea (decisión de
                Jacob, 04/09/2026). Que aparezca aquí, junto al calculado, es
                lo único que convierte «sin límite» en «sin límite y a la
                vista»: sin esta fila, un descuento del 40 % sería invisible
                en la única pantalla que se revisa. */}
            {doc.precio_editado !== null && doc.precio_editado !== undefined && (
              <tr className="border-t border-line font-medium">
                <td className="py-2">
                  Modificado a mano
                  {lead.precio_presentado ? (
                    <span className="text-tinta-media">
                      {" "}
                      ·{" "}
                      {doc.precio_editado > lead.precio_presentado ? "+" : ""}
                      {Math.round(
                        ((doc.precio_editado - lead.precio_presentado) /
                          lead.precio_presentado) *
                          100,
                      )}
                      %
                    </span>
                  ) : null}
                </td>
                <td className="py-2 text-right tabular-nums">{euros(doc.precio_editado)}</td>
              </tr>
            )}
            <tr className="border-t border-line text-tinta-media">
              <td className="py-2">No bajes de</td>
              <td className="py-2 text-right tabular-nums">
                {lead.precio_suelo === null ? "—" : euros(lead.precio_suelo)}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mt-8">
        <p className="traza mb-3">Horas por bloque</p>
        <table className="w-full text-sm">
          <tbody>
            {alcance.alcance_incluido.map((b, i) => (
              <tr key={i} className="border-t border-line">
                <td className="py-2">{b.bloque}</td>
                <td className="py-2 text-right tabular-nums">
                  {b.horas_min}–{b.horas_max} h
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-line font-medium">
              <td className="py-2">Total estimado</td>
              <td className="py-2 text-right tabular-nums">{horas} h</td>
            </tr>
          </tbody>
        </table>

        {doc.baseline_horas !== null && (
          <p className="traza mt-3 normal-case">
            Baseline determinista: {doc.baseline_horas} h · desviación{" "}
            {doc.desviacion === null ? "—" : `${Math.round(Number(doc.desviacion) * 100)}%`}
          </p>
        )}
      </section>

      {alcance.riesgos.length > 0 && (
        <section className="mt-8">
          <p className="traza mb-3">Riesgos (todos)</p>
          <ul className="space-y-1 text-sm">
            {alcance.riesgos.map((r, i) => <li key={i}>· {r}</li>)}
          </ul>
        </section>
      )}

      {alcance.avisos.length > 0 && (
        <section className="mt-8">
          <p className="traza mb-3">Avisos de la IA</p>
          <ul className="space-y-1 text-sm">
            {alcance.avisos.map((a, i) => <li key={i}>· {a}</li>)}
          </ul>
        </section>
      )}

      <p className="traza mt-8 normal-case">
        Generado con {doc.modelo}, prompt {doc.version_prompt} · confianza {alcance.confianza}
      </p>

      <div className="mt-10 flex flex-wrap items-center gap-4 border-t border-line pt-6">
        {doc.validado_en ? (
          <>
            <p className="text-sm text-tinta-media">
              Validado el{" "}
              {new Date(doc.validado_en).toLocaleString("es-ES", { dateStyle: "long" })}
            </p>
            <Link href={`/documentos/${id}`} className="boton-fantasma">
              Ver el documento del cliente
            </Link>
          </>
        ) : (
          <BotonValidar id={id} />
        )}
      </div>
    </div>
  );
}