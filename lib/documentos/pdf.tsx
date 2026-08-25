/**
 * Plantilla PDF del documento de cliente.
 *
 * Gemela de app/documentos/[id]/plantilla.tsx: mismo contenido, mismas diez
 * secciones, distinto motor de dibujo. Las dos consumen `DocumentoCliente`,
 * así que la frontera de confidencialidad se cumple una sola vez, en
 * lib/documentos/cliente.ts. Aquí no se decide qué se enseña: solo cómo.
 */
import {
  Document, Page, Text, View, Image, StyleSheet, Font,
} from "@react-pdf/renderer";
import type { DocumentoCliente } from "./cliente";

const TINTA = "#1a1a1a";
const SUAVE = "#555555";
const LINEA = "#d8d4cd";
const ACENTO = "#c8553d";

// Helvetica es una de las fuentes base del formato PDF: no hay que embeberla y
// cubre los acentos del español y el símbolo del euro.
Font.registerHyphenationCallback((palabra) => [palabra]); // sin guionado

const e = StyleSheet.create({
  pagina: {
    paddingTop: 40, paddingBottom: 50, paddingHorizontal: 45,
    fontFamily: "Helvetica", fontSize: 9.5, lineHeight: 1.55, color: TINTA,
  },

  portada: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    paddingBottom: 10, borderBottomWidth: 1.5, borderBottomColor: TINTA,
  },
  logo: { width: 130 },
  cabecera: { alignItems: "flex-end" },
  ref: { fontFamily: "Helvetica-Bold", fontSize: 8.5, letterSpacing: 0.5 },
  fecha: { fontSize: 8.5, color: SUAVE, marginTop: 2 },

  traza: {
    fontSize: 7.5, letterSpacing: 1.2, color: ACENTO,
    textTransform: "uppercase", marginTop: 34,
  },
  h1: { fontFamily: "Helvetica-Bold", fontSize: 22, marginTop: 6, marginBottom: 26 },
  lead: { fontSize: 11, lineHeight: 1.5, marginBottom: 24 },

  seccion: { marginBottom: 20 },
  h2: {
    fontSize: 7.5, letterSpacing: 1, color: SUAVE, textTransform: "uppercase",
    paddingBottom: 4, marginBottom: 9, borderBottomWidth: 0.5, borderBottomColor: LINEA,
  },

  bloque: { marginBottom: 10, paddingLeft: 9, borderLeftWidth: 1.5, borderLeftColor: LINEA },
  h3: { fontFamily: "Helvetica-Bold", fontSize: 10, marginBottom: 2 },
  bloqueTexto: { color: SUAVE },

  item: { flexDirection: "row", marginBottom: 4 },
  punto: { width: 10, color: SUAVE },

  inversion: { padding: 14, backgroundColor: "#faf8f5", borderWidth: 0.5, borderColor: LINEA },
  importe: { fontFamily: "Helvetica-Bold", fontSize: 21, marginBottom: 10 },
  fila: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: 4, borderTopWidth: 0.5, borderTopColor: LINEA,
  },
  cifra: { width: 70, textAlign: "right" },

  notas: { marginTop: 12 },
  nota: { fontSize: 8, color: SUAVE, paddingLeft: 8, borderLeftWidth: 1.5, borderLeftColor: LINEA, marginBottom: 6 },

  pie: {
    position: "absolute", bottom: 24, left: 45, right: 45,
    paddingTop: 6, borderTopWidth: 0.5, borderTopColor: LINEA,
    fontSize: 7.5, color: SUAVE, textAlign: "center",
  },
});

const euros = (n: number) =>
  n.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

const Lista = ({ items }: { items: string[] }) => (
  <>
    {items.map((t, i) => (
      <View style={e.item} key={i} wrap={false}>
        <Text style={e.punto}>·</Text>
        <Text style={{ flex: 1 }}>{t}</Text>
      </View>
    ))}
  </>
);

