import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { sesionActual, puedeVer } from "@/lib/permisos";
import { DEFINICION_RUTA, type Ruta } from "@/lib/domain/rutas";

export const dynamic = "force-dynamic";

const ZONA = "Europe/Andorra";

type Fila = {
  id: string;
  creado_en: string;
  validado_en: string | null;
  lead_id: string;
  leads: { empresa: string; ruta: Ruta; precio_presentado: number | null } | null;
};

export default async function Documentos() {
  const sesion = await sesionActual();
  if (!sesion || !puedeVer(sesion, "documentos")) notFound();

  const esValidador = sesion.alcances.documentos === "total";
  const supabase = await supabaseServer();

  // La RLS ya filtra por comercial, pero el filtro explícito hace que la
  // intención se lea en el código y no dependa solo de la política.
  let consulta = supabase
    .from("documentos")
    .select("id, creado_en, validado_en, lead_id, leads(empresa, ruta, precio_presentado)")
    .order("creado_en", { ascending: false })
    .limit(50);

  if (!esValidador) consulta = consulta.eq("comercial_id", sesion.usuario.id);

  const { data } = await consulta;
  const filas = (data ?? []) as unknown as Fila[];

  // Los pendientes primero: para Jacob son su bandeja de entrada, y para el
  // comercial son lo que está esperando.
  const pendientes = filas.filter((f) => !f.validado_en);
  const validados = filas.filter((f) => f.validado_en);

  return (
    <div>
      <p className="traza">{esValidador ? "Todos los documentos" : "Mis documentos"}</p>
      <h1 className="mt-2 mb-8 text-2xl font-semibold tracking-tight">Documentos</h1>

      {filas.length === 0 ? (
        <div className="border border-dashed border-line p-10 text-center">
          <p className="text-tinta-media">
            Todavía no hay ningún documento generado. Se crean desde el alta de un lead.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {pendientes.length > 0 && (
            <Grupo
              titulo={esValidador ? "Pendientes de tu validación" : "Pendientes de validar"}
              filas={pendientes}
              esValidador={esValidador}
            />
          )}
          {validados.length > 0 && (
            <Grupo titulo="Validados" filas={validados} esValidador={esValidador} />
          )}
        </div>
      )}
    </div>
  );
}

function Grupo({
  titulo,
  filas,
  esValidador,
}: {
  titulo: string;
  filas: Fila[];
  esValidador: boolean;
}) {
  return (
    <section>
      <p className="traza mb-3">{titulo}</p>
      <ul className="divide-y divide-line border border-line bg-surface">
        {filas.map((d) => {
          const fecha = new Date(d.creado_en);
          const ruta = d.leads?.ruta;
          return (
            <li key={d.id}>
              <Link
                href={esValidador ? `/documentos/${d.id}/interno` : `/documentos/${d.id}`}
                className="flex min-h-14 items-baseline justify-between gap-4 px-4 py-3 hover:bg-elevado"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {d.leads?.empresa ?? "—"}
                  </span>
                  <span className="traza mt-0.5 block truncate normal-case">
                    {ruta ? DEFINICION_RUTA[ruta].nombre : "—"}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  {!d.validado_en && (
                    <span className="traza block text-block">Sin validar</span>
                  )}
                  <span className="traza block">
                    {fecha.toLocaleDateString("es-ES", {
                      day: "2-digit",
                      month: "short",
                      timeZone: ZONA,
                    })}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}