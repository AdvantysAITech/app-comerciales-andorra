"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseClavePublica, supabaseUrl } from "@/lib/supabase/env";

export const supabaseBrowser = () =>
  createBrowserClient(
    supabaseUrl(),
    supabaseClavePublica(),
  );