export function DocumentoPdf({ doc, logo }: { doc: DocumentoCliente; logo: string }) {
  return (
    <Document
      title={`Propuesta Advantys · ${doc.empresa}`}
      author="Advantys AI SL"
      subject={doc.referencia}
    >
      <Page size="A4" style={e.pagina}>
        <View style={e.portada} fixed={false}>
          <Image src={logo} style={e.logo} />
          <View style={e.cabecera}>
            <Text style={e.ref}>{doc.referencia}</Text>
            <Text style={e.fecha}>{doc.fecha}</Text>
          </View>
        </View>

        <Text style={e.traza}>Propuesta de alcance</Text>
        <Text style={e.h1}>{doc.empresa}</Text>

        <Text style={e.lead}>{doc.resumen}</Text>

        <View style={e.seccion}>
          <Text style={e.h2}>Contexto</Text>
          <Text>{doc.contexto}</Text>
        </View>

        <View style={e.seccion}>
          <Text style={e.h2}>Objetivos del proyecto</Text>
          <Lista items={doc.objetivos} />
        </View>

        <View style={e.seccion}>
          <Text style={e.h2}>Qué incluye</Text>
          {doc.incluido.map((b, i) => (
            // wrap={false} impide que un bloque se parta entre dos páginas.
            <View style={e.bloque} key={i} wrap={false}>
              <Text style={e.h3}>{b.bloque}</Text>
              <Text style={e.bloqueTexto}>{b.descripcion}</Text>
            </View>
          ))}
        </View>

        {doc.excluido.length > 0 && (
          <View style={e.seccion}>
            <Text style={e.h2}>Qué no incluye</Text>
            <Lista items={doc.excluido} />
          </View>
        )}

        <View style={e.seccion}>
          <Text style={e.h2}>Entregables</Text>
          <Lista items={doc.entregables} />
        </View>

        <View style={e.seccion}>
          <Text style={e.h2}>Plazo orientativo</Text>
          <Text>
            Entre {doc.plazoSemanas.min} y {doc.plazoSemanas.max} semanas desde la
            firma, sujeto a la disponibilidad de la información y los accesos
            indicados en los supuestos.
          </Text>
        </View>

        <View style={[e.seccion, e.inversion]} wrap={false}>
          <Text style={e.h2}>Inversión</Text>
          {doc.precio === null ? (
            <Text>
              El presupuesto de este proyecto lo elabora nuestro equipo técnico y se
              envía en un plazo de cinco días laborables.
            </Text>
          ) : (
            <>
              {/* Un solo importe. El rango y el suelo son internos. */}
              <Text style={e.importe}>{euros(doc.precio)}</Text>
              {doc.hitos.map((h, i) => (
                <View style={e.fila} key={i}>
                  <Text style={{ flex: 1 }}>{h.concepto}</Text>
                  <Text style={e.cifra}>{h.porcentaje}%</Text>
                  <Text style={e.cifra}>{euros((doc.precio! * h.porcentaje) / 100)}</Text>
                </View>
              ))}
            </>
          )}
        </View>

        {doc.supuestos.length > 0 && (
          <View style={e.seccion}>
            <Text style={e.h2}>Supuestos y condiciones</Text>
            <Lista items={doc.supuestos} />
          </View>
        )}

        <View style={e.seccion}>
          <Text style={e.h2}>Validez y próximos pasos</Text>
          <Text>
            Esta propuesta es válida hasta el {doc.validoHasta}. Para avanzar, basta
            con confirmarnos la aceptación: a partir de ahí acordamos la fecha de
            arranque y elaboramos el documento de especificación detallada.
          </Text>
          <View style={e.notas}>
            {doc.notas.map((n, i) => (
              <Text style={e.nota} key={i}>{n}</Text>
            ))}
          </View>
        </View>

        <Text style={e.pie} fixed>
          Advantys AI SL · Andorra la Vella, Principat d&apos;Andorra · {doc.referencia}
        </Text>
      </Page>
    </Document>
  );
}