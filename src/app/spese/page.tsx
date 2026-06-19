"use client";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { toEuro, meseLabel, meseCorrente } from "@/lib/calculations";
import { Icon, ICONS } from "@/components/Icon";
import type { TipoSpesa } from "@/lib/types";

const TIPI: { val: TipoSpesa; label: string }[] = [
  { val: "UNA_TANTUM", label: "Una tantum" },
  { val: "FISSA",      label: "Fissa" },
  { val: "PAGAMENTO_ID", label: "Pagamento ID" },
  { val: "VERSAMENTO", label: "Versamento capitale" },
];

const TIPO_BADGE: Record<TipoSpesa, { bg: string; txt: string }> = {
  UNA_TANTUM:   { bg: "bg-acc-blue/10",   txt: "text-acc-blue" },
  FISSA:        { bg: "bg-acc-yellow/10", txt: "text-acc-yellow" },
  PAGAMENTO_ID: { bg: "bg-acc-red/10",    txt: "text-acc-red" },
  VERSAMENTO:   { bg: "bg-lime/10",       txt: "text-lime" },
};

export default function SpesePage() {
  const { data, addSpesa, removeSpesa, updateSpesa } = useStore();
  const [showAdd, setShowAdd] = useState(false);
  const [tabTipo, setTabTipo] = useState<TipoSpesa>("UNA_TANTUM");
  const [form, setForm] = useState({
    data: new Date().toISOString().slice(0, 10),
    descrizione: "",
    importo: "",
    amicoId: "" as number | "",
    note: "",
  });
  // inline edit state: id → draft importo string
  const [editId, setEditId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");

  const [filterTipo, setFilterTipo] = useState<TipoSpesa | "ALL">("ALL");

  const meseOggi = meseCorrente();
  const totMese = data.spese
    .filter((s) => s.data.startsWith(meseOggi))
    .reduce((a, s) => a + (s.tipo === "VERSAMENTO" ? 0 : s.importo), 0);

  // ── KPI ──
  const speseReali = data.spese.filter((s) => s.tipo !== "VERSAMENTO");
  const totAllTime = speseReali.reduce((a, s) => a + s.importo, 0);
  const totFisse = speseReali.filter((s) => s.tipo === "FISSA").reduce((a, s) => a + s.importo, 0);
  const totUna = speseReali.filter((s) => s.tipo === "UNA_TANTUM").reduce((a, s) => a + s.importo, 0);
  const totPagID = speseReali.filter((s) => s.tipo === "PAGAMENTO_ID").reduce((a, s) => a + s.importo, 0);

  // Media mensile (sui mesi che hanno almeno una spesa)
  const mesiConSpese = new Set(speseReali.map((s) => s.data.slice(0, 7)));
  const mediaMensile = mesiConSpese.size > 0 ? totAllTime / mesiConSpese.size : 0;

  // Mese precedente
  const [y, m] = meseOggi.split("-").map(Number);
  const prevDate = new Date(y, m - 2, 1);
  const mesePrecedente = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
  const totMesePrec = speseReali
    .filter((s) => s.data.slice(0, 7) === mesePrecedente)
    .reduce((a, s) => a + s.importo, 0);

  const variazione = totMesePrec > 0 ? ((totMese - totMesePrec) / totMesePrec) * 100 : null;

  const tutti = [...data.spese]
    .filter((s) => filterTipo === "ALL" || s.tipo === filterTipo)
    .sort((a, b) => b.data.localeCompare(a.data));

  const grouped: Record<string, typeof tutti> = {};
  for (const s of tutti) {
    const ym = s.data.slice(0, 7);
    if (!grouped[ym]) grouped[ym] = [];
    grouped[ym].push(s);
  }
  const mesiOrdinati = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const handleAdd = () => {
    const imp = parseFloat(form.importo);
    if (!imp || !form.data) return;
    const desc = form.descrizione || TIPI.find((t) => t.val === tabTipo)?.label || tabTipo;
    addSpesa({
      data: form.data,
      descrizione: desc,
      importo: imp,
      tipo: tabTipo,
      amicoId: form.amicoId !== "" ? form.amicoId : undefined,
      note: form.note || undefined,
    });
    setForm({ data: new Date().toISOString().slice(0, 10), descrizione: "", importo: "", amicoId: "", note: "" });
    setShowAdd(false);
  };

  const startEdit = (id: string, currentImporto: number) => {
    setEditId(id);
    setEditVal(String(currentImporto));
  };

  const confirmEdit = (id: string) => {
    const imp = parseFloat(editVal);
    if (!isNaN(imp) && imp > 0) {
      updateSpesa(id, { importo: imp });
    }
    setEditId(null);
    setEditVal("");
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditVal("");
  };

  return (
    <AppShell>
      <PageHeader
        title="Spese"
        sub={`${data.spese.length} totali · €${toEuro(totMese)} questo mese`}
        action={
          <button className="btn btn-lime" onClick={() => setShowAdd(true)}>
            <Icon d={ICONS.plus} size={14} /> Aggiungi
          </button>
        }
      />

      {/* Filtro tipo */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {([["ALL","Tutte"], ["FISSA","Fisse"], ["UNA_TANTUM","Una tantum"], ["PAGAMENTO_ID","Pag. ID"]] as const).map(([val, label]) => (
          <button key={val} onClick={() => setFilterTipo(val)}
            className={`px-3 py-1 rounded text-xs font-semibold border transition-colors ${
              filterTipo === val
                ? "bg-lime text-[#0F0F0F] border-lime"
                : "bg-bg-card border-bord text-txt-secondary hover:border-lime/40"
            }`}>{label}</button>
        ))}
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="card p-4">
          <p className="label-tiny mb-1">Questo mese</p>
          <p className="text-xl font-bold text-acc-red">−€{toEuro(totMese)}</p>
          {variazione !== null && (
            <p className={`text-xs mt-1 ${variazione > 0 ? "text-acc-red" : "text-lime"}`}>
              {variazione > 0 ? "▲" : "▼"} {Math.abs(variazione).toFixed(1)}% vs mese prec.
            </p>
          )}
        </div>
        <div className="card p-4">
          <p className="label-tiny mb-1">Media mensile</p>
          <p className="text-xl font-bold text-txt-primary">€{toEuro(mediaMensile)}</p>
          <p className="text-xs text-txt-secondary mt-1">{mesiConSpese.size} mesi con spese</p>
        </div>
        <div className="card p-4">
          <p className="label-tiny mb-1">All time</p>
          <p className="text-xl font-bold text-txt-primary">€{toEuro(totAllTime)}</p>
          <p className="text-xs text-txt-secondary mt-1">{speseReali.length} voci</p>
        </div>
        <div className="card p-4">
          <p className="label-tiny mb-2">Per tipo</p>
          <div className="space-y-1">
            {totFisse > 0 && <div className="flex justify-between text-xs"><span className="text-acc-yellow">Fisse</span><span>€{toEuro(totFisse)}</span></div>}
            {totUna > 0 && <div className="flex justify-between text-xs"><span className="text-acc-blue">Una tantum</span><span>€{toEuro(totUna)}</span></div>}
            {totPagID > 0 && <div className="flex justify-between text-xs"><span className="text-acc-red">Pag. ID</span><span>€{toEuro(totPagID)}</span></div>}
          </div>
        </div>
      </div>

      {mesiOrdinati.length === 0 && (
        <div className="text-center text-txt-secondary text-sm py-12">Nessun movimento</div>
      )}
      <div className="space-y-4">
        {mesiOrdinati.map((ym) => {
          const voci = grouped[ym];
          const totaleUscite = voci.filter((v) => v.tipo !== "VERSAMENTO").reduce((a, v) => a + v.importo, 0);
          const totaleVers = voci.filter((v) => v.tipo === "VERSAMENTO").reduce((a, v) => a + v.importo, 0);
          return (
            <div key={ym} className="card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-bg-hover/30 border-b border-bord">
                <span className="label-tiny">{meseLabel(ym)}</span>
                <div className="flex gap-3 text-xs">
                  {totaleUscite > 0 && <span className="text-acc-red">−€{toEuro(totaleUscite)}</span>}
                  {totaleVers > 0 && <span className="text-lime">+€{toEuro(totaleVers)}</span>}
                </div>
              </div>
              {voci.map((s, i) => {
                const amico = s.amicoId ? data.amici.find((a) => a.id === s.amicoId) : null;
                const badge = TIPO_BADGE[s.tipo];
                const isVers = s.tipo === "VERSAMENTO";
                const isEditing = editId === s.id;
                return (
                  <div key={s.id}
                    className={`flex items-center gap-3 px-4 py-3 ${i < voci.length - 1 ? "border-b border-bord/50" : ""}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm">{s.descrizione}</span>
                        <span className={`pill ${badge.bg} ${badge.txt} text-[10px]`}>{s.tipo.replace("_", " ")}</span>
                        {amico && <span className="text-[10px] text-txt-secondary">{amico.nome}</span>}
                      </div>
                      <div className="text-xs text-txt-secondary mt-0.5">{s.data}{s.note && ` · ${s.note}`}</div>
                    </div>

                    {isEditing ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          className="input w-24 text-sm text-right py-1"
                          type="number"
                          step="0.01"
                          value={editVal}
                          autoFocus
                          onChange={(e) => setEditVal(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") confirmEdit(s.id);
                            if (e.key === "Escape") cancelEdit();
                          }}
                        />
                        <button onClick={() => confirmEdit(s.id)}
                          className="text-lime hover:text-lime/80 p-1">
                          <Icon d={ICONS.check} size={14} />
                        </button>
                        <button onClick={cancelEdit}
                          className="text-txt-secondary hover:text-txt-primary p-1">
                          <Icon d={ICONS.close} size={14} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className={`text-sm font-semibold shrink-0 ${isVers ? "text-lime" : "text-acc-red"}`}>
                          {isVers ? "+" : "−"}€{toEuro(s.importo)}
                        </div>
                        <button onClick={() => startEdit(s.id, s.importo)}
                          className="text-txt-secondary hover:text-acc-blue p-1 shrink-0"
                          title="Modifica importo">
                          <Icon d={ICONS.edit} size={14} />
                        </button>
                        <button onClick={() => removeSpesa(s.id)}
                          className="text-txt-secondary hover:text-acc-red p-1 shrink-0">
                          <Icon d={ICONS.trash} size={14} />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4"
          onClick={() => setShowAdd(false)}>
          <div className="card w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-bord">
              <h3 className="font-semibold">Aggiungi movimento</h3>
              <button onClick={() => setShowAdd(false)} className="text-txt-secondary hover:text-txt-primary">
                <Icon d={ICONS.close} size={18} />
              </button>
            </div>
            <div className="p-4">
              <div className="flex gap-1 p-1 bg-bg-deep rounded-lg mb-4">
                {TIPI.map((t) => (
                  <button key={t.val}
                    onClick={() => setTabTipo(t.val)}
                    className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      tabTipo === t.val ? "bg-bg-card text-txt-primary" : "text-txt-secondary"
                    }`}>
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                <input className="input" placeholder="Descrizione" value={form.descrizione}
                  onChange={(e) => setForm((f) => ({ ...f, descrizione: e.target.value }))} />
                <div className="grid grid-cols-2 gap-2">
                  <input className="input" type="number" placeholder="Importo €" value={form.importo}
                    onChange={(e) => setForm((f) => ({ ...f, importo: e.target.value }))} />
                  <input className="input" type="date" value={form.data}
                    onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} />
                </div>
                {tabTipo === "PAGAMENTO_ID" && (
                  <select className="input" value={form.amicoId}
                    onChange={(e) => setForm((f) => ({ ...f, amicoId: e.target.value === "" ? "" : Number(e.target.value) }))}>
                    <option value="">— Seleziona ID —</option>
                    {data.amici.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
                  </select>
                )}
                <input className="input" placeholder="Note (opzionale)" value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
              </div>
              <button className="btn btn-lime w-full mt-4" onClick={handleAdd}>Aggiungi</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
