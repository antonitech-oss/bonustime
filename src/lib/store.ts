"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppData, Amico, StatoBook, TodoItem, Spesa, Versamento, Prelievo, SessionePasquale, Puntata, BonusRicevuto, DepositanteSessione, GiocataPersonale, DepositoAggiuntivo } from "./types";
import { getInitialData, sanitizeAppData } from "./initialData";
import { uid, nextMeseYM } from "./calculations";
import { SCHEMA_VERSION, CYCLE_STATI, BOOK_ADM } from "./constants";

interface StoreState {
  data: AppData;
  _dirty: number;
  replaceAll: (d: AppData) => void;
  resetAll: () => void;
  bump: () => void;
  setCapitale: (importo: number, data?: string) => void;
  addVersamento: (importo: number, data: string, note?: string) => void;
  removeVersamento: (id: string) => void;
  addAmico: (nome: string) => number;
  updateAmico: (id: number, patch: Partial<Amico>) => void;
  removeAmico: (id: number) => void;
  cycleStato: (book: string, amicoId: number) => void;
  setStato: (book: string, amicoId: number, stato: StatoBook) => void;
  setSaldo: (book: string, amicoId: number, saldo: number) => void;
  setBloccato: (book: string, amicoId: number, bloccato: number) => void;
  addBook: (nome: string) => void;
  addTodo: (t: Omit<TodoItem, "id" | "creato" | "fatto">) => void;
  updateTodo: (id: string, patch: Partial<Pick<TodoItem, "testo" | "data" | "ora" | "amicoId" | "book">>) => void;
  toggleTodo: (id: string) => void;
  removeTodo: (id: string) => void;
  addSpesa: (s: Omit<Spesa, "id">) => void;
  removeSpesa: (id: string) => void;
  updateSpesa: (id: string, patch: Partial<import('./types').Spesa>) => void;
  addPrelievo: (p: Omit<Prelievo, "id">) => void;
  removePrelievo: (id: string) => void;
  chiudiMese: (capitaleFine: number, note?: string) => void;
  // Ledger Pasquale
  apriSessione: (amicoId: number, depositante: DepositanteSessione, importo: number, data: string, book?: string, nome?: string, dataFine?: string) => void;
  addPuntata: (sessioneId: string, p: Omit<Puntata, "id">) => void;
  updatePuntata: (sessioneId: string, puntataId: string, patch: Partial<Omit<Puntata, "id">>) => void;
  removePuntata: (sessioneId: string, puntataId: string) => void;
  chiudiSessione: (sessioneId: string) => void;
  removeSessione: (sessioneId: string) => void;
  riaprSessione: (sessioneId: string) => void;
  updateSessione: (sessioneId: string, patch: { nome?: string; importoDeposito?: number; dataInizio?: string; dataFine?: string; note?: string; saldato?: boolean }) => void;
  saldaSessione: (sessioneId: string) => void;
  saldaTutto: () => void;
  addDeposito: (sessioneId: string, d: Omit<DepositoAggiuntivo, "id">) => void;
  removeDeposito: (sessioneId: string, depositoId: string) => void;
  addBonusRicevuto: (b: Omit<BonusRicevuto, "id">) => void;
  removeBonusRicevuto: (id: string) => void;
  // Giocate personali
  addGiocata: (g: Omit<GiocataPersonale, "id">) => void;
  updateGiocata: (id: string, patch: Partial<Omit<GiocataPersonale, "id">>) => void;
  removeGiocata: (id: string) => void;
}

function touch(set: any, get: any, mut: (d: AppData) => void) {
  const d = structuredClone(get().data) as AppData;
  mut(d);
  d._v = SCHEMA_VERSION;
  set({ data: d, _dirty: Date.now() });
}

export function calcSettlement(s: SessionePasquale): number {
  let total = 0;
  for (const p of s.puntate) {
    if (p.esito === "ATTESA" || p.tipo === "PERSONALE") continue;
    if (p.tipo === "BONUS") {
      total += p.importo;
      if (p.esito === "VINTA") total -= ((p.vincita ?? 0) - p.importo);
    } else if (s.depositante === "MIO") {
      if (p.esito === "PERSA") total += p.importo;
      if (p.esito === "VINTA") total -= ((p.vincita ?? 0) - p.importo);
    } else {
      if (p.esito === "VINTA") total -= (p.vincita ?? 0);
    }
  }
  return total;
}

