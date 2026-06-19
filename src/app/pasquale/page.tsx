"use client";
import { useState, useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { useStore, calcSettlement, calcSaldoPersonale, calcTotaleDepositi, calcSaldoCorrente, calcSaldoDaGiocare } from "@/lib/store";
import type { SessionePasquale, Puntata, PuntataSplit, DepositanteSessione, TipoPuntata, EsitoPuntata, TipoBonus, DepositoAggiuntivo } from "@/lib/types";

const fmtAbs = (n: number) => Math.abs(n).toFixed(2) + "€";
const today = () => new Date().toISOString().slice(0, 10);
const initials = (n: string) => n.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

function getISOWeek(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - day);
  const ys = new Date(d.getFullYear(), 0, 1);
  const w = Math.ceil(((d.getTime() - ys.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(w).padStart(2, "0")}`;
}

const C = {
  input: "bg-[#111827] border border-[#1E2640] rounded px-3 py-1.5 text-sm text-white w-full focus:outline-none focus:border-violet/50",
  sel: "bg-[#111827] border border-[#1E2640] rounded px-3 py-1.5 text-sm text-white w-full focus:outline-none focus:border-violet/50",
  btn: "px-3 py-1.5 rounded text-xs font-semibold transition-colors",
  prim: "bg-violet/90 hover:bg-violet text-white",
  ghost: "bg-[#1E2640] hover:bg-[#253050] text-gray-300",
  danger: "bg-red-800 hover:bg-red-700 text-white",
  green: "bg-green-800 hover:bg-green-700 text-white",
  yellow: "bg-yellow-800 hover:bg-yellow-700 text-yellow-100",
  badge: "px-2 py-0.5 rounded text-xs font-bold",
};

function Lbl({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] text-gray-500 uppercase tracking-widest">{t}</span>
      {children}
    </div>
  );
}

// ─── Split editor ─────────────────────────────────────────────
function SplitEditor({
  splits, onChange, totalImporto = 0, vincitaTotale,
}: {
  splits: PuntataSplit[];
  onChange: (s: PuntataSplit[]) => void;
  totalImporto?: number;
  vincitaTotale?: number;
}) {
  function addSplit() { onChange([...splits, { book: "", importo: 0 }]); }
  function removeSplit(i: number) { onChange(splits.filter((_, idx) => idx !== i)); }
  function updateSplit(i: number, field: keyof PuntataSplit, val: string) {
    const next = splits.map((s, idx) => idx === i ? { ...s, [field]: field === "importo" ? parseFloat(val) || 0 : val } : s);
    onChange(next);
  }
  function dividiUguale() {
    if (splits.length === 0 || totalImporto <= 0) return;
    const quota = Math.round((totalImporto / splits.length) * 100) / 100;
    // Aggiusta l'ultimo per rounding
    const updated = splits.map((s, i) => ({
      ...s,
      importo: i === splits.length - 1
        ? Math.round((totalImporto - quota * (splits.length - 1)) * 100) / 100
        : quota,
    }));
    onChange(updated);
  }
  const total = splits.reduce((a, s) => a + s.importo, 0);
  return (
    <div className="col-span-full mt-1 bg-[#0D1428] rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-yellow-400 font-semibold">Split su più book</span>
        <div className="flex gap-2">
          {totalImporto > 0 && splits.length >= 2 && (
            <button onClick={dividiUguale} className="text-xs text-yellow-400 hover:text-yellow-300 border border-yellow-400/30 rounded px-2 py-0.5">
              ÷ {splits.length} = {(totalImporto / splits.length).toFixed(2)}€
            </button>
          )}
          <button onClick={addSplit} className="text-xs text-[#818CF8] hover:text-[#818CF8]">+ Book</button>
        </div>
      </div>
      {splits.map((s, i) => {
        const vincitaSplit = vincitaTotale != null && total > 0
          ? (s.importo / total) * vincitaTotale
          : null;
        return (
          <div key={i} className="flex gap-2 items-center">
            <input value={s.book} onChange={(e) => updateSplit(i, "book", e.target.value)} placeholder="Book" className={`${C.input} flex-1`} />
            <input type="number" value={s.importo || ""} onChange={(e) => updateSplit(i, "importo", e.target.value)} placeholder="€" className={`${C.input} w-24`} />
            {vincitaSplit != null && (
              <span className="text-xs text-green-400 whitespace-nowrap">→ {vincitaSplit.toFixed(2)}€</span>
            )}
            <button onClick={() => removeSplit(i)} className="text-red-500 hover:text-red-400 text-xs px-1">✕</button>
          </div>
        );
      })}
      {splits.length > 0 ? (
        <div className="text-xs text-gray-400 pt-1 border-t border-[#1E2640] flex items-center gap-3 flex-wrap">
          <span>Totale: <span className={total > 0 ? "text-white font-bold" : "text-gray-500"}>{total.toFixed(2)}€</span></span>
          {totalImporto > 0 && Math.abs(total - totalImporto) > 0.01 && (
            <span className="text-red-400">⚠ differenza {(totalImporto - total).toFixed(2)}€</span>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ─── Puntata row ──────────────────────────────────────────────
function PuntataRow({ p, sessioneId, depositante }: { p: Puntata; sessioneId: string; depositante: DepositanteSessione }) {
  const { updatePuntata, removePuntata } = useStore((s) => ({ updatePuntata: s.updatePuntata, removePuntata: s.removePuntata }));
  const [editing, setEditing] = useState(false);
  const [esito, setEsito] = useState<EsitoPuntata>(p.esito);
  const [vincita, setVincita] = useState(p.vincita?.toString() ?? "");

  let daADare = 0;
  let isPersonale = p.tipo === "PERSONALE";
  if (p.esito !== "ATTESA") {
    if (isPersonale) {
      daADare = p.esito === "PERSA" ? -p.importo : (p.vincita ?? 0) - p.importo;
    } else if (p.tipo === "BONUS") {
      daADare = p.importo;
      if (p.esito === "VINTA") daADare -= ((p.vincita ?? 0) - p.importo);
    } else if (depositante === "MIO") {
      if (p.esito === "PERSA") daADare = p.importo;
      if (p.esito === "VINTA") daADare = -((p.vincita ?? 0) - p.importo);
    } else {
      if (p.esito === "VINTA") daADare = -(p.vincita ?? 0);
    }
  }

  function save() {
    const v = esito === "VINTA" && vincita ? parseFloat(vincita) : undefined;
    updatePuntata(sessioneId, p.id, { esito, vincita: v });
    setEditing(false);
  }

  const daADareColor = p.esito === "ATTESA" ? "text-gray-600"
    : isPersonale ? (daADare >= 0 ? "text-purple-400" : "text-purple-300")
    : daADare > 0 ? "text-red-400" : daADare < 0 ? "text-green-400" : "text-gray-400";

  const daADareLabel = p.esito === "ATTESA" ? "—"
    : isPersonale ? (daADare >= 0 ? `+${daADare.toFixed(2)}€` : `${daADare.toFixed(2)}€`) + " saldo"
    : daADare > 0 ? `deve +${daADare.toFixed(2)}€` : daADare < 0 ? `devi ${daADare.toFixed(2)}€` : "pari";

  return (
    <div className="px-3 py-2.5 border-b border-[#1E2640] hover:bg-[#111827]/40 text-xs space-y-1.5">
      {/* Riga 1: data | importo | tipo | esito | dare-avere | azioni */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-gray-500 w-20 shrink-0">{p.data}</span>
        <span className="text-white font-bold shrink-0">{p.importo.toFixed(2)}€</span>
        <span className={`${C.badge} shrink-0 ${p.tipo === "BONUS" ? "bg-yellow-900/60 text-yellow-300" : p.tipo === "PERSONALE" ? "bg-purple-900/60 text-purple-300" : "bg-[#1E2640] text-gray-400"}`}>{p.tipo}</span>

        {editing ? (
          <select value={esito} onChange={(e) => setEsito(e.target.value as EsitoPuntata)}
            className="bg-[#111827] rounded px-2 py-0.5 text-xs text-white border border-[#1E2640]">
            <option value="ATTESA">ATTESA</option>
            <option value="VINTA">VINTA</option>
            <option value="PERSA">PERSA</option>
          </select>
        ) : (
          <span className={`${C.badge} shrink-0 ${p.esito === "VINTA" ? "bg-green-900/60 text-green-300" : p.esito === "PERSA" ? "bg-red-900/60 text-red-300" : "bg-[#1E2640] text-gray-500"}`}>{p.esito}</span>
        )}

        {editing && esito === "VINTA" ? (
          <input type="number" value={vincita} onChange={(e) => setVincita(e.target.value)}
            placeholder="vincita €" className="bg-[#111827] rounded px-2 py-0.5 text-xs text-white border border-[#1E2640] w-24" />
        ) : p.vincita != null ? (
          <span className="text-green-400 shrink-0">→ {p.vincita.toFixed(2)}€</span>
        ) : null}

        {/* SALDO SUO + VINTA: pulsante ritira vincita */}
        {!editing && p.esito === "VINTA" && depositante === "SUO" && p.vincita != null ? (
          p.vincitaRitirata ? (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-900/50 text-green-400 shrink-0">✓ Ritirata</span>
          ) : (
            <button
              onClick={() => updatePuntata(sessioneId, p.id, { vincitaRitirata: true })}
              className="px-2 py-0.5 rounded text-[10px] font-semibold bg-orange-900/60 hover:bg-orange-800 text-orange-300 shrink-0">
              Ritira vincita
            </button>
          )
        ) : null}

        {/* SALDO MIO + VINTA: mostra profitto netto (vincita − puntata) da tenere */}
        {!editing && p.esito === "VINTA" && depositante === "MIO" && p.vincita != null ? (
          <span className="text-[#818CF8] text-[10px] font-semibold shrink-0">
            tieni {(p.vincita - p.importo).toFixed(2)}€
          </span>
        ) : null}

        <span className={`${daADareColor} font-semibold ml-auto shrink-0`}>{daADareLabel}</span>

        <div className="flex gap-1 shrink-0">
          {editing ? (
            <>
              <button onClick={save} className={`${C.btn} ${C.green} py-0.5`}>✓</button>
              <button onClick={() => setEditing(false)} className={`${C.btn} ${C.ghost} py-0.5`}>✕</button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} className={`${C.btn} ${C.ghost} py-0.5`}>✎</button>
              <button onClick={() => removePuntata(sessioneId, p.id)} className={`${C.btn} ${C.danger} py-0.5`}>✕</button>
            </>
          )}
        </div>
      </div>
      {/* Riga 2: splits (solo se presenti) */}
      {p.splits && p.splits.length > 0 && (
        <div className="flex flex-wrap gap-1 pl-20">
          {p.splits.map((sp, i) => (
            <span key={i} className="bg-[#1E2640] rounded px-1.5 py-0.5 text-[10px] text-gray-400">
              {sp.book} {sp.importo.toFixed(2)}€
              {p.esito === "VINTA" && p.vincita != null && p.importo > 0
                ? ` → ${((sp.importo / p.importo) * p.vincita).toFixed(2)}€`
                : ""}
            </span>
          ))}
        </div>
      )}
      {/* Note */}
      {p.note && <div className="pl-20 text-[10px] text-gray-600 italic">{p.note}</div>}
    </div>
  );
}

// ─── Add puntata form ─────────────────────────────────────────
function AddPuntataForm({ sessioneId, sessioneBook, onClose }: { sessioneId: string; sessioneBook?: string; onClose: () => void }) {
  const addPuntata = useStore((s) => s.addPuntata);
  const [f, setF] = useState({ data: today(), importo: "", tipo: "NORMALE" as TipoPuntata, esito: "ATTESA" as EsitoPuntata, vincita: "", note: "", useSplits: false });
  const [splits, setSplits] = useState<PuntataSplit[]>(sessioneBook ? [{ book: sessioneBook, importo: 0 }] : []);

  const splitTotal = splits.reduce((a, s) => a + s.importo, 0);
  const finalImporto = f.useSplits ? splitTotal : parseFloat(f.importo) || 0;

  function submit() {
    if (finalImporto <= 0) return;
    const vincita = f.esito === "VINTA" && f.vincita ? parseFloat(f.vincita) : undefined;
    addPuntata(sessioneId, {
      data: f.data,
      importo: finalImporto,
      tipo: f.tipo,
      esito: f.esito,
      vincita,
      splits: f.useSplits && splits.length > 0 ? splits.filter((s) => s.book && s.importo > 0) : undefined,
      note: f.note || undefined,
    });
    onClose();
  }

  return (
    <div className="bg-[#0D1428] border border-[#1E2640] rounded-xl p-4 mt-2 grid grid-cols-2 md:grid-cols-4 gap-3">
      <Lbl t="Data"><input type="date" value={f.data} onChange={(e) => setF((x) => ({ ...x, data: e.target.value }))} className={C.input} /></Lbl>
      {f.useSplits ? (
        <div className="flex items-end pb-1">
          <span className="text-sm text-white font-bold">{splitTotal.toFixed(2)}€ <span className="text-xs text-gray-500">(da split)</span></span>
        </div>
      ) : (
        <Lbl t="Importo"><input type="number" value={f.importo} onChange={(e) => setF((x) => ({ ...x, importo: e.target.value }))} placeholder="es. 100" className={C.input} /></Lbl>
      )}
      <Lbl t="Tipo">
        <select value={f.tipo} onChange={(e) => setF((x) => ({ ...x, tipo: e.target.value as TipoPuntata }))} className={C.sel}>
          <option value="NORMALE">NORMALE</option>
          <option value="BONUS">BONUS</option>
          <option value="PERSONALE">PERSONALE (mia)</option>
        </select>
      </Lbl>
      <Lbl t="Esito">
        <select value={f.esito} onChange={(e) => setF((x) => ({ ...x, esito: e.target.value as EsitoPuntata }))} className={C.sel}>
          <option value="ATTESA">ATTESA</option>
          <option value="VINTA">VINTA</option>
          <option value="PERSA">PERSA</option>
        </select>
      </Lbl>
      {f.esito === "VINTA" ? (
        <Lbl t="Vincita totale"><input type="number" value={f.vincita} onChange={(e) => setF((x) => ({ ...x, vincita: e.target.value }))} placeholder="es. 180" className={C.input} /></Lbl>
      ) : null}
      <Lbl t="Note"><input type="text" value={f.note} onChange={(e) => setF((x) => ({ ...x, note: e.target.value }))} placeholder="opz." className={C.input} /></Lbl>

      {/* Split toggle */}
      <div className="col-span-full flex items-center gap-2">
        <button onClick={() => { setF((x) => ({ ...x, useSplits: !x.useSplits })); if (!f.useSplits && splits.length === 0) setSplits(sessioneBook ? [{ book: sessioneBook, importo: 0 }] : [{ book: "", importo: 0 }]); }} className={`${C.btn} ${f.useSplits ? C.yellow : C.ghost} text-xs`}>
          {f.useSplits ? "✓ Split attivo" : "Split su più book"}
        </button>
        <span className="text-xs text-gray-600">Dividi la puntata su più book</span>
      </div>

      {f.useSplits ? (
        <SplitEditor
          splits={splits}
          onChange={setSplits}
          totalImporto={parseFloat(f.importo) || 0}
          vincitaTotale={f.esito === "VINTA" && f.vincita ? parseFloat(f.vincita) : undefined}
        />
      ) : null}

      <div className="col-span-full flex gap-2 pt-1">
        <button onClick={submit} className={`${C.btn} ${C.prim} px-5`}>Aggiungi puntata</button>
        <button onClick={onClose} className={`${C.btn} ${C.ghost}`}>Annulla</button>
      </div>
    </div>
  );
}

// ─── Session panel ────────────────────────────────────────────
function SessionePanel({ s }: { s: SessionePasquale }) {
  const { chiudiSessione, removeSessione, addBonusRicevuto, riaprSessione, updateSessione, addDeposito, removeDeposito } = useStore((st) => st);
  const [addingPuntata, setAddingPuntata] = useState(false);
  const [addingBonus, setAddingBonus] = useState(false);
  const [editingMeta, setEditingMeta] = useState(false);
  const [eMeta, setEMeta] = useState({ nome: s.nome ?? "", importoDeposito: s.importoDeposito.toString(), dataInizio: s.dataInizio, dataFine: s.dataFine ?? "" });
  const [addingDeposito, setAddingDeposito] = useState(false);
  const [depForm, setDepForm] = useState({ data: today(), importo: "", depositante: "MIO" as DepositanteSessione, note: "" });
  const [bForm, setBForm] = useState({ data: today(), book: s.book ?? "", tipo: "SPORT" as TipoBonus, importo: "" });
  const [noteText, setNoteText] = useState(s.note ?? "");
  const [editingNote, setEditingNote] = useState(false);

  const prov = calcSettlement(s);
  const totDepositi = calcTotaleDepositi(s);
  const saldoCorrente = calcSaldoCorrente(s);
  const saldoDaGiocare = calcSaldoDaGiocare(s);
  const totPuntato = s.puntate.reduce((a, p) => a + p.importo, 0);
  const totPuntatoPasquale = s.puntate.filter((p) => p.tipo !== "PERSONALE").reduce((a, p) => a + p.importo, 0);
  const totPuntatoMio = s.puntate.filter((p) => p.tipo === "PERSONALE").reduce((a, p) => a + p.importo, 0);
  const totPerso = s.puntate.filter((p) => p.esito === "PERSA").reduce((a, p) => a + p.importo, 0);
  const pct = totPuntato > 0 ? ((totPerso / totPuntato) * 100).toFixed(1) : null;

  function submitBonus() {
    const importo = parseFloat(bForm.importo);
    if (!importo || !bForm.book) return;
    addBonusRicevuto({ amicoId: s.amicoId, data: bForm.data, book: bForm.book, tipo: bForm.tipo, importo });
    setBForm((f) => ({ ...f, importo: "" }));
    setAddingBonus(false);
  }

  const depColor = s.depositante === "MIO" ? "bg-blue-900/50 text-[#818CF8] border border-violet/25" : "bg-purple-900/50 text-purple-300 border border-purple-800";
  const isChiusa = !s.aperta;
  const settlement = isChiusa ? (s.settlementFinale ?? 0) : prov;

  return (
    <div className={`rounded-xl overflow-hidden ${isChiusa ? "opacity-70" : ""}`} style={{ background: "linear-gradient(135deg,#0D1428 0%,#111827 100%)", border: "1px solid rgba(79,70,229,0.13)" }}>
      {/* Session header */}
      {editingMeta ? (
        <div className="px-4 py-3 border-b border-[rgba(79,70,229,0.13)] space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Lbl t="Nome sessione">
              <input className={C.input} value={eMeta.nome} onChange={(e) => setEMeta((m) => ({ ...m, nome: e.target.value }))} placeholder="es. Goldbet luglio" />
            </Lbl>
            <Lbl t="Saldo iniziale €">
              <input type="number" className={C.input} value={eMeta.importoDeposito} onChange={(e) => setEMeta((m) => ({ ...m, importoDeposito: e.target.value }))} />
            </Lbl>
            <Lbl t="Data inizio">
              <input type="date" className={C.input} value={eMeta.dataInizio} onChange={(e) => setEMeta((m) => ({ ...m, dataInizio: e.target.value }))} />
            </Lbl>
            <Lbl t="Data fine (opz.)">
              <input type="date" className={C.input} value={eMeta.dataFine} onChange={(e) => setEMeta((m) => ({ ...m, dataFine: e.target.value }))} />
            </Lbl>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { const imp = parseFloat(eMeta.importoDeposito); updateSessione(s.id, { nome: eMeta.nome || undefined, importoDeposito: imp > 0 ? imp : s.importoDeposito, dataInizio: eMeta.dataInizio || s.dataInizio, dataFine: eMeta.dataFine || undefined }); setEditingMeta(false); }} className={`${C.btn} ${C.green}`}>Salva</button>
            <button onClick={() => setEditingMeta(false)} className={`${C.btn} ${C.ghost}`}>Annulla</button>
          </div>
        </div>
      ) : (
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-[rgba(79,70,229,0.13)]">
        {s.nome ? <span className="text-sm font-semibold text-white mr-1">{s.nome}</span> : null}
        <span className={`${C.badge} ${depColor}`}>SALDO {s.depositante}</span>
        {s.book ? <span className="text-xs text-gray-400 bg-[#1E2640] rounded px-2 py-0.5">{s.book}</span> : null}
        <button onClick={() => setAddingDeposito((v) => !v)}
          className="text-xs text-gray-400 hover:text-white bg-[#1E2640] hover:bg-[#1E2640] rounded px-2 py-0.5 transition-colors"
          title="Depositi">
          {totDepositi.toFixed(2)}€{(s.depositi ?? []).length > 0 ? ` (${1 + (s.depositi ?? []).length})` : ""} +
        </button>
        {s.puntate.length > 0 ? (
          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${saldoDaGiocare > 0 ? "bg-violet/10 text-[#818CF8]" : "bg-orange-900/40 text-orange-400"}`}>
            da giocare {saldoDaGiocare.toFixed(2)}€
          </span>
        ) : null}
        <span className="text-xs text-gray-600">{s.dataInizio}{s.dataFine ? ` → ${s.dataFine}` : ""}</span>
        {isChiusa ? <span className="text-xs text-gray-600 ml-auto">Chiusa {s.chiusaIl?.slice(0, 10)}</span> : null}
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => { setEMeta({ nome: s.nome ?? "", importoDeposito: s.importoDeposito.toString(), dataInizio: s.dataInizio, dataFine: s.dataFine ?? "" }); setEditingMeta(true); }} className={`${C.btn} ${C.ghost} text-[10px]`}>✎</button>
          {/* Settlement + pagato badge */}
          {s.saldato ? (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold bg-green-900/50 text-green-400 border border-green-800/50">
              ✓ PAGATO
            </span>
          ) : (
            <span className={`text-sm font-bold ${settlement > 0 ? "text-red-400" : settlement < 0 ? "text-green-400" : "text-gray-500"}`}>
              {settlement > 0 ? `Pasq. deve ${fmtAbs(settlement)}` : settlement < 0 ? `Tu devi ${fmtAbs(settlement)}` : "Pari"}
            </span>
          )}
          {/* Pulsante "Segna pagato" visibile sempre (aperta o chiusa) quando c'è un saldo */}
          {settlement !== 0 && !s.saldato ? (
            <button
              onClick={() => updateSessione(s.id, { saldato: true })}
              className="px-2 py-0.5 rounded text-[10px] font-semibold bg-green-900/40 hover:bg-green-800/60 text-green-400 border border-green-800/40 transition-colors"
              title="Segna il saldo come pagato">
              Segna pagato
            </button>
          ) : s.saldato ? (
            <button
              onClick={() => updateSessione(s.id, { saldato: false })}
              className="px-2 py-0.5 rounded text-[10px] text-gray-600 hover:text-gray-400 border border-gray-800 transition-colors"
              title="Annulla pagato">
              ✕ annulla
            </button>
          ) : null}
          {!isChiusa ? (
            <button onClick={() => chiudiSessione(s.id)} className={`${C.btn} ${C.green}`}>Chiudi</button>
          ) : (
            <button onClick={() => riaprSessione(s.id)} className={`${C.btn} bg-orange-800 hover:bg-orange-700 text-orange-100 text-xs`}>↩ Riapri</button>
          )}
          <button onClick={() => removeSessione(s.id)} className={`${C.btn} ${C.danger}`}>✕</button>
        </div>
      </div>
      )}

      {/* Depositi panel */}
      {addingDeposito ? (
        <div className="px-4 py-3 border-b border-[rgba(79,70,229,0.13)] bg-[#0D1428] space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-[#818CF8]">Depositi</span>
            <button onClick={() => setAddingDeposito(false)} className="text-gray-500 hover:text-gray-300 text-xs">✕</button>
          </div>
          {/* Existing deposits list */}
          <div className="space-y-1 mb-2">
            <div className="flex gap-2 text-[10px] text-gray-600 px-1">
              <span className="w-24">Data</span><span className="w-20 text-right">Importo</span><span className="w-20">Chi</span><span className="flex-1">Note</span>
            </div>
            <div className="flex gap-2 items-center text-xs text-gray-400 px-1 py-0.5 rounded bg-[#111827]">
              <span className="w-24">{s.dataInizio}</span>
              <span className="w-20 text-right font-semibold text-white">{s.importoDeposito.toFixed(2)}€</span>
              <span className="w-20"><span className={`${C.badge} text-[9px] ${s.depositante === "MIO" ? "bg-blue-900/50 text-[#818CF8]" : "bg-purple-900/50 text-purple-300"}`}>{s.depositante}</span></span>
              <span className="flex-1 text-gray-600">deposito iniziale</span>
            </div>
            {(s.depositi ?? []).map((d) => (
              <div key={d.id} className="flex gap-2 items-center text-xs text-gray-400 px-1 py-0.5 rounded bg-[#111827]">
                <span className="w-24">{d.data}</span>
                <span className="w-20 text-right font-semibold text-white">{d.importo.toFixed(2)}€</span>
                <span className="w-20"><span className={`${C.badge} text-[9px] ${d.depositante === "MIO" ? "bg-blue-900/50 text-[#818CF8]" : "bg-purple-900/50 text-purple-300"}`}>{d.depositante}</span></span>
                <span className="flex-1 text-gray-500">{d.note ?? ""}</span>
                <button onClick={() => removeDeposito(s.id, d.id)} className="text-red-500/60 hover:text-red-400 text-[10px] ml-1">✕</button>
              </div>
            ))}
            <div className="text-xs text-gray-400 pt-1 border-t border-[rgba(79,70,229,0.13)] px-1">
              Totale: <span className="font-bold text-white">{totDepositi.toFixed(2)}€</span>
            </div>
          </div>
          {/* Add deposit form */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[rgba(79,70,229,0.13)]">
            <Lbl t="Data"><input type="date" value={depForm.data} onChange={(e) => setDepForm((f) => ({ ...f, data: e.target.value }))} className={C.input} /></Lbl>
            <Lbl t="Importo €"><input type="number" step="0.01" value={depForm.importo} onChange={(e) => setDepForm((f) => ({ ...f, importo: e.target.value }))} placeholder="es. 200" className={C.input} /></Lbl>
            <Lbl t="Chi deposita">
              <select value={depForm.depositante} onChange={(e) => setDepForm((f) => ({ ...f, depositante: e.target.value as DepositanteSessione }))} className={C.sel}>
                <option value="MIO">SALDO MIO</option>
                <option value="SUO">SALDO SUO (Pasquale)</option>
              </select>
            </Lbl>
            <Lbl t="Note (opz.)"><input value={depForm.note} onChange={(e) => setDepForm((f) => ({ ...f, note: e.target.value }))} placeholder="facoltativo" className={C.input} /></Lbl>
          </div>
          <button onClick={() => { const imp = parseFloat(depForm.importo); if (!imp || imp <= 0) return; addDeposito(s.id, { data: depForm.data, importo: imp, depositante: depForm.depositante, note: depForm.note || undefined }); setDepForm((f) => ({ ...f, importo: "", note: "" })); }} className={`${C.btn} ${C.prim} w-full`}>
            + Aggiungi deposito
          </button>
        </div>
      ) : null}

      {/* Stats bar */}
      {s.puntate.length > 0 ? (
        <div className="flex gap-5 px-4 py-2 border-b border-[rgba(79,70,229,0.13)] text-[11px] text-gray-500">
          {totPuntatoPasquale > 0 ? <span>Giocato Pasq: <b className="text-[#818CF8]">{totPuntatoPasquale.toFixed(2)}€</b></span> : null}
          {totPuntatoMio > 0 ? <span>Giocato mio: <b className="text-purple-300">{totPuntatoMio.toFixed(2)}€</b></span> : null}
          <span>Perso: <b className="text-red-400">{totPerso.toFixed(2)}€</b></span>
          {pct ? <span>% perdita: <b className="text-orange-400">{pct}%</b></span> : null}
          <span>Puntate: <b className="text-gray-300">{s.puntate.length}</b></span>
        </div>
      ) : null}

      {/* Puntate list */}
      {s.puntate.length > 0 ? (
        <div>
          {s.puntate.map((p) => (
            <PuntataRow key={p.id} p={p} sessioneId={s.id} depositante={s.depositante} />
          ))}
        </div>
      ) : (
        <p className="px-4 py-3 text-xs text-gray-600">Nessuna puntata.</p>
      )}

      {/* Add puntata form */}
      {addingPuntata ? (
        <div className="px-4 pb-4">
          <AddPuntataForm sessioneId={s.id} sessioneBook={s.book} onClose={() => setAddingPuntata(false)} />
        </div>
      ) : null}

      {/* Add bonus form */}
      {addingBonus ? (
        <div className="px-4 pb-4 pt-2 border-t border-[rgba(79,70,229,0.13)] grid grid-cols-2 md:grid-cols-5 gap-3">
          <Lbl t="Data"><input type="date" value={bForm.data} onChange={(e) => setBForm((f) => ({ ...f, data: e.target.value }))} className={C.input} /></Lbl>
          <Lbl t="Book"><input type="text" value={bForm.book} onChange={(e) => setBForm((f) => ({ ...f, book: e.target.value }))} placeholder="es. Goldbet" className={C.input} /></Lbl>
          <Lbl t="Tipo">
            <select value={bForm.tipo} onChange={(e) => setBForm((f) => ({ ...f, tipo: e.target.value as TipoBonus }))} className={C.sel}>
              <option value="SPORT">SPORT</option>
              <option value="CASINO">CASINO</option>
            </select>
          </Lbl>
          <Lbl t="Importo"><input type="number" value={bForm.importo} onChange={(e) => setBForm((f) => ({ ...f, importo: e.target.value }))} placeholder="es. 100" className={C.input} /></Lbl>
          <div className="flex items-end gap-2">
            <button onClick={submitBonus} className={`${C.btn} ${C.prim} flex-1`}>Salva</button>
            <button onClick={() => setAddingBonus(false)} className={`${C.btn} ${C.ghost}`}>✕</button>
          </div>
        </div>
      ) : null}

      {/* Note sessione */}
      <div className="px-4 py-2 border-t border-[rgba(79,70,229,0.13)]">
        {editingNote ? (
          <div className="flex gap-2 items-center">
            <input className="bg-[#111827] border border-[#1E2640] rounded px-2 py-1 text-xs text-white flex-1 focus:outline-none focus:border-violet/50"
              placeholder="Note sessione..." value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { updateSessione(s.id, { note: noteText || undefined }); setEditingNote(false); }
                if (e.key === "Escape") { setNoteText(s.note ?? ""); setEditingNote(false); }
              }} autoFocus />
            <button onClick={() => { updateSessione(s.id, { note: noteText || undefined }); setEditingNote(false); }}
              className="text-green-400 hover:text-green-300 text-xs px-2">✓</button>
            <button onClick={() => { setNoteText(s.note ?? ""); setEditingNote(false); }}
              className="text-gray-500 hover:text-gray-300 text-xs px-1">✕</button>
          </div>
        ) : (
          <button onClick={() => setEditingNote(true)}
            className="text-xs text-gray-600 hover:text-gray-400 italic transition-colors w-full text-left">
            {s.note ? s.note : "+ aggiungi nota"}
          </button>
        )}
      </div>

      {/* Footer buttons — only for open sessions */}
      {!isChiusa ? (
        <div className="flex gap-2 px-4 py-3 border-t border-[rgba(79,70,229,0.13)]">
          <button onClick={() => { setAddingPuntata((v) => !v); setAddingBonus(false); }} className={`${C.btn} ${C.prim}`}>+ Puntata</button>
          <button onClick={() => { setAddingBonus((v) => !v); setAddingPuntata(false); }} className={`${C.btn} ${C.yellow}`}>+ Bonus ricevuto</button>
        </div>
      ) : null}
    </div>
  );
}

