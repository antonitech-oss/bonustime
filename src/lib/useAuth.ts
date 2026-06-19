"use client";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabase, supabaseConfigured } from "./supabase";
import { getAdminEmail } from "./constants";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }
    const sb = getSupabase();
    sb.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const isAdmin = Boolean(user?.email && user.email.toLowerCase() === getAdminEmail());

  async function signIn(email: string, password: string) {
    return getSupabase().auth.signInWithPassword({ email, password });
  }
  async function signUp(email: string, password: string) {
    return getSupabase().auth.signUp({ email, password });
  }
  async function signOut() {
    return getSupabase().auth.signOut();
  }

  return { user, loading, isAdmin, signIn, signUp, signOut, configured: supabaseConfigured };
}