// Total deposited across all deposits (primo + aggiuntivi)
export function calcTotaleDepositi(s: SessionePasquale): number {
  return s.importoDeposito + (s.depositi ?? []).reduce((a, d) => a + d.importo, 0);
}

// Net effect of PERSONALE bets on the session bankroll.
// Stake is committed immediately (even in ATTESA).
// If VINTA, the full vincita is returned.
export function calcSaldoPersonale(s: SessionePasquale): number {
  let delta = 0;
  for (const p of s.puntate) {
    if (p.tipo !== "PERSONALE") continue;
    delta -= p.importo;
    if (p.esito === "VINTA") delta += (p.vincita ?? 0);
  }
  return delta;
}

// Saldo corrente reale della sessione (depositi - staked + vincite).
// Parte dai depositi totali, scala ogni stake subito, aggiunge la vincita se VINTA.
export function calcSaldoCorrente(s: SessionePasquale): number {
  let saldo = calcTotaleDepositi(s);
  for (const p of s.puntate) {
    saldo -= p.importo;
    if (p.esito === "VINTA") saldo += (p.vincita ?? 0);
  }
  return saldo;
}

// Saldo DA GIOCARE = saldo reale disponibile nel conto (depositi + vincite - giocato).
// Include le vincite: se hai vinto e rigiochi con le vincite, il saldo rimane positivo.
export function calcSaldoDaGiocare(s: SessionePasquale): number {
  const totDepositi = calcTotaleDepositi(s);
  const puntateRollover = s.puntate.filter((p) => p.tipo !== "PERSONALE");
  const totGiocato = puntateRollover.reduce((a, p) => a + p.importo, 0);
  const totVincite = puntateRollover
    .filter((p) => p.esito === "VINTA")
    .reduce((a, p) => a + (p.vincita ?? 0), 0);
  return totDepositi + totVincite - totGiocato;
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      data: getInitialData(),
      _dirty: 0,

      replaceAll: (d) => set({ data: sanitizeAppData(d), _dirty: Date.now() }),
      resetAll: () => set({ data: getInitialData(), _dirty: Date.now() }),
      bump: () => set({ _dirty: Date.now() }),

      setCapitale: (importo, data) => touch(set, get, (d) => { d.capitaleIniziale = importo; if (data) d.dataPartenza = data; }),

      addVersamento: (importo, data, note) => touch(set, get, (d) => { d.versamenti.push({ id: uid(), importo, data, note }); }),
      removeVersamento: (id) => touch(set, get, (d) => { d.versamenti = d.versamenti.filter((v) => v.id !== id); }),

      addAmico: (nome) => {
        const id = Math.max(0, ...get().data.amici.map((a) => a.id)) + 1;
        touch(set, get, (d) => { d.amici.push({ id, nome, attivo: true }); for (const r of d.righeBook) r.celle[id] = { stato: "", saldo: 0 }; });
        return id;
      },
      updateAmico: (id, patch) => touch(set, get, (d) => { const a = d.amici.find((x) => x.id === id); if (a) Object.assign(a, patch); }),
      removeAmico: (id) => touch(set, get, (d) => { d.amici = d.amici.filter((a) => a.id !== id); for (const r of d.righeBook) delete r.celle[id]; }),

      cycleStato: (book, amicoId) => touch(set, get, (d) => {
        const r = d.righeBook.find((x) => x.book === book);
        if (r) { const cur = r.celle[amicoId]?.stato || ""; const idx = CYCLE_STATI.indexOf(cur as StatoBook); const next = CYCLE_STATI[(idx + 1) % CYCLE_STATI.length]; r.celle[amicoId] = r.celle[amicoId] || { stato: "", saldo: 0 }; r.celle[amicoId].stato = next; }
      }),
      setStato: (book, amicoId, stato) => touch(set, get, (d) => { const r = d.righeBook.find((x) => x.book === book); if (r) { r.celle[amicoId] = r.celle[amicoId] || { stato: "", saldo: 0 }; r.celle[amicoId].stato = stato; } }),
      setSaldo: (book, amicoId, saldo) => touch(set, get, (d) => { const r = d.righeBook.find((x) => x.book === book); if (r) { r.celle[amicoId] = r.celle[amicoId] || { stato: "", saldo: 0 }; r.celle[amicoId].saldo = saldo; } }),
      setBloccato: (book, amicoId, bloccato) => touch(set, get, (d) => { const r = d.righeBook.find((x) => x.book === book); if (r) { r.celle[amicoId] = r.celle[amicoId] || { stato: "", saldo: 0 }; r.celle[amicoId].bloccato = bloccato; } }),
      addBook: (nome) => touch(set, get, (d) => { if (!d.righeBook.some((r) => r.book === nome)) d.righeBook.push({ book: nome, celle: Object.fromEntries(d.amici.map((a) => [a.id, { stato: "" as StatoBook, saldo: 0 }])) }); }),

      addTodo: (t) => touch(set, get, (d) => { d.todos.push({ ...t, id: uid(), fatto: false, creato: new Date().toISOString(), ora: t.ora }); }),
      updateTodo: (id, patch) => touch(set, get, (d) => { const t = d.todos.find((x) => x.id === id); if (t) Object.assign(t, patch); }),
      toggleTodo: (id) => touch(set, get, (d) => { const t = d.todos.find((x) => x.id === id); if (t) { t.fatto = !t.fatto; if (t.fatto && t.book && t.amicoId != null) { const r = d.righeBook.find((x) => x.book === t.book); if (r) { r.celle[t.amicoId] = r.celle[t.amicoId] || { stato: "", saldo: 0 }; r.celle[t.amicoId].stato = "ATTIVO"; } } } }),
      removeTodo: (id) => touch(set, get, (d) => { d.todos = d.todos.filter((x) => x.id !== id); }),

      addSpesa: (s) => touch(set, get, (d) => { d.spese.push({ ...s, id: uid() }); }),
      removeSpesa: (id) => touch(set, get, (d) => { d.spese = d.spese.filter((x) => x.id !== id); }),
      updateSpesa: (id, patch) => touch(set, get, (d) => { const i = d.spese.findIndex(x => x.id === id); if (i >= 0) d.spese[i] = { ...d.spese[i], ...patch }; }),

      addPrelievo: (p) => touch(set, get, (d) => {
        if (!d.prelievi) d.prelievi = [];
        d.prelievi.push({ ...p, id: uid() });
        const riga = d.righeBook.find((r) => r.book === p.book);
        if (riga) { riga.celle[p.amicoId] = riga.celle[p.amicoId] || { stato: "", saldo: 0 }; riga.celle[p.amicoId].saldo = Math.max(0, (riga.celle[p.amicoId].saldo || 0) - p.importo); }
      }),
      removePrelievo: (id) => touch(set, get, (d) => {
        if (!d.prelievi) return;
        const p = d.prelievi.find((x) => x.id === id);
        if (p) { const riga = d.righeBook.find((r) => r.book === p.book); if (riga?.celle[p.amicoId]) riga.celle[p.amicoId].saldo = (riga.celle[p.amicoId].saldo || 0) + p.importo; }
        d.prelievi = d.prelievi.filter((x) => x.id !== id);
      }),

      // ── Ledger Pasquale ────────────────────────────────────────────
      apriSessione: (amicoId, depositante, importo, data, book, nome, dataFine) => touch(set, get, (d) => {
        if (!d.sessioniPasquale) d.sessioniPasquale = [];
        d.sessioniPasquale.push({ id: uid(), amicoId, nome: nome || undefined, dataInizio: data, dataFine: dataFine || undefined, depositante, importoDeposito: importo, book: book || undefined, puntate: [], aperta: true });
      }),

      addPuntata: (sessioneId, p) => touch(set, get, (d) => {
        const s = (d.sessioniPasquale || []).find((x) => x.id === sessioneId);
        if (s) s.puntate.push({ ...p, id: uid() });
      }),

      updatePuntata: (sessioneId, puntataId, patch) => touch(set, get, (d) => {
        const s = (d.sessioniPasquale || []).find((x) => x.id === sessioneId);
        if (s) { const p = s.puntate.find((x) => x.id === puntataId); if (p) Object.assign(p, patch); }
      }),

      removePuntata: (sessioneId, puntataId) => touch(set, get, (d) => {
        const s = (d.sessioniPasquale || []).find((x) => x.id === sessioneId);
        if (s) s.puntate = s.puntate.filter((x) => x.id !== puntataId);
      }),

      chiudiSessione: (sessioneId) => touch(set, get, (d) => {
        const s = (d.sessioniPasquale || []).find((x) => x.id === sessioneId);
        if (s) { s.aperta = false; s.chiusaIl = new Date().toISOString(); s.settlementFinale = calcSettlement(s); }
      }),

      removeSessione: (sessioneId) => touch(set, get, (d) => {
        d.sessioniPasquale = (d.sessioniPasquale || []).filter((x) => x.id !== sessioneId);
      }),

      updateSessione: (sessioneId, patch) => touch(set, get, (d) => {
        const s = (d.sessioniPasquale || []).find((x) => x.id === sessioneId);
        if (s) Object.assign(s, patch);
      }),
      riaprSessione: (sessioneId) => touch(set, get, (d) => {
        const s = (d.sessioniPasquale || []).find((x) => x.id === sessioneId);
        if (s) { s.aperta = true; s.chiusaIl = undefined; s.settlementFinale = undefined; s.saldato = undefined; }
      }),

      addDeposito: (sessioneId, dep) => touch(set, get, (d) => {
        const s = (d.sessioniPasquale || []).find((x) => x.id === sessioneId);
        if (s) { if (!s.depositi) s.depositi = []; s.depositi.push({ ...dep, id: uid() }); }
      }),
      removeDeposito: (sessioneId, depositoId) => touch(set, get, (d) => {
        const s = (d.sessioniPasquale || []).find((x) => x.id === sessioneId);
        if (s && s.depositi) s.depositi = s.depositi.filter((x) => x.id !== depositoId);
      }),
      addBonusRicevuto: (b) => touch(set, get, (d) => {
        if (!d.bonusRicevuti) d.bonusRicevuti = [];
        d.bonusRicevuti.push({ ...b, id: uid() });
      }),
      saldaSessione: (sessioneId) => touch(set, get, (d) => {
        const s = (d.sessioniPasquale || []).find((x) => x.id === sessioneId);
        if (s) s.saldato = true;
      }),
      saldaTutto: () => touch(set, get, (d) => {
        for (const s of (d.sessioniPasquale || [])) s.saldato = true;
      }),
      removeBonusRicevuto: (id) => touch(set, get, (d) => {
        d.bonusRicevuti = (d.bonusRicevuti || []).filter((x) => x.id !== id);
      }),

      // ── Giocate Personali ──────────────────────────────────────────
      addGiocata: (g) => touch(set, get, (d) => {
        if (!d.giocatePersonali) d.giocatePersonali = [];
        d.giocatePersonali.push({ ...g, id: uid() });
      }),
      updateGiocata: (id, patch) => touch(set, get, (d) => {
        const g = (d.giocatePersonali || []).find((x) => x.id === id);
        if (g) Object.assign(g, patch);
      }),
      removeGiocata: (id) => touch(set, get, (d) => {
        d.giocatePersonali = (d.giocatePersonali || []).filter((x) => x.id !== id);
      }),

      chiudiMese: (capitaleFine, note) => touch(set, get, (d) => {
        const ym = nextMeseYM(d.mesiProfit);
        const capitaleInizio = d.mesiProfit.length ? d.mesiProfit[d.mesiProfit.length - 1].capitaleFine : d.capitaleIniziale;
        const versMese = d.versamenti.filter((v) => v.data.startsWith(ym)).reduce((a, v) => a + v.importo, 0);
        const speseMese = d.spese.filter((s) => s.tipo !== "VERSAMENTO" && s.data.startsWith(ym)).reduce((a, s) => a + s.importo, 0);
        const profitto = capitaleFine - capitaleInizio - versMese + speseMese;
        d.mesiProfit.push({ mese: ym, capitaleInizio, profitto, capitaleFine, spese: speseMese, note, chiusoIl: new Date().toISOString() });
      }),
    }),
    {
      name: "bonustime-v3",
      version: 3,
      skipHydration: true,
      partialize: (s) => ({ data: s.data }),
      migrate: () => ({ data: getInitialData() } as any),
      onRehydrateStorage: () => (state) => { if (state) state.data = sanitizeAppData(state.data); },
    }
  )
);
