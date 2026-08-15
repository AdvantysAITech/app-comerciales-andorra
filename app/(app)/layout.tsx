import Link from "next/link";
import { usuarioActual } from "@/lib/supabase/server";
import CerrarSesion from "@/app/(app)/components/cerrar-sesion";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await usuarioActual();

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-3">
          <Link href="/leads" className="text-sm font-semibold tracking-tight">
            Advantys · App Comercial
          </Link>
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/leads/nuevo" className="hover:text-accent">Nuevo lead</Link>
            <Link href="/leads" className="hover:text-accent">Mis leads</Link>
            <span className="traza hidden sm:inline">{user?.email}</span>
            <CerrarSesion />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">{children}</main>
    </div>
  );
}