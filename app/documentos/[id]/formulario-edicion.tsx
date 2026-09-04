"use client";

import { useState } from "react";
import type { DocumentoCliente } from "@/lib/documentos/cliente";
import { cuerpoEdicionSchema, detalleZod, type EstadoCrm } from "@/lib/documentos/edicion";

const euros = (n: number) =>
  n.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/* ------------------------------------------------------------------ */
/* Listas como texto                                                   */
/* ------------------------------------------------------------------ */

/**
 * Objetivos, exclusiones, entregables y supuestos se editan en un textarea a
 * línea por elemento, no con una fila y dos botones por punto.
 *
 * Es lo que la gente ya hace: se copia el bloque, se reordena, se borran tres
 * de golpe. Una interfaz de «añadir elemento» convierte eso en quince clics.
 */
const aLineas = (xs: string[]) => xs.join("\n");
const deLineas = (t: string) =>
  t
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

/* ------------------------------------------------------------------ */

export default function FormularioEdicion({
  id,
  doc,
  precioCalculado,
  onCancelar,
  onGuardado,
}: {
  id: string;
  doc: DocumentoCliente;
  precioCalculado: number | null;
  onCancelar: () => void;
  onGuardado: (crm: EstadoCrm) => void;
}) {
  const [empresa, setEmpresa] = useState(doc.empresa);
  const [resumen, setResumen] = useState(doc.resumen);
  const [contexto, setContexto] = useState(doc.contexto);
  const [objetivos, setObjetivos] = useState(aLineas(doc.objetivos));
  const [incluido, setIncluido] = useState(doc.incluido.map((b) => ({ ...b })));
  const [excluido, setExcluido] = useState(aLineas(doc.excluido));
  const [entregables, setEntregables] = useState(aLineas(doc.entregables));
  const [supuestos, setSupuestos] = useState(aLineas(doc.supuestos));
  const [plazoMin, setPlazoMin] = useState(String(doc.plazoSemanas.min));
  const [plazoMax, setPlazoMax] = useState(String(doc.plazoSemanas.max));
  const [precio, setPrecio] = useState(doc.precio === null ? "" : String(doc.precio));
  const [hitos, setHitos] = useState(doc.hitos.map((h) => ({ ...h })));
  const [validoHasta, setValidoHasta] = useState(doc.validoHastaIso);

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sumaHitos = hitos.reduce((s, h) => s + (Number(h.porcentaje) || 0), 0);
  const hitosCuadran = Math.round(sumaHitos) === 100;

  const precioNum = precio.trim() === "" ? null : Number(precio.replace(",", "."));
  const desviacion =
    precioNum !== null && precioCalculado !== null && precioCalculado > 0
      ? (precioNum - precioCalculado) / precioCalculado
      : null;

  async function guardar() {
    setError(null);

    const cuerpo = {
      edicion: {
        empresa,
        resumen,
        contexto,
        objetivos: deLineas(objetivos),
        incluido: incluido.map((b) => ({
          bloque: b.bloque.trim(),
          descripcion: b.descripcion.trim(),
        })),
        excluido: deLineas(excluido),
        entregables: deLineas(entregables),
        supuestos: deLineas(supuestos),
        plazoSemanas: { min: Number(plazoMin), max: Number(plazoMax) },
        hitos: hitos.map((h) => ({
          concepto: h.concepto.trim(),
          porcentaje: Number(h.porcentaje),
        })),
        validoHasta,
      },
      precio: precioNum,
    };

    // Se valida con el MISMO esquema que usa la ruta. Así el comercial ve el
    // error donde puede corregirlo, en vez de recibir un 400 desde el servidor
    // después de haber escrito medio documento.
    const revisado = cuerpoEdicionSchema.safeParse(cuerpo);
    if (!revisado.success) {
      setError(detalleZod(revisado.error));
      return;
    }

    setGuardando(true);
    try {
      const res = await fetch(`/api/documentos/${id}/editar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(revisado.data),
      });

      const datos = await res.json();

      if (!res.ok) {
        setError(datos.error ?? "No se pudo guardar la propuesta.");
        return;
      }

      onGuardado(datos.crm ?? { subidoEn: null, error: null });
    } catch {
      setError("No se pudo contactar con el servidor.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="no-imprimir mx-auto max-w-[19cm] px-6 py-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="traza">{doc.referencia}</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">Modificar propuesta</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="boton-fantasma" onClick={onCancelar} disabled={guardando}>
            Cancelar
          </button>
          <button type="button" className="boton" onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar y actualizar en el CRM"}
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-6 border-l-2 border-block bg-elevado px-4 py-3 text-sm">{error}</p>
      )}

      <p className="mb-8 text-sm text-tinta-media">
        Se regenera el PDF con estos cambios y se sustituye el archivo adjunto en la
        oportunidad del CRM. La referencia {doc.referencia} no cambia: la versión
        anterior queda archivada.
      </p>

      {/* ---------- Inversión ---------- */}
      {/* Primero el precio, que es a lo que se entra el 90 % de las veces. */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Inversión</h2>

        <label className="etiqueta" htmlFor="precio">
          Precio final (€)
        </label>
        <input
          id="precio"
          className="campo"
          inputMode="decimal"
          value={precio}
          onChange={(e) => setPrecio(e.target.value)}
          placeholder="Sin precio: el documento dirá que lo elabora el equipo técnico"
        />
        <p className="traza mt-2">
          {precioCalculado === null
            ? "El motor no calculó precio para esta ruta."
            : `Calculado por el motor: ${euros(precioCalculado)}`}
          {desviacion !== null && Math.abs(desviacion) >= 0.005 && (
            <>
              {" · "}
              {desviacion > 0 ? "+" : ""}
              {Math.round(desviacion * 100)} % sobre el calculado
            </>
          )}
        </p>

        <div className="mt-5">
          <p className="etiqueta">Forma de pago</p>
          {hitos.map((h, i) => (
            <div key={i} className="mt-2 flex gap-2">
              <input
                className="campo flex-1"
                value={h.concepto}
                onChange={(e) => {
                  const copia = [...hitos];
                  copia[i] = { ...copia[i], concepto: e.target.value };
                  setHitos(copia);
                }}
              />
              <input
                className="campo w-24"
                inputMode="numeric"
                value={h.porcentaje}
                onChange={(e) => {
                  const copia = [...hitos];
                  copia[i] = { ...copia[i], porcentaje: Number(e.target.value) || 0 };
                  setHitos(copia);
                }}
              />
              <button
                type="button"
                className="boton-fantasma"
                onClick={() => setHitos(hitos.filter((_, j) => j !== i))}
                aria-label={`Quitar el hito ${h.concepto}`}
              >
                ×
              </button>
            </div>
          ))}
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              className="boton-fantasma"
              onClick={() => setHitos([...hitos, { concepto: "", porcentaje: 0 }])}
            >
              Añadir hito
            </button>
            <span className="traza" data-error={hitosCuadran ? undefined : "true"}>
              Suma {sumaHitos} %{hitosCuadran ? "" : " · tiene que sumar 100"}
            </span>
          </div>
        </div>
      </section>

      {/* ---------- Cabecera ---------- */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Datos</h2>

        <label className="etiqueta" htmlFor="empresa">
          Empresa
        </label>
        <input
          id="empresa"
          className="campo"
          value={empresa}
          onChange={(e) => setEmpresa(e.target.value)}
        />

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="etiqueta" htmlFor="plazo-min">
              Plazo mínimo (semanas)
            </label>
            <input
              id="plazo-min"
              className="campo"
              inputMode="numeric"
              value={plazoMin}
              onChange={(e) => setPlazoMin(e.target.value)}
            />
          </div>
          <div>
            <label className="etiqueta" htmlFor="plazo-max">
              Plazo máximo (semanas)
            </label>
            <input
              id="plazo-max"
              className="campo"
              inputMode="numeric"
              value={plazoMax}
              onChange={(e) => setPlazoMax(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="etiqueta" htmlFor="validez">
            Válida hasta
          </label>
          <input
            id="validez"
            className="campo"
            type="date"
            value={validoHasta}
            onChange={(e) => setValidoHasta(e.target.value)}
          />
        </div>
      </section>

      {/* ---------- Textos ---------- */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Texto de la propuesta</h2>

        <label className="etiqueta" htmlFor="resumen">
          Resumen de apertura
        </label>
        <textarea
          id="resumen"
          className="campo"
          rows={4}
          value={resumen}
          onChange={(e) => setResumen(e.target.value)}
        />

        <label className="etiqueta mt-4 block" htmlFor="contexto">
          Contexto
        </label>
        <textarea
          id="contexto"
          className="campo"
          rows={6}
          value={contexto}
          onChange={(e) => setContexto(e.target.value)}
        />

        <label className="etiqueta mt-4 block" htmlFor="objetivos">
          Objetivos · uno por línea
        </label>
        <textarea
          id="objetivos"
          className="campo"
          rows={5}
          value={objetivos}
          onChange={(e) => setObjetivos(e.target.value)}
        />
      </section>

      {/* ---------- Alcance ---------- */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Qué incluye</h2>

        {incluido.map((b, i) => (
          <div key={i} className="mb-4 border border-line p-4">
            <div className="flex gap-2">
              <input
                className="campo flex-1"
                value={b.bloque}
                placeholder="Título del bloque"
                onChange={(e) => {
                  const copia = [...incluido];
                  copia[i] = { ...copia[i], bloque: e.target.value };
                  setIncluido(copia);
                }}
              />
              <button
                type="button"
                className="boton-fantasma"
                onClick={() => setIncluido(incluido.filter((_, j) => j !== i))}
                aria-label={`Quitar el bloque ${b.bloque}`}
              >
                ×
              </button>
            </div>
            <textarea
              className="campo mt-2"
              rows={3}
              value={b.descripcion}
              placeholder="Descripción"
              onChange={(e) => {
                const copia = [...incluido];
                copia[i] = { ...copia[i], descripcion: e.target.value };
                setIncluido(copia);
              }}
            />
          </div>
        ))}

        <button
          type="button"
          className="boton-fantasma"
          onClick={() => setIncluido([...incluido, { bloque: "", descripcion: "" }])}
        >
          Añadir bloque
        </button>

        <label className="etiqueta mt-6 block" htmlFor="excluido">
          Qué no incluye · uno por línea
        </label>
        <textarea
          id="excluido"
          className="campo"
          rows={4}
          value={excluido}
          onChange={(e) => setExcluido(e.target.value)}
        />

        <label className="etiqueta mt-4 block" htmlFor="entregables">
          Entregables · uno por línea
        </label>
        <textarea
          id="entregables"
          className="campo"
          rows={5}
          value={entregables}
          onChange={(e) => setEntregables(e.target.value)}
        />

        <label className="etiqueta mt-4 block" htmlFor="supuestos">
          Supuestos y condiciones · uno por línea
        </label>
        <textarea
          id="supuestos"
          className="campo"
          rows={5}
          value={supuestos}
          onChange={(e) => setSupuestos(e.target.value)}
        />
      </section>

      {/* Las notas legales del cierre —el IGI andorrano y la tasa del
          certificador en ISO— no aparecen aquí a propósito: son condiciones,
          no texto comercial. */}

      <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-6">
        <button type="button" className="boton-fantasma" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </button>
        <button type="button" className="boton" onClick={guardar} disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar y actualizar en el CRM"}
        </button>
      </div>
    </div>
  );
}
