import type { AppData, RigaBook, Amico, CellaBook, StatoBook, MeseProfit, TodoItem, Spesa, Versamento, Prelievo, SessionePasquale, BonusRicevuto, DepositanteSessione, TipoPuntata, EsitoPuntata, TipoBonus, GiocataPersonale, TipoGiocata, DepositoAggiuntivo } from "./types";
import { BOOK_ADM, SCHEMA_VERSION, CYCLE_STATI } from "./constants";

export function getInitialData(): AppData {
  return {
    capitaleIniziale: 0,
    dataPartenza: undefined,
    amici: [],
    righeBook: BOOK_ADM.map((book) => ({ book, celle: {} })),
    mesiProfit: [],
    todos: [],
    spese: [],
    versamenti: [],
    prelievi: [],
    sessioniPasquale: [],
    bonusRicevuti: [],
    giocatePersonali: [],
    _v: SCHEMA_VERSION,
  };
}

export function isValidAppData(d: any): d is AppData {
  return d && typeof d === "object" && Array.isArray(d.amici) && Array.isArray(d.righeBook);
}

const num = (v: any): number => { const n = typeof v === "number" ? v : parseFloat(String(v ?? "")); return Number.isFinite(n) ? n : 0; };
const str = (v: any): string => (typeof v === "string" ? v : v == null ? "" : String(v));
const bool = (v: any, def = false): boolean => (typeof v === "boolean" ? v : def);
const isObj = (v: any): v is Record<string, any> => v != null && typeof v === "object" && !Array.isArray(v);
const arr = (v: any): any[] => (Array.isArray(v) ? v : []);

function sanCella(c: any): CellaBook {
  const stato = CYCLE_STATI.includes(c?.stato) ? (c.stato as StatoBook) : "";
  return { stato, saldo: num(c?.saldo) };
}

