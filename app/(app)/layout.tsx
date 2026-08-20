import { redirect } from "next/navigation";
import { Marco } from "@/components/shell/marco";
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
    <Marco modulos={sesion.modulos} usuario={sesion.usuario}>
      {children}
    </Marco>
  );
}