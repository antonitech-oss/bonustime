import Decimal from "decimal.js";
import type { AppData } from "./types";
import { MESI } from "./constants";

export function toEuro(n: number | undefined | null): string {
  const v = n ?? 0;
  return new Decimal(v).toNumber().toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function meseLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const idx = parseInt(m, 10) - 1;
  return `${MESI[idx] ?? m} ${y}`;
}

// Ciclo contabile: 12 del mese → 11 del mese dopo.
// Se oggi >= 12 → siamo nel mese calendario corrente.
// Se oggi <  12 → siamo ancora nel mese calendario precedente.
export function meseCorrente(): string {
  const d = new Date();
  if (d.getDate() >= 12) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  } else {
    const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
  }
}

// Data inizio periodo per YYYY-MM → "YYYY-MM-12"
export function periodoInizio(ym: string): string {
  return `${ym}-12`;
}

// Data fine periodo (esclusa) → "YYYY-(MM+1)-12"
export function periodoFine(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const next = new Date(y, m, 12);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-12`;
}

export function nextMeseYM(mesiProfit: AppData["mesiProfit"]): string {
  const valid = mesiProfit.filter((m) => /^\d{4}-\d{2}$/.test(m.mese));
  if (!valid.length) return meseCorrente();
  const last = [...valid].sort((a, b) => a.mese.localeCompare(b.mese)).pop()!;
  const [y, m] = last.mese.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function saldoBloccatoTotale(data: AppData): number {
  let tot = new Decimal(0);
  for (const r of data.righeBook) {
    for (const id in r.celle) {
      tot = tot.plus(r.celle[id]?.bloccato || 0);
    }
  }
  return tot.toNumber();
}

export function saldoPrelevabile(data: AppData): number {
  return new Decimal(saldoTotale(data)).minus(saldoBloccatoTotale(data)).toNumber();
}

export function saldoWallet(data: AppData): number {
  let tot = new Decimal(0);
  for (const a of data.amici) {
    for (const w of a.walletExtra ?? []) {
      const v = parseFloat(w.valore);
      if (Number.isFinite(v) && v > 0) tot = tot.plus(v);
    }
  }
  return tot.toNumber();
}

export function saldoTotale(data: AppData): number {
  let tot = new Decimal(0);
  for (const r of data.righeBook) {
    for (const id in r.celle) {
      tot = tot.plus(r.celle[id]?.saldo || 0);
    }
  }
  tot = tot.plus(saldoWallet(data));
  return tot.toNumber();
}

export function saldoPerId(data: AppData, amicoId: number): number {
  let tot = new Decimal(0);
  for (const r of data.righeBook) {
    tot = tot.plus(r.celle[amicoId]?.saldo || 0);
  }
  return tot.toNumber();
}

export function bookAttiviPerId(data: AppData, amicoId: number): number {
  return data.righeBook.filter((r) => r.celle[amicoId]?.stato === "ATTIVO").length;
}

export function bookTotaliPerId(data: AppData, amicoId: number): number {
  return data.righeBook.filter((r) => r.celle[amicoId]?.stato !== "").length;
}

export function ciGiorni(scadenza?: string): number | null {
  if (!scadenza) return null;
  const sc = new Date(scadenza + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((sc.getTime() - today.getTime()) / 86400000);
}

// Spese totali all-time (no versamenti)
export function speseAllTime(data: AppData): number {
  return data.spese
    .filter((s) => s.tipo !== "VERSAMENTO")
    .reduce((acc, s) => new Decimal(acc).plus(s.importo).toNumber(), 0);
}

// Saldo netto = saldo book - spese all-time
export function saldoNetto(data: AppData): number {
  return new Decimal(saldoTotale(data)).minus(speseAllTime(data)).toNumber();
}

// Prelievi totali per un amico
export function prelieviPerId(data: AppData, amicoId: number): number {
  return (data.prelievi || [])
    .filter((p) => p.amicoId === amicoId)
    .reduce((acc, p) => new Decimal(acc).plus(p.importo).toNumber(), 0);
}

// Spese del mese — ciclo 12→12 (es. "2026-06" = spese dal 12 giu al 11 lug)
export function speseDelMese(data: AppData, ym: string): number {
  const inizio = periodoInizio(ym);
  const fine = periodoFine(ym);
  return data.spese
    .filter((s) => s.tipo !== "VERSAMENTO" && s.data >= inizio && s.data < fine)
    .reduce((acc, s) => new Decimal(acc).plus(s.importo).toNumber(), 0);
}

// Versamenti del mese
export function versamentiDelMese(data: AppData, ym: string): number {
  return data.versamenti
    .filter((v) => v.data.startsWith(ym))
    .reduce((acc, v) => new Decimal(acc).plus(v.importo).toNumber(), 0);
}

// Capitale attuale = iniziale + tutti i versamenti + profitti mesi chiusi
export function capitaleAllTime(data: AppData): number {
  const versTotal = data.versamenti.reduce((a, v) => new Decimal(a).plus(v.importo).toNumber(), 0);
  const profitTotal = data.mesiProfit.reduce((a, m) => new Decimal(a).plus(m.profitto).toNumber(), 0);
  return new Decimal(data.capitaleIniziale).plus(versTotal).plus(profitTotal).toNumber();
}

export function riepilogo(data: AppData) {
  const mesi = [...data.mesiProfit].sort((a, b) => a.mese.localeCompare(b.mese));
  const allTime = mesi.reduce((s, m) => new Decimal(s).plus(m.profitto).toNumber(), 0);
  const ultimo = mesi[mesi.length - 1];
  const penultimo = mesi[mesi.length - 2];
  return { mesi, allTime, ultimoMese: ultimo, mesePrec: penultimo };
}
