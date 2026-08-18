import { redirect } from "next/navigation";
import { Navbar } from "@/components/shell/navbar";
import { sesionActual } from "@/lib/permisos";

export default async function LayoutApp({
  children,
}: {
  children: React.ReactNode;
}) {
  const sesion = await sesionActual();

  // Defensa en profundidad: el middleware ya filtra, pero si alguien pierde el perfil
  // o se le desactiva mientras tiene sesion abierta, aqui se corta igualmente.
  if (!sesion) redirect("/login");

  return (
    <div className="flex h-dvh bg-lienzo">
      <Navbar modulos={sesion.modulos} usuario={sesion.usuario} />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-10 py-12">{children}</div>
      </main>
    </div>
  );
}