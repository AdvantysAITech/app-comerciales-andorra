"use client";

export default function BotonDescargar({ id }: { id: string }) {
  return (
    <a
      className="boton"
      href={`/api/documentos/${id}/pdf`}
      target="_blank"
      rel="noreferrer"
    >
      Descargar PDF
    </a>
  );
}