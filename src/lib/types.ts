// ===== Bonustime v3 — schema dati =====

export type StatoBook = "" | "DA APRIRE" | "ATTIVO" | "LIMITATO" | "CHIUSO";

export interface WalletExtra {
  tipo: string;
  valore: string;
  note?: string;
}

export interface Amico {
  id: number;
  nome: string;
  citta?: string;
  dataNascita?: string;
  codiceFiscale?: string;
  scadenzaCI?: string;
  email?: string;
  telefono?: string;
  // wallet
  paypalEmail?: string;
  postepayEmail?: string;
  postepayIban?: string;
  revolutEmail?: string;
  revolutTag?: string;
  ibanBanca?: string;
  bancaIntestatario?: string;
  satispayNumero?: string;
  walletExtra?: WalletExtra[];
  // documenti storage (path nel bucket)
  docFronte?: string;
  docRetro?: string;
  docSelfie?: string;
  note?: string;
  attivo: boolean;
}

export interface CellaBook {
  stato: StatoBook;
  saldo: number;
  bloccato?: number;  // quota non prelevabile (rollover)
}

export interface RigaBook {
  book: string;
  celle: Record<number, CellaBook>; // key = amicoId
}

export interface MeseProfit {
  mese: string;         // YYYY-MM
  capitaleInizio: number;
  profitto: number;
  capitaleFine: number;
  spese: number;
  note?: string;
  chiusoIl: string;
  saldoReale?: number;
}

export interface TodoItem {
  id: string;
  testo: string;
  data?: string;         // YYYY-MM-DD
  ora?: string;          // HH:MM
  amicoId?: number;
  book?: string;
  fatto: boolean;
  creato: string;
}

export type TipoSpesa = "FISSA" | "UNA_TANTUM" | "PAGAMENTO_ID" | "VERSAMENTO";

export interface Spesa {
  id: string;
  data: string;          // YYYY-MM-DD
  descrizione: string;
  importo: number;
  tipo: TipoSpesa;
  amicoId?: number;
  note?: string;
}

export interface Versamento {
  id: string;
  data: string;
  importo: number;
  note?: string;
}

// ===== Ledger Pasquale =====

export type DepositanteSessione = "MIO" | "SUO";
export type TipoPuntata = "NORMALE" | "BONUS" | "PERSONALE";
export type EsitoPuntata = "ATTESA" | "VINTA" | "PERSA";
export type TipoBonus = "CASINO" | "SPORT";

export interface PuntataSplit {
  book: string;
  importo: number;
}

export interface Puntata {
  id: string;
  data: string;           // YYYY-MM-DD
  importo: number;        // totale (somma splits se presenti)
  tipo: TipoPuntata;
  esito: EsitoPuntata;
  vincita?: number;       // totale ricevuto se VINTA
  vincitaRitirata?: boolean; // SALDO SUO: la vincita è stata prelevata dal book
  splits?: PuntataSplit[]; // split su più book
  note?: string;
}

export interface DepositoAggiuntivo {
  id: string;
  data: string;
  importo: number;
  depositante: DepositanteSessione;
  note?: string;
}

export interface SessionePasquale {
  id: string;
  amicoId: number;
  nome?: string;                    // etichetta libera (es. "Goldbet luglio")
  dataInizio: string;
  dataFine?: string;                // data fine prevista (YYYY-MM-DD)
  book?: string;                    // book principale della sessione
  depositante: DepositanteSessione;
  importoDeposito: number;
  depositi?: DepositoAggiuntivo[];  // depositi aggiuntivi oltre il primo
  puntate: Puntata[];
  aperta: boolean;
  chiusaIl?: string;
  saldato?: boolean;
  settlementFinale?: number;
  note?: string;
}

export interface BonusRicevuto {
  id: string;
  amicoId: number;
  data: string;
  book: string;
  tipo: TipoBonus;
  importo: number;
  note?: string;
}

export interface Prelievo {
  id: string;
  amicoId: number;
  book: string;
  importo: number;
  data: string;
  note?: string;
}


// ===== Giocate Personali =====
export type TipoGiocata = "SPORT" | "CASINO";

export interface GiocataPersonale {
  id: string;
  data: string;
  book: string;
  tipo: TipoGiocata;
  importo: number;
  esito: EsitoPuntata;
  vincita?: number;
  note?: string;
}

export interface AppData {
  capitaleIniziale: number;
  dataPartenza?: string;
  amici: Amico[];
  righeBook: RigaBook[];
  mesiProfit: MeseProfit[];
  todos: TodoItem[];
  spese: Spesa[];
  versamenti: Versamento[];
  prelievi: Prelievo[];
  sessioniPasquale: SessionePasquale[];
  bonusRicevuti: BonusRicevuto[];
  giocatePersonali: GiocataPersonale[];
  _v?: number;
}
