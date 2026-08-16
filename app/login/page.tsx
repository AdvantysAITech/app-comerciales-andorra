"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar() {
    if (!email || !password) return;
    setEnviando(true);
    setError(null);

    const { error } = await supabaseBrowser().auth.signInWithPassword({ email, password });
    if (error) {
      setError("Ese email y contraseña no coinciden.");
      setEnviando(false);
      return;
    }

    router.push("/leads");
    router.refresh();
  }

  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="w-full max-w-sm">
        <p className="traza">Sistema Advantys</p>
        <h1 className="mt-2 mb-8 text-2xl font-semibold tracking-tight">App Comercial</h1>

        <div className="space-y-4 border border-line bg-surface p-6">
          <div>
            <label className="etiqueta" htmlFor="email">Email</label>
            <input
              id="email"
              className="campo"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="etiqueta" htmlFor="password">Contraseña</label>
            <input
              id="password"
              className="campo"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && entrar()}
            />
          </div>

          {error && <p className="error">{error}</p>}

          <button className="boton w-full" onClick={entrar} disabled={enviando}>
            {enviando ? "Entrando…" : "Entrar"}
          </button>
        </div>
      </div>
    </main>
  );
}