export function sanitizeAppData(raw: any): AppData {
  const base = getInitialData();
  if (!isObj(raw)) return base;

  const amici: Amico[] = arr(raw.amici)
    .filter((a) => isObj(a) && a.nome != null)
    .map((a, i) => ({
      id: Number.isInteger(a.id) ? a.id : i + 1,
      nome: str(a.nome) || `ID ${i + 1}`,
      citta: a.citta ? str(a.citta) : undefined,
      dataNascita: a.dataNascita ? str(a.dataNascita) : undefined,
      codiceFiscale: a.codiceFiscale ? str(a.codiceFiscale) : undefined,
      scadenzaCI: a.scadenzaCI ? str(a.scadenzaCI) : undefined,
      email: a.email ? str(a.email) : undefined,
      telefono: a.telefono ? str(a.telefono) : undefined,
      paypalEmail: a.paypalEmail ? str(a.paypalEmail) : undefined,
      postepayEmail: a.postepayEmail ? str(a.postepayEmail) : undefined,
      postepayIban: a.postepayIban ? str(a.postepayIban) : undefined,
      revolutEmail: a.revolutEmail ? str(a.revolutEmail) : undefined,
      revolutTag: a.revolutTag ? str(a.revolutTag) : undefined,
      ibanBanca: a.ibanBanca ? str(a.ibanBanca) : undefined,
      bancaIntestatario: a.bancaIntestatario ? str(a.bancaIntestatario) : undefined,
      satispayNumero: a.satispayNumero ? str(a.satispayNumero) : undefined,
      walletExtra: Array.isArray(a.walletExtra)
        ? a.walletExtra.filter(isObj).map((w: any) => ({ tipo: str(w.tipo), valore: str(w.valore), note: w.note ? str(w.note) : undefined }))
        : undefined,
      docFronte: a.docFronte ? str(a.docFronte) : undefined,
      docRetro: a.docRetro ? str(a.docRetro) : undefined,
      docSelfie: a.docSelfie ? str(a.docSelfie) : undefined,
      note: a.note ? str(a.note) : undefined,
      attivo: bool(a.attivo, true),
    }));

  const amiciOk = amici.length ? amici : base.amici;

  const rawRighe = arr(raw.righeBook);
  const customBooks = rawRighe.filter((r: any) => isObj(r) && !BOOK_ADM.includes(r.book)).map((r: any) => str(r.book)).filter(Boolean);
  const allBooks = [...BOOK_ADM, ...customBooks];
  const righeBook: RigaBook[] = allBooks.map((book) => {
    const ex = rawRighe.find((r: any) => isObj(r) && r.book === book);
    const celle: Record<number, CellaBook> = {};
    for (const a of amiciOk) celle[a.id] = sanCella(isObj(ex?.celle) ? ex.celle[a.id] : undefined);
    return { book, celle };
  });

  const YM = /^\d{4}-\d{2}$/;
  const mesiProfit: MeseProfit[] = arr(raw.mesiProfit)
    .filter((m: any) => isObj(m) && typeof m.mese === "string" && YM.test(m.mese))
    .map((m: any) => ({ mese: m.mese, capitaleInizio: num(m.capitaleInizio), profitto: num(m.profitto), capitaleFine: num(m.capitaleFine), spese: num(m.spese), note: m.note ? str(m.note) : undefined, chiusoIl: m.chiusoIl ? str(m.chiusoIl) : new Date().toISOString() }));

  const todos: TodoItem[] = arr(raw.todos).filter(isObj).map((t: any) => ({ id: str(t.id) || Math.random().toString(36).slice(2), testo: str(t.testo), data: t.data ? str(t.data) : undefined, amicoId: t.amicoId != null ? num(t.amicoId) : undefined, book: t.book ? str(t.book) : undefined, fatto: bool(t.fatto), creato: t.creato ? str(t.creato) : new Date().toISOString() }));

  const spese: Spesa[] = arr(raw.spese).filter(isObj).map((s: any) => ({ id: str(s.id) || Math.random().toString(36).slice(2), data: str(s.data), descrizione: str(s.descrizione), importo: num(s.importo), tipo: (["FISSA", "UNA_TANTUM", "PAGAMENTO_ID", "VERSAMENTO"] as const).includes(s.tipo) ? s.tipo : "UNA_TANTUM", amicoId: s.amicoId != null ? num(s.amicoId) : undefined, note: s.note ? str(s.note) : undefined }));

  const versamenti: Versamento[] = arr(raw.versamenti).filter(isObj).map((v: any) => ({ id: str(v.id) || Math.random().toString(36).slice(2), data: str(v.data), importo: num(v.importo), note: v.note ? str(v.note) : undefined }));

  const prelievi: Prelievo[] = arr(raw.prelievi).filter(isObj).map((p: any) => ({ id: str(p.id) || Math.random().toString(36).slice(2), amicoId: num(p.amicoId), book: str(p.book), importo: num(p.importo), data: str(p.data), note: p.note ? str(p.note) : undefined }));

  const DEPOSITANTI: DepositanteSessione[] = ["MIO", "SUO"];
  const TIPI: TipoPuntata[] = ["NORMALE", "BONUS", "PERSONALE"];
  const ESITI: EsitoPuntata[] = ["ATTESA", "VINTA", "PERSA"];
  const TIPIBONUS: TipoBonus[] = ["CASINO", "SPORT"];
  const TIPIGIOCATA: TipoGiocata[] = ["SPORT", "CASINO"];

  const sessioniPasquale: SessionePasquale[] = arr(raw.sessioniPasquale).filter(isObj).map((s: any) => ({
    id: str(s.id) || Math.random().toString(36).slice(2),
    amicoId: num(s.amicoId),
    nome: s.nome ? str(s.nome) : undefined,
    dataInizio: str(s.dataInizio),
    dataFine: s.dataFine ? str(s.dataFine) : undefined,
    book: s.book ? str(s.book) : undefined,
    depositante: DEPOSITANTI.includes(s.depositante) ? s.depositante : "MIO",
    importoDeposito: num(s.importoDeposito),
    aperta: bool(s.aperta, true),
    chiusaIl: s.chiusaIl ? str(s.chiusaIl) : undefined,
    settlementFinale: s.settlementFinale != null ? num(s.settlementFinale) : undefined,
    saldato: s.saldato ? bool(s.saldato) : undefined,
    depositi: arr(s.depositi).filter(isObj).map((d: any) => ({
      id: str(d.id) || Math.random().toString(36).slice(2),
      data: str(d.data),
      importo: num(d.importo),
      depositante: DEPOSITANTI.includes(d.depositante) ? d.depositante : "MIO",
      note: d.note ? str(d.note) : undefined,
    })),
    puntate: arr(s.puntate).filter(isObj).map((p: any) => ({
      id: str(p.id) || Math.random().toString(36).slice(2),
      data: str(p.data),
      importo: num(p.importo),
      tipo: TIPI.includes(p.tipo) ? p.tipo : "NORMALE",
      esito: ESITI.includes(p.esito) ? p.esito : "ATTESA",
      vincita: p.vincita != null ? num(p.vincita) : undefined,
      splits: Array.isArray(p.splits) ? p.splits.filter(isObj).map((sp: any) => ({ book: str(sp.book), importo: num(sp.importo) })).filter((sp: any) => sp.book && sp.importo > 0) : undefined,
      note: p.note ? str(p.note) : undefined,
    })),
  }));

  const bonusRicevuti: BonusRicevuto[] = arr(raw.bonusRicevuti).filter(isObj).map((b: any) => ({
    id: str(b.id) || Math.random().toString(36).slice(2),
    amicoId: num(b.amicoId),
    data: str(b.data),
    book: str(b.book),
    tipo: TIPIBONUS.includes(b.tipo) ? b.tipo : "CASINO",
    importo: num(b.importo),
    note: b.note ? str(b.note) : undefined,
  }));

  const giocatePersonali: GiocataPersonale[] = arr(raw.giocatePersonali).filter(isObj).map((g: any) => ({
    id: str(g.id) || Math.random().toString(36).slice(2),
    data: str(g.data),
    book: str(g.book),
    tipo: TIPIGIOCATA.includes(g.tipo) ? g.tipo : "SPORT",
    importo: num(g.importo),
    esito: ESITI.includes(g.esito) ? g.esito : "ATTESA",
    vincita: g.vincita != null ? num(g.vincita) : undefined,
    note: g.note ? str(g.note) : undefined,
  }));

  return {
    capitaleIniziale: num(raw.capitaleIniziale),
    dataPartenza: raw.dataPartenza ? str(raw.dataPartenza) : undefined,
    amici: amiciOk,
    righeBook,
    mesiProfit,
    todos,
    spese,
    versamenti,
    prelievi,
    sessioniPasquale,
    bonusRicevuti,
    giocatePersonali,
    _v: SCHEMA_VERSION,
  };
}
