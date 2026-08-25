import type { DocumentoCliente } from "@/lib/documentos/cliente";

const euros = (n: number) =>
  n.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export default function Plantilla({ doc }: { doc: DocumentoCliente }) {
  return (
    <article className="documento">
      {/* ---------- 1 · Portada ---------- */}
      <header className="portada">
        {/* El logo negro sobre blanco: el documento se imprime, y el blanco
            desaparecería en papel. */}
        <img src="/logo-advantys-negro.svg" alt="Advantys AI" className="logo" />
        <div className="cabecera-datos">
          <p className="ref">{doc.referencia}</p>
          <p>{doc.fecha}</p>
        </div>
      </header>

      <div className="titulo">
        <p className="traza-doc">Propuesta de alcance</p>
        <h1>{doc.empresa}</h1>
      </div>

      {/* ---------- 2 · Contexto ---------- */}
      <section>
        <p className="lead">{doc.resumen}</p>
      </section>

      <section>
        <h2>Contexto</h2>
        <p>{doc.contexto}</p>
      </section>

      {/* ---------- 3 · Objetivos ---------- */}
      <section>
        <h2>Objetivos del proyecto</h2>
        <ul>{doc.objetivos.map((o, i) => <li key={i}>{o}</li>)}</ul>
      </section>

      {/* ---------- 4 · Alcance incluido ---------- */}
      <section>
        <h2>Qué incluye</h2>
        {doc.incluido.map((b, i) => (
          <div className="bloque" key={i}>
            <h3>{b.bloque}</h3>
            <p>{b.descripcion}</p>
          </div>
        ))}
      </section>

      {/* ---------- 5 · Alcance excluido ---------- */}
      {doc.excluido.length > 0 && (
        <section>
          <h2>Qué no incluye</h2>
          <ul>{doc.excluido.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </section>
      )}

      {/* ---------- 6 · Entregables ---------- */}
      <section>
        <h2>Entregables</h2>
        <ul>{doc.entregables.map((e, i) => <li key={i}>{e}</li>)}</ul>
      </section>

      {/* ---------- 7 · Plazo ---------- */}
      <section>
        <h2>Plazo orientativo</h2>
        <p>
          Entre <strong>{doc.plazoSemanas.min}</strong> y{" "}
          <strong>{doc.plazoSemanas.max}</strong> semanas desde la firma, sujeto a la
          disponibilidad de la información y los accesos indicados en los supuestos.
        </p>
      </section>

      {/* ---------- 8 · Inversión ---------- */}
      <section className="inversion">
        <h2>Inversión</h2>
        {doc.precio === null ? (
          <p>
            El presupuesto de este proyecto lo elabora nuestro equipo técnico y se
            envía en un plazo de cinco días laborables.
          </p>
        ) : (
          <>
            {/* Un solo importe. Nunca un rango: el rango es interno. */}
            <p className="importe">{euros(doc.precio)}</p>
            <table>
              <tbody>
                {doc.hitos.map((h, i) => (
                  <tr key={i}>
                    <td>{h.concepto}</td>
                    <td className="pct">{h.porcentaje}%</td>
                    <td className="pct">{euros((doc.precio! * h.porcentaje) / 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>

      {/* ---------- 9 · Supuestos ---------- */}
      {doc.supuestos.length > 0 && (
        <section>
          <h2>Supuestos y condiciones</h2>
          <ul>{doc.supuestos.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </section>
      )}

      {/* ---------- 10 · Validez ---------- */}
      <section className="cierre">
        <h2>Validez y próximos pasos</h2>
        <p>
          Esta propuesta es válida hasta el <strong>{doc.validoHasta}</strong>. Para
          avanzar, basta con confirmarnos la aceptación: a partir de ahí acordamos la
          fecha de arranque y elaboramos el documento de especificación detallada.
        </p>
        <ul className="notas">{doc.notas.map((n, i) => <li key={i}>{n}</li>)}</ul>
      </section>

      <footer>
        Advantys AI SL · Andorra la Vella, Principat d&apos;Andorra · {doc.referencia}
      </footer>
    </article>
  );
}