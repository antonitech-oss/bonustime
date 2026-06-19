"use client";
import { useEffect, useRef } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabase, supabaseConfigured } from "./supabase";
import { useStore } from "./store";
import { isValidAppData, getInitialData } from "./initialData";
import { MIN_VERSION } from "./constants";

const UPLOAD_DEBOUNCE = 1500;

export function useCloudSync(user: User | null) {
  const lastDirty = useRef(0);
  const timer = useRef<any>(null);
  const lastUserId = useRef<string | null>(null);

  // reset store on user change (no leak cross-account)
  useEffect(() => {
    if (!user) return;
    if (lastUserId.current && lastUserId.current !== user.id) {
      useStore.getState().replaceAll(getInitialData());
    }
    lastUserId.current = user.id;
  }, [user?.id]);

  // initial download
  useEffect(() => {
    if (!supabaseConfigured || !user) return;
    let cancelled = false;
    (async () => {
      const sb = getSupabase();
      const { data, error } = await sb
        .from("user_data")
        .select("data")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled || error) return;
      const payload = data?.data;
      if (payload && isValidAppData(payload) && (payload._v ?? 0) >= MIN_VERSION) {
        useStore.getState().replaceAll(payload);
      } else if (!payload) {
        // crea row iniziale
        await sb.from("user_data").upsert({
          user_id: user.id,
          data: useStore.getState().data,
          updated_at: new Date().toISOString(),
        });
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  // upload debounce on changes
  useEffect(() => {
    if (!supabaseConfigured || !user) return;
    const unsub = useStore.subscribe((state) => {
      if (state._dirty === lastDirty.current) return;
      lastDirty.current = state._dirty;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        await getSupabase().from("user_data").upsert({
          user_id: user.id,
          data: useStore.getState().data,
          updated_at: new Date().toISOString(),
        });
      }, UPLOAD_DEBOUNCE);
    });
    return () => { unsub(); if (timer.current) clearTimeout(timer.current); };
  }, [user?.id]);

  // realtime cross-device
  useEffect(() => {
    if (!supabaseConfigured || !user) return;
    const sb = getSupabase();
    const ch = sb
      .channel(`user_data_${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "user_data", filter: `user_id=eq.${user.id}` },
        (payload: any) => {
          const remote = payload.new?.data;
          // applica remoto solo se non c'è un upload pending locale
          const pending = Date.now() - useStore.getState()._dirty < UPLOAD_DEBOUNCE + 500;
          if (!pending && remote && isValidAppData(remote)) {
            useStore.getState().replaceAll(remote);
          }
        }
      )
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [user?.id]);
}
