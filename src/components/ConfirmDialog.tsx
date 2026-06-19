"use client";
import { useState, createContext, useContext, useCallback } from "react";

interface ConfirmOpts { title: string; message?: string; danger?: boolean; confirmText?: string; }
const Ctx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(Ctx);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOpts | null>(null);
  const [resolver, setResolver] = useState<((b: boolean) => void) | null>(null);

  const confirm = useCallback((o: ConfirmOpts) => {
    setOpts(o);
    return new Promise<boolean>((res) => setResolver(() => res));
  }, []);

  const close = (val: boolean) => { resolver?.(val); setOpts(null); setResolver(null); };

  return (
    <Ctx.Provider value={confirm}>
      {children}
      {opts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => close(false)}>
          <div className="card p-5 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="font-semibold text-base">{opts.title}</div>
            {opts.message && <div className="text-sm text-txt-secondary mt-2">{opts.message}</div>}
            <div className="flex gap-2 justify-end mt-5">
              <button className="btn btn-ghost" onClick={() => close(false)}>Annulla</button>
              <button className={`btn ${opts.danger ? "btn-danger" : "btn-lime"}`} onClick={() => close(true)}>
                {opts.confirmText || "Conferma"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
