"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";

export default function LoginPage() {
  const { signIn, signUp, configured } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const fn = mode === "in" ? signIn : signUp;
      const { error } = await fn(email.trim(), pw);
      if (error) { setErr(error.message); return; }
      router.replace("/dashboard");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card p-7 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-2xl font-bold text-lime tracking-tight">Bonustime</div>
          <div className="text-sm text-txt-secondary mt-1">Gestione bonus hunting ADM</div>
        </div>
        {!configured && (
          <div className="card bg-acc-yellow/10 border-acc-yellow/30 p-3 text-xs text-acc-yellow mb-4">
            Supabase non configurato: l&apos;app gira in modalità locale (solo questo dispositivo).
            <a href="/dashboard" className="underline ml-1">Entra in locale →</a>
          </div>
        )}
        <form onSubmit={submit} className="space-y-3">
          <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className="input" type="password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={6} />
          {err && <div className="text-acc-red text-xs">{err}</div>}
          <button className="btn btn-lime w-full" disabled={busy || !configured}>
            {busy ? "…" : mode === "in" ? "Accedi" : "Registrati"}
          </button>
        </form>
        <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="text-xs text-txt-secondary hover:text-txt-primary mt-4 w-full text-center">
          {mode === "in" ? "Non hai un account? Registrati" : "Hai già un account? Accedi"}
        </button>
      </div>
    </div>
  );
}