// ─── Bonus tracker ────────────────────────────────────────────
function BonusTracker({ amicoId }: { amicoId: number }) {
  const bonusRicevuti = useStore((s) => s.data.bonusRicevuti ?? []);
  const removeBonusRicevuto = useStore((s) => s.removeBonusRicevuto);
  const mine = bonusRicevuti.filter((b) => b.amicoId === amicoId);
  const [open, setOpen] = useState(false);

  const byWeek = useMemo(() => {
    const map: Record<string, { casino: number; sport: number; items: typeof mine }> = {};
    for (const b of mine) {
      const w = getISOWeek(b.data);
      if (!map[w]) map[w] = { casino: 0, sport: 0, items: [] };
      if (b.tipo === "CASINO") map[w].casino += b.importo;
      else map[w].sport += b.importo;
      map[w].items.push(b);
    }
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [mine]);

  if (mine.length === 0) return null;

  const totale = mine.reduce((a, b) => a + b.importo, 0);

  return (
    <div className="mt-3 rounded-xl overflow-hidden" style={{ background: "#0D1428", border: "1px solid #1E2640" }}>
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#111827]/50">
        <span className="text-xs font-semibold text-yellow-400">🎁 Bonus ricevuti</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-yellow-300 font-bold">{totale.toFixed(2)}€ tot.</span>
          <span className="text-xs text-gray-600">{open ? "▲" : "▼"}</span>
        </div>
      </button>
      {open ? (
        <div>
          {byWeek.map(([week, data]) => (
            <div key={week} className="border-t border-[rgba(79,70,229,0.13)]">
              <div className="flex items-center gap-4 px-4 py-1.5 bg-[#0A0F1E]">
                <span className="text-[10px] font-bold text-gray-500 uppercase">{week}</span>
                {data.casino > 0 ? <span className="text-[10px] text-purple-400">Casino {data.casino.toFixed(2)}€</span> : null}
                {data.sport > 0 ? <span className="text-[10px] text-[#818CF8]">Sport {data.sport.toFixed(2)}€</span> : null}
              </div>
              {data.items.map((b) => (
                <div key={b.id} className="flex items-center gap-3 px-4 py-1.5 border-t border-[rgba(79,70,229,0.13)]/50 hover:bg-[#111827]/30 text-xs">
                  <span className="text-gray-500 w-20">{b.data}</span>
                  <span className="text-gray-300 flex-1">{b.book}</span>
                  <span className={`${C.badge} ${b.tipo === "CASINO" ? "bg-purple-900/50 text-purple-300" : "bg-blue-900/50 text-[#818CF8]"}`}>{b.tipo}</span>
                  <span className="text-yellow-400 font-semibold">{b.importo.toFixed(2)}€</span>
                  <button onClick={() => removeBonusRicevuto(b.id)} className="text-red-600 hover:text-red-400 ml-1">✕</button>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ─── Amico Card ───────────────────────────────────────────────
function AmicoCard({ amicoId, nome, citta }: { amicoId: number; nome: string; citta?: string }) {
  const sessioni = useStore((s) => (s.data.sessioniPasquale ?? []).filter((x) => x.amicoId === amicoId));
  const apriSessione = useStore((s) => s.apriSessione);
  const [expanded, setExpanded] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);
  const [dForm, setDForm] = useState({ data: today(), dataFine: "", nome: "", importo: "", depositante: "MIO" as DepositanteSessione, book: "" });

  const aperte = sessioni.filter((s) => s.aperta);
  const chiuse = sessioni.filter((s) => !s.aperta);
  const [showChiuse, setShowChiuse] = useState(false);

  const totAperte = aperte.reduce((a, s) => a + calcSettlement(s), 0);
  const totChiuse = chiuse.reduce((a, s) => a + (s.settlementFinale ?? 0), 0);
  const grandTotal = totAperte + totChiuse;
  // Saldo da giocare = depositi - puntate, senza vincite (rollover tracker)
  const totalSaldoDaGiocare = aperte.reduce((a, s) => a + calcSaldoDaGiocare(s), 0);

  const bonusRicevuti = useStore((s) => (s.data.bonusRicevuti ?? []).filter((b) => b.amicoId === amicoId));
  const totBonus = bonusRicevuti.reduce((a, b) => a + b.importo, 0);

  function submitDeposit() {
    const importo = parseFloat(dForm.importo);
    if (!importo || importo <= 0) return;
    apriSessione(amicoId, dForm.depositante, importo, dForm.data, dForm.book || undefined, dForm.nome || undefined, dForm.dataFine || undefined);
    setDForm({ data: today(), dataFine: "", nome: "", importo: "", depositante: "MIO", book: "" });
    setShowDeposit(false);
    setExpanded(true);
  }

  const ini = initials(nome);

  return (
    <div className="rounded-2xl overflow-hidden transition-all" style={{ background: "linear-gradient(135deg,#111827 0%,#0A0F1E 100%)", border: "1px solid rgba(79,70,229,0.13)" }}>
      {/* Card header — always visible */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ background: "linear-gradient(135deg,#1e3a5f,#0d2040)", color: "#818CF8" }}>
            {ini}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white text-sm leading-tight">{nome}</p>
          </div>
          <button onClick={() => { setShowDeposit((v) => !v); setExpanded(true); }} className={`${C.btn} ${C.prim} flex-shrink-0`}>+ Nuova sessione</button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="bg-[#0A0F1E] rounded-lg px-3 py-2 text-center">
            <p className="text-[10px] text-gray-600 uppercase">Sessioni</p>
            <p className="text-sm font-bold text-white mt-0.5">{aperte.length} <span className="text-xs text-gray-600">aperte</span></p>
          </div>
          <div className="bg-[#0A0F1E] rounded-lg px-3 py-2 text-center">
            <p className="text-[10px] text-gray-600 uppercase">Saldo da giocare</p>
            <p className={`text-sm font-bold mt-0.5 ${totalSaldoDaGiocare > 0 ? "text-white" : totalSaldoDaGiocare < 0 ? "text-orange-400" : "text-gray-500"}`}>
              {aperte.length > 0 ? totalSaldoDaGiocare.toFixed(2) + "€" : "—"}
            </p>
          </div>
          <div className="bg-[#0A0F1E] rounded-lg px-3 py-2 text-center">
            <p className="text-[10px] text-gray-600 uppercase">Bonus</p>
            <p className="text-sm font-bold text-yellow-400 mt-0.5">{totBonus > 0 ? totBonus.toFixed(2) + "€" : "—"}</p>
          </div>
        </div>

        {/* Saldo label */}
        {grandTotal !== 0 ? (
          <div className={`mt-2 text-center text-xs font-semibold py-1 rounded-lg ${grandTotal > 0 ? "bg-red-950/50 text-red-400" : "bg-green-950/50 text-green-400"}`}>
            {grandTotal > 0 ? `⚠ Pasquale deve ${fmtAbs(grandTotal)}` : `✓ Devi ${fmtAbs(grandTotal)}`}
          </div>
        ) : null}
      </div>

      {/* Deposit form */}
      {showDeposit ? (
        <div className="px-4 pb-4 grid grid-cols-2 gap-3 border-t border-[rgba(79,70,229,0.13)] pt-3">
          <div className="col-span-2">
            <Lbl t="Nome sessione (opz.)"><input type="text" value={dForm.nome} onChange={(e) => setDForm((f) => ({ ...f, nome: e.target.value }))} placeholder="es. Goldbet luglio rollover" className={C.input} /></Lbl>
          </div>
          <Lbl t="Data inizio"><input type="date" value={dForm.data} onChange={(e) => setDForm((f) => ({ ...f, data: e.target.value }))} className={C.input} /></Lbl>
          <Lbl t="Data fine (opz.)"><input type="date" value={dForm.dataFine} onChange={(e) => setDForm((f) => ({ ...f, dataFine: e.target.value }))} className={C.input} /></Lbl>
          <Lbl t="Importo"><input type="number" value={dForm.importo} onChange={(e) => setDForm((f) => ({ ...f, importo: e.target.value }))} placeholder="es. 500" className={C.input} /></Lbl>
          <Lbl t="Saldo">
            <select value={dForm.depositante} onChange={(e) => setDForm((f) => ({ ...f, depositante: e.target.value as DepositanteSessione }))} className={C.sel}>
              <option value="MIO">SALDO MIO</option>
              <option value="SUO">SALDO SUO</option>
            </select>
          </Lbl>
          <Lbl t="Book (opz.)"><input type="text" value={dForm.book} onChange={(e) => setDForm((f) => ({ ...f, book: e.target.value }))} placeholder="es. Goldbet" className={C.input} /></Lbl>
          <div className="col-span-2 flex gap-2">
            <button onClick={submitDeposit} className={`${C.btn} ${C.prim} flex-1`}>Apri sessione</button>
            <button onClick={() => setShowDeposit(false)} className={`${C.btn} ${C.ghost}`}>Annulla</button>
          </div>
        </div>
      ) : null}

      {/* Expand/collapse toggle */}
      {sessioni.length > 0 ? (
        <button onClick={() => setExpanded((v) => !v)} className="w-full flex items-center justify-center gap-1 py-2 border-t border-[rgba(79,70,229,0.13)] text-xs text-gray-600 hover:text-gray-400 hover:bg-[#111827]/30">
          {expanded ? "▲ nascondi sessioni" : `▼ mostra sessioni (${sessioni.length})`}
        </button>
      ) : null}

      {/* Sessions */}
      {expanded ? (
        <div className="px-4 pb-4 space-y-3 border-t border-[rgba(79,70,229,0.13)] pt-3">
          {/* Open sessions */}
          {aperte.map((s) => (
            <SessionePanel key={s.id} s={s} />
          ))}

          {/* Bonus tracker */}
          <BonusTracker amicoId={amicoId} />

          {/* Closed sessions */}
          {chiuse.length > 0 ? (
            <div>
              <button onClick={() => setShowChiuse((v) => !v)} className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-400 py-1">
                {showChiuse ? "▲" : "▼"} Sessioni chiuse ({chiuse.length})
                {totChiuse !== 0 ? (
                  <span className={`font-semibold ${totChiuse > 0 ? "text-red-500" : "text-green-500"}`}>
                    tot. {totChiuse > 0 ? "deve" : "devi"} {fmtAbs(totChiuse)}
                  </span>
                ) : null}
              </button>
              {showChiuse ? (
                <div className="space-y-2 mt-2">
                  {chiuse.map((s) => (
                    <SessionePanel key={s.id} s={s} />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}


// ── Grafico andamento sessioni chiuse ─────────────────────────
function GraficoPasqubet({ sessioni }: { sessioni: import("@/lib/types").SessionePasquale[] }) {
  const chiuse = [...sessioni]
    .filter((s) => !s.aperta && s.chiusaIl)
    .sort((a, b) => (a.chiusaIl ?? "").localeCompare(b.chiusaIl ?? ""));
  if (chiuse.length < 2) return null;

  // Punti: settlement cumulativo (negativo = guadagno per noi)
  let cum = 0;
  const pts = chiuse.map((s) => {
    cum += -(s.settlementFinale ?? 0); // negativo = dobbiamo noi → perdita; positivo = guadagniamo
    return { label: s.nome ?? s.chiusaIl?.slice(5, 10) ?? "", v: cum };
  });

  const W = 600, H = 160;
  const PAD = { t: 20, b: 28, l: 48, r: 16 };
  const cw = W - PAD.l - PAD.r;
  const ch = H - PAD.t - PAD.b;
  const vals = pts.map((p) => p.v);
  const minV = Math.min(0, ...vals);
  const maxV = Math.max(0, ...vals);
  const range = maxV - minV || 1;
  const toY = (v: number) => PAD.t + ch - ((v - minV) / range) * ch;
  const toX = (i: number) => PAD.l + (i / Math.max(pts.length - 1, 1)) * cw;
  const zero = toY(0);
  const LIME = "#34D399";
  const RED = "#f87171";

  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(p.v).toFixed(1)}`).join(" ");
  const area = `${d} L${toX(pts.length - 1).toFixed(1)},${zero.toFixed(1)} L${toX(0).toFixed(1)},${zero.toFixed(1)} Z`;
  const lastPositive = pts[pts.length - 1].v >= 0;

  return (
    <div className="rounded-xl overflow-hidden mb-6" style={{ background: "#0D1428", border: "1px solid rgba(79,70,229,0.13)" }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(79,70,229,0.13)]">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Andamento sessioni chiuse</span>
        <span className={`text-sm font-bold ${lastPositive ? "text-green-400" : "text-red-400"}`}>
          {lastPositive ? "+" : ""}{cum.toFixed(2)}€ cumulato
        </span>
      </div>
      <div className="px-2 py-2 overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 320, height: H }}>
          {/* Zero line */}
          <line x1={PAD.l} y1={zero} x2={W - PAD.r} y2={zero} stroke="#1E2640" strokeWidth="1" strokeDasharray="4 3" />
          {/* Y labels */}
          {[minV, 0, maxV].filter((v, i, a) => a.indexOf(v) === i).map((v) => (
            <text key={v} x={PAD.l - 4} y={toY(v) + 4} fill="#555" fontSize="9" textAnchor="end">{v >= 0 ? "+" : ""}{v.toFixed(0)}€</text>
          ))}
          {/* Area */}
          <path d={area} fill={lastPositive ? LIME + "18" : RED + "18"} />
          {/* Line */}
          <path d={d} fill="none" stroke={lastPositive ? LIME : RED} strokeWidth="2" strokeLinejoin="round" />
          {/* Dots + labels */}
          {pts.map((p, i) => (
            <g key={i}>
              <circle cx={toX(i)} cy={toY(p.v)} r="3" fill={p.v >= 0 ? LIME : RED} />
              <text x={toX(i)} y={H - 6} fill="#555" fontSize="8" textAnchor="middle">{p.label}</text>
              {(i === 0 || i === pts.length - 1) && (
                <text x={toX(i)} y={toY(p.v) - 7} fill={p.v >= 0 ? LIME : RED} fontSize="9" textAnchor="middle" fontWeight="bold">
                  {p.v >= 0 ? "+" : ""}{p.v.toFixed(0)}€
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────
export default function PasqualePage() {
  const amici = useStore((s) => s.data.amici.filter((a) => a.attivo));
  const sessioni = useStore((s) => s.data.sessioniPasquale ?? []);

  const grandTotal = sessioni.reduce((a, s) => {
    const v = s.aperta ? calcSettlement(s) : (s.settlementFinale ?? 0);
    return a + v;
  }, 0);

  return (
    <AppShell>
      <div className="p-6 max-w-6xl mx-auto">
        {/* Global banner */}
        {grandTotal !== 0 ? (
          <div className={`mb-6 px-5 py-3 rounded-xl flex items-center justify-between ${grandTotal > 0 ? "bg-red-950/60 border border-red-900 text-red-300" : "bg-green-950/60 border border-green-900 text-green-300"}`}>
            <span className="font-bold">{grandTotal > 0 ? `⚠️ Gli ID ti devono in totale ${fmtAbs(grandTotal)}` : `✅ Devi in totale ${fmtAbs(grandTotal)} agli ID`}</span>
          </div>
        ) : null}

        <h1 className="text-2xl font-bold text-white mb-6">Pasqubet</h1>

        <GraficoPasqubet sessioni={sessioni} />

        {amici.length > 0 ? (
          <div className="space-y-4">
            {amici.map((a) => (
              <AmicoCard key={a.id} amicoId={a.id} nome={a.nome} citta={a.citta} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500 text-sm">
            Nessun amico attivo. Aggiungine uno dalla sezione ID.
          </div>
        )}
      </div>
    </AppShell>
  );
}