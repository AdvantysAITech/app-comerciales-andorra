import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refresca la sesión de Supabase en cada petición y decide quién pasa.
 * Sin esto, el token expira y los Server Components ven al usuario como anónimo.
 */

/** Rutas que NO pueden pasar por el control de sesión de aquí porque se
 *  autentican por su cuenta con otro mecanismo.
 *
 *  El cron de Vercel llama a /api/ghl/spinoffs/sync con una cabecera
 *  `Authorization: Bearer CRON_SECRET`, sin cookie de sesión. Con el matcher
 *  anterior el middleware lo redirigía a /login con un 307 y la ruta nunca
 *  llegaba a leer la cabecera: la caché de spin-offs llevaba sin refrescarse
 *  desde que se montó el cron. La ruta ya valida el secreto ella misma. */
const RUTAS_AUTOGESTIONADAS = ["/api/ghl/spinoffs/sync"];

export async function middleware(request: NextRequest) {
  const ruta = request.nextUrl.pathname;

  if (RUTAS_AUTOGESTIONADAS.some((r) => ruta === r || ruta.startsWith(r + "/"))) {
    return NextResponse.next();
  }

  let respuesta = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (items) => {
          items.forEach(({ name, value }) => request.cookies.set(name, value));
          respuesta = NextResponse.next({ request });
          items.forEach(({ name, value, options }) =>
            respuesta.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() valida el token contra Supabase. No uses getSession() aquí:
  // lee la cookie sin verificarla y es falsificable.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const esRutaPublica = ruta.startsWith("/login");

  // Sin sesión y fuera del login → al login
  if (!user && !esRutaPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Con sesión y en el login → a la raíz.
  //
  // Antes esto mandaba a /leads directamente, y un usuario sin permiso de
  // captación aterrizaba en una pantalla que no puede ver. El middleware corre
  // en el Edge y no puede consultar permisos sin encarecer cada petición, así
  // que la decisión se delega a app/(app)/page.tsx, que ya tiene la sesión
  // resuelta y el catálogo de módulos delante.
  if (user && esRutaPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return respuesta;
}

export const config = {
  matcher: [
    /*
     * Todo excepto estáticos e imágenes. Las rutas /api SÍ pasan por aquí
     * a propósito: /api/leads escribe en GHL y no puede quedar abierta.
     * Las excepciones puntuales van en RUTAS_AUTOGESTIONADAS, no aquí: así
     * quedan documentadas con su motivo en vez de escondidas en una regexp.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};