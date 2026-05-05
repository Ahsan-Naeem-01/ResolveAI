import { createClient } from "@supabase/supabase-js";

/* Reads VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from frontend-vite/.env.
   Both are safe to ship in the browser bundle — Supabase enforces auth
   server-side using JWT signatures. */

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.error(
    "[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. " +
      "Copy frontend-vite/.env.example to frontend-vite/.env and fill it in."
  );
}

export const supabase = createClient(url || "http://localhost", anonKey || "anon", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const isSupabaseConfigured = Boolean(url && anonKey);
