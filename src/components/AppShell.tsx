"use client";
import { Suspense, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { useCloudSync } from "@/lib/useCloudSync";
import { useStore } from "@/lib/store";
import { Sidebar } from "./Sidebar";
import { ConfirmProvider } from "./ConfirmDialog";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/book":      "Book",
  "/id":        "ID",
  "/spese":     "Spese",
  "/pasquale":  "Pasqubet",
  "/dafare":       "Da Fare",
  "/dispositivi":  "Dispositivi",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut, configured } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  useCloudSync(user);

  // Rehydrate Zustand store from localStorage after mount (skipHydration: true in store)
  // hasHydrated() prevents re-rehydrating on every navigation (each page has its own AppShell)
  useEffect(() => { if (!useStore.persist.hasHydrated()) useStore.persist.rehydrate(); }, []);

  useEffect(() => {
    if (configured && !loading && !user) router.replace("/login");
  }, [configured, loading, user, router]);

  if (configured && loading) {
    return <div className="min-h-screen flex items-center justify-center text-txt-secondary text-sm">Caricamento…</div>;
  }
  if (configured && !user) return null;

  const handleLogout = async () => { await signOut(); router.replace("/login"); };
  const pageTitle = Object.entries(PAGE_TITLES).find(([k]) => pathname.startsWith(k))?.[1] ?? "Bonustime";

  return (
    <ConfirmProvider>
      <div className="flex min-h-screen">
        <Suspense fallback={null}>
          <Sidebar email={user?.email || "locale"} onLogout={configured ? handleLogout : undefined} />
        </Suspense>
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Top header bar */}
          <header className="hidden md:flex sticky top-0 z-30 items-center gap-4 px-6 h-14 bg-bg-sidebar border-b border-bord" style={{backdropFilter:"blur(12px)"}}>
            <h1 className="page-title text-sm font-bold flex-1">{pageTitle}</h1>
            {/* Search box */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-txt-secondary cursor-pointer" style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)"}}>
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              Cerca…
              <kbd style={{marginLeft:4,fontSize:10,opacity:.45,border:"1px solid rgba(255,255,255,.18)",borderRadius:4,padding:"1px 4px"}}>⌘K</kbd>
            </div>
            {/* Sync badge */}
            <span className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full" style={{background:"rgba(139,92,246,0.12)",color:"#a78bfa",border:"1px solid rgba(139,92,246,0.2)"}}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{background:"#a78bfa"}} />
              {configured ? "cloud" : "locale"}
            </span>
            {/* Notification bell */}
            <button className="p-1.5 rounded-lg transition-colors text-txt-secondary hover:text-txt-primary hover:bg-bg-hover">
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            </button>
            {/* Avatar / logout */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 cursor-pointer" style={{background:"linear-gradient(135deg,#8b5cf6,#7c3aed)",color:"#fff"}}>
                {(user?.email || "L").slice(0,2).toUpperCase()}
              </div>
              {configured && (
                <button onClick={handleLogout} title="Esci"
                  className="text-xs text-txt-secondary hover:text-red-400 p-1 rounded-lg hover:bg-bg-hover transition-colors">
                  ⎋
                </button>
              )}
            </div>
          </header>
          <main className="flex-1 p-5 md:p-6" style={{ paddingBottom: "calc(72px + env(safe-area-inset-bottom))" }}>
            {children}
          </main>
        </div>
      </div>
    </ConfirmProvider>
  );
}

export function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-5">
      <div>
        <h2 className="text-base font-semibold page-title">{title}</h2>
        {sub && <div className="text-xs text-txt-secondary mt-0.5">{sub}</div>}
      </div>
      {action}
    </div>
  );
}
