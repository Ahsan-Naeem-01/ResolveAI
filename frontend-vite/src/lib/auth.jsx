import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase, isSupabaseConfigured } from "./supabase.js";

/* Auth state — wraps Supabase Auth in a React context.

   `user` shape (subset of Supabase user object plus a derived `role`):
     { id, email, name, initials, role }
   `role` ∈ { customer, agent, manager, admin }
*/

const AuthContext = createContext(null);

const VALID_ROLES = new Set(["customer", "agent", "manager", "admin"]);

function deriveProfile(supaUser) {
  if (!supaUser) return null;
  const meta = supaUser.user_metadata || {};
  const appMeta = supaUser.app_metadata || {};
  const role = (appMeta.role || meta.role || "customer").toLowerCase();
  const safeRole = VALID_ROLES.has(role) ? role : "customer";
  const name =
    meta.name ||
    meta.full_name ||
    (supaUser.email ? supaUser.email.split("@")[0] : "User");
  const initials = (
    meta.initials ||
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
  )
    .toUpperCase()
    .slice(0, 4) || "U";
  return {
    id: supaUser.id,
    email: supaUser.email || "",
    name,
    initials,
    role: safeRole,
    title: meta.title || "",
  };
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session || null);
      setUser(deriveProfile(data.session?.user));
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, sess) => {
      setSession(sess);
      setUser(deriveProfile(sess?.user));
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email, password) => {
    setError(null);
    const { data, error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (err) {
      setError(err.message);
      throw err;
    }
    return data;
  }, []);

  const signUp = useCallback(async (email, password, { name, role }) => {
    setError(null);
    const safeRole = VALID_ROLES.has(role) ? role : "customer";
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, role: safeRole },
      },
    });
    if (err) {
      setError(err.message);
      throw err;
    }
    return data;
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      error,
      configured: isSupabaseConfigured,
      signIn,
      signUp,
      signOut,
    }),
    [user, session, loading, error, signIn, signUp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

/** Returns the current Supabase access token, or null. */
export async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}
