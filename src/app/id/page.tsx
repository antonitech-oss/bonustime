"use client";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { ciGiorni, saldoPerId, bookAttiviPerId, bookTotaliPerId, toEuro, prelieviPerId } from "@/lib/calculations";
import { Icon, ICONS } from "@/components/Icon";
import { CopyField } from "@/components/CopyField";
import { useConfirm } from "@/components/ConfirmDialog";
import type { Amico, WalletExtra } from "@/lib/types";

export default function IdPage() {
  const { data, addAmico } = useStore();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newNome, setNewNome] = useState("");

  const filtered = data.amici.filter((a) =>
    a.nome.toLowerCase().includes(search.toLowerCase()) ||
    (a.citta || "").toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = data.amici.filter((a) => a.attivo).length;
  const suspendedCount = data.amici.filter((a) => !a.attivo).length;
  const ciScad60 = data.amici.filter((a) => {
    const g = ciGiorni(a.scadenzaCI);
    return g !== null && g <= 60 && g >= 0;
  }).length;

  const selectedAmico = selected != null ? data.amici.find((a) => a.id === selected) : null;

  return (
    <AppShell>
      <PageHeader
        title="ID"
        sub={`${data.amici.length} totali`}
        action={
          <button className="btn btn-lime" onClick={() => setShowAdd(true)}>
            <Icon d={ICONS.plus} size={14} /> Aggiungi ID
          </button>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: "Totale", val: data.amici.length, color: "text-txt-primary" },
          { label: "Attivi", val: activeCount, color: "text-lime" },
          { label: "Sospesi", val: suspendedCount, color: "text-acc-yellow" },
          { label: "CI <60g", val: ciScad60, color: "text-acc-red" },
        ].map((s) => (
          <div key={s.label} className="card p-3 text-center">
            <div className={`text-xl font-bold ${s.color}`}>{s.val}</div>
            <div className="label-tiny mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Icon d={ICONS.search} size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-secondary" />
        <input className="input pl-9" placeholder="Cerca per nome o città…"
          value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((a) => {
          const attivi = bookAttiviPerId(data, a.id);
          return (
            <button key={a.id} onClick={() => setSelected(a.id)}
              className="card p-4 text-left hover:border-lime/30 transition-colors w-full">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-lime/15 text-lime flex items-center justify-center text-sm font-bold shrink-0">
                  {a.nome.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{a.nome}</div>
                  <div className="text-xs text-txt-secondary mt-0.5">{attivi} book attivi</div>
                </div>
                {!a.attivo && <span className="pill bg-acc-yellow/15 text-acc-yellow text-[10px]">sospeso</span>}
              </div>
            </button>
          );
        })}
      </div>

      {/* Drawer */}
      {selectedAmico && (
        <DrawerAmico amico={selectedAmico} onClose={() => setSelected(null)} />
      )}

      {/* Modal aggiungi */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowAdd(false)}>
          <div className="card p-5 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-3">Aggiungi ID</h3>
            <input className="input mb-3" placeholder="Nome e cognome" autoFocus
              value={newNome} onChange={(e) => setNewNome(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newNome.trim()) {
                  addAmico(newNome.trim()); setNewNome(""); setShowAdd(false);
                }
              }} />
            <div className="flex gap-2">
              <button className="btn btn-ghost flex-1" onClick={() => setShowAdd(false)}>Annulla</button>
              <button className="btn btn-lime flex-1" onClick={() => {
                if (newNome.trim()) { addAmico(newNome.trim()); setNewNome(""); setShowAdd(false); }
              }}>Aggiungi</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function DrawerAmico({ amico, onClose }: { amico: Amico; onClose: () => void }) {
  const { data, updateAmico, removeAmico, addPrelievo, removePrelievo } = useStore();
  const confirm = useConfirm();
  const [tab, setTab] = useState<"ana" | "wallet" | "docs" | "storico">("ana");
  const [form, setForm] = useState<Partial<Amico>>({ ...amico });
  const [dirty, setDirty] = useState(false);

  // cashout form
  const [showCashout, setShowCashout] = useState(false);
  const [cashBook, setCashBook] = useState("");
  const [cashImporto, setCashImporto] = useState("");
  const [cashData, setCashData] = useState(new Date().toISOString().slice(0, 10));
  const [cashNote, setCashNote] = useState("");

  const handleCashout = () => {
    const imp = parseFloat(cashImporto);
    if (!imp || !cashBook) return;
    addPrelievo({ amicoId: amico.id, book: cashBook, importo: imp, data: cashData, note: cashNote || undefined });
    setCashImporto(""); setCashBook(""); setCashNote(""); setShowCashout(false);
    setTab("storico");
  };

  const set = (patch: Partial<Amico>) => { setForm((f) => ({ ...f, ...patch })); setDirty(true); };
  const save = () => { updateAmico(amico.id, form); setDirty(false); };

  const handleRemove = async () => {
    const ok = await confirm({ title: `Elimina ${amico.nome}?`, danger: true, confirmText: "Elimina" });
    if (ok) { removeAmico(amico.id); onClose(); }
  };

  const saldo = saldoPerId(data, amico.id);
  const attivi = bookAttiviPerId(data, amico.id);
  const totali = bookTotaliPerId(data, amico.id);
  const ci = ciGiorni(amico.scadenzaCI);
  const totPrelievi = prelieviPerId(data, amico.id);
  const prelieviAmico = (data.prelievi || [])
    .filter((p) => p.amicoId === amico.id)
    .sort((a, b) => b.data.localeCompare(a.data));

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-[480px] h-full bg-bg-card border-l border-bord flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-bord">
          <div className="w-9 h-9 rounded-full bg-lime/15 text-lime flex items-center justify-center text-sm font-bold">
            {amico.nome.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{amico.nome}</div>
            {amico.citta && <div className="text-xs text-txt-secondary">{amico.citta}</div>}
          </div>
          <button onClick={onClose} className="text-txt-secondary hover:text-txt-primary p-1">
            <Icon d={ICONS.close} size={18} />
          </button>
        </div>

        {/* KPI */}
        <div className="grid grid-cols-4 gap-2 p-4 border-b border-bord">
          {[
            { label: "Book", val: `${attivi}/${totali}` },
            { label: "Saldo", val: `€${toEuro(saldo)}` },
            { label: "Prelevato", val: `€${toEuro(totPrelievi)}` },
            { label: "CI", val: ci !== null ? `${ci}g` : "—" },
          ].map((k) => (
            <div key={k.label} className="text-center">
              <div className="text-sm font-semibold">{k.val}</div>
              <div className="label-tiny mt-0.5">{k.label}</div>
            </div>
          ))}
        </div>

        {/* Cashout rapido */}
        {showCashout ? (
          <div className="p-4 border-b border-bord bg-bg-hover/20">
            <div className="label-tiny mb-2">Registra cashout</div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <select className="input text-sm" value={cashBook} onChange={(e) => setCashBook(e.target.value)}>
                <option value="">— Book —</option>
                {data.righeBook
                  .filter((r) => r.celle[amico.id]?.stato === "ATTIVO" || r.celle[amico.id]?.saldo > 0)
                  .map((r) => (
                    <option key={r.book} value={r.book}>
                      {r.book} (€{toEuro(r.celle[amico.id]?.saldo || 0)})
                    </option>
                  ))}
              </select>
              <input className="input text-sm" type="number" placeholder="Importo €"
                value={cashImporto} onChange={(e) => setCashImporto(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <input className="input text-sm" type="date" value={cashData}
                onChange={(e) => setCashData(e.target.value)} />
              <input className="input text-sm" placeholder="Note" value={cashNote}
                onChange={(e) => setCashNote(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <button className="btn btn-ghost flex-1 text-sm" onClick={() => setShowCashout(false)}>Annulla</button>
              <button className="btn btn-lime flex-1 text-sm" onClick={handleCashout}
                disabled={!cashBook || !cashImporto}>
                Conferma cashout
              </button>
            </div>
          </div>
        ) : (
          <div className="px-4 py-2 border-b border-bord/50">
            <button className="btn btn-ghost w-full text-sm" onClick={() => setShowCashout(true)}>
              💸 Registra cashout
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-bord px-4">
          {[["ana", "Anagrafica"], ["wallet", "Wallet"], ["docs", "Documenti"], ["storico", "Storico"]].map(([t, l]) => (
            <button key={t} onClick={() => setTab(t as any)}
              className={`px-3 py-2 text-sm border-b-2 transition-colors ${tab === t ? "border-lime text-lime" : "border-transparent text-txt-secondary"}`}>
              {l}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab === "ana" && (
            <div className="space-y-3">
              {([
                ["nome", "Nome completo"],
                ["dataNascita", "Data di nascita"],
                ["citta", "Città"],
                ["codiceFiscale", "Codice Fiscale"],
                ["scadenzaCI", "Scadenza CI (YYYY-MM-DD)"],
                ["email", "Email"],
                ["telefono", "Telefono"],
              ] as [keyof Amico, string][]).map(([k, label]) => (
                <CopyField key={k} label={label} value={String(form[k] || "")}
                  onChange={(v) => set({ [k]: v } as any)} />
              ))}
              {form.note !== undefined || true ? (
                <label className="block">
                  <span className="label-tiny">Note</span>
                  <textarea className="input mt-1 h-20 resize-none"
                    value={form.note || ""} onChange={(e) => set({ note: e.target.value })} />
                </label>
              ) : null}
            </div>
          )}
          {tab === "wallet" && (
            <div className="space-y-3">
              <CopyField label="PayPal (email)" value={form.paypalEmail || ""} onChange={(v) => set({ paypalEmail: v })} />
              <CopyField label="Postepay (email)" value={form.postepayEmail || ""} onChange={(v) => set({ postepayEmail: v })} />
              <CopyField label="Postepay (IBAN)" value={form.postepayIban || ""} onChange={(v) => set({ postepayIban: v })} />
              <CopyField label="Revolut (email)" value={form.revolutEmail || ""} onChange={(v) => set({ revolutEmail: v })} />
              <CopyField label="Revolut (tag)" value={form.revolutTag || ""} onChange={(v) => set({ revolutTag: v })} />
              <CopyField label="IBAN banca" value={form.ibanBanca || ""} onChange={(v) => set({ ibanBanca: v })} />
              <CopyField label="Intestatario banca" value={form.bancaIntestatario || ""} onChange={(v) => set({ bancaIntestatario: v })} />
              <CopyField label="Satispay (numero)" value={form.satispayNumero || ""} onChange={(v) => set({ satispayNumero: v })} />
              {/* Custom wallet */}
              {(form.walletExtra || []).map((w, i) => (
                <div key={i} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <CopyField label={w.tipo || "Custom"} value={w.valore}
                      onChange={(v) => {
                        const extra = [...(form.walletExtra || [])];
                        extra[i] = { ...extra[i], valore: v };
                        set({ walletExtra: extra });
                      }} />
                  </div>
                  <button className="btn btn-danger px-2 mb-0"
                    onClick={() => {
                      const extra = (form.walletExtra || []).filter((_, j) => j !== i);
                      set({ walletExtra: extra });
                    }}>
                    <Icon d={ICONS.trash} size={13} />
                  </button>
                </div>
              ))}
              <button className="btn btn-ghost w-full text-xs" onClick={() => {
                const tipo = prompt("Tipo wallet (es. WISE)"); if (!tipo) return;
                set({ walletExtra: [...(form.walletExtra || []), { tipo, valore: "" }] });
              }}>+ Aggiungi wallet custom</button>
            </div>
          )}
          {tab === "storico" && (
            <div>
              {/* Riepilogo */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="card p-3 text-center">
                  <div className="text-base font-bold text-lime">€{toEuro(saldo)}</div>
                  <div className="label-tiny mt-1">Saldo attuale</div>
                </div>
                <div className="card p-3 text-center">
                  <div className="text-base font-bold text-acc-red">€{toEuro(totPrelievi)}</div>
                  <div className="label-tiny mt-1">Totale prelevato</div>
                </div>
                <div className="card p-3 text-center">
                  <div className="text-base font-bold text-txt-primary">{prelieviAmico.length}</div>
                  <div className="label-tiny mt-1">Cashout</div>
                </div>
              </div>

              {/* Lista prelievi */}
              {prelieviAmico.length === 0 ? (
                <div className="text-center text-txt-secondary text-sm py-6">Nessun cashout registrato</div>
              ) : (
                <div className="space-y-2">
                  {prelieviAmico.map((p) => (
                    <div key={p.id} className="card p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-lime">+€{toEuro(p.importo)}</span>
                          <span className="pill bg-bord text-txt-secondary text-[10px]">{p.book}</span>
                        </div>
                        <div className="text-xs text-txt-secondary mt-0.5">
                          {p.data}{p.note && ` · ${p.note}`}
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          const ok = await confirm({ title: "Elimina cashout?", message: `€${toEuro(p.importo)} su ${p.book} verrà ripristinato nel saldo.`, danger: true, confirmText: "Elimina" });
                          if (ok) removePrelievo(p.id);
                        }}
                        className="text-txt-secondary hover:text-acc-red p-1 shrink-0"
                      >
                        <Icon d={ICONS.trash} size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Spese legate a questo ID */}
              {(() => {
                const speseId = data.spese.filter((s) => s.amicoId === amico.id && s.tipo !== "VERSAMENTO");
                if (!speseId.length) return null;
                const totSpId = speseId.reduce((a, s) => a + s.importo, 0);
                return (
                  <div className="mt-4">
                    <div className="label-tiny mb-2">Spese associate</div>
                    <div className="space-y-1.5">
                      {speseId.sort((a, b) => b.data.localeCompare(a.data)).map((s) => (
                        <div key={s.id} className="flex items-center gap-2 text-sm">
                          <span className="text-txt-secondary flex-1 truncate">{s.descrizione}</span>
                          <span className="text-xs text-txt-secondary">{s.data}</span>
                          <span className="text-acc-yellow font-medium shrink-0">−€{toEuro(s.importo)}</span>
                        </div>
                      ))}
                      <div className="pt-2 border-t border-bord/50 flex justify-between text-xs font-semibold">
                        <span className="text-txt-secondary">Totale spese ID</span>
                        <span className="text-acc-yellow">−€{toEuro(totSpId)}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
          {tab === "docs" && (
            <div className="space-y-3">
              {(["docFronte", "docRetro", "docSelfie"] as const).map((k) => (
                <div key={k}>
                  <div className="label-tiny mb-1">{k === "docFronte" ? "CI Fronte" : k === "docRetro" ? "CI Retro" : "Selfie con CI"}</div>
                  <div className="card p-3 text-center text-txt-secondary text-xs">
                    {form[k] ? (
                      <div className="text-lime truncate">{form[k]}</div>
                    ) : (
                      <div>Upload non disponibile in locale (richiede Supabase Storage)</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-bord flex items-center gap-2">
          <button className="btn btn-ghost" onClick={() => {
            updateAmico(amico.id, { attivo: !amico.attivo });
          }}>
            {amico.attivo ? "Sospendi" : "Riattiva"}
          </button>
          {dirty && (
            <button className="btn btn-lime flex-1" onClick={save}>Salva modifiche</button>
          )}
          <button className="btn btn-danger ml-auto" onClick={handleRemove}>Elimina</button>
        </div>
      </div>
    </div>
  );
}
