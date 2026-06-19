"use client";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { saldoTotale, saldoPerId, toEuro } from "@/lib/calculations";
import { COLORI_STATO, BOOK_URLS } from "@/lib/constants";
import { Icon, ICONS } from "@/components/Icon";
import type { StatoBook } from "@/lib/types";

export default function BookPage() {
  const { data, cycleStato, setSaldo, addBook } = useStore();
  const [filterAmicoId, setFilterAmicoId] = useState<number | "all">("all");
  const [soloAttivi, setSoloAttivi] = useState(false);
  const [searchBook, setSearchBook] = useState("");

  const amici = data.amici;
  const righe = data.righeBook;
  const totale = saldoTotale(data);

  const amiciFiltrati = filterAmicoId === "all" ? amici : amici.filter((a) => a.id === filterAmicoId);

  const righeFiltrate = righe
    .filter((r) => !soloAttivi || amiciFiltrati.some((a) => r.celle[a.id]?.stato === "ATTIVO"))
    .filter((r) => !searchBook || r.book.toLowerCase().includes(searchBook.toLowerCase()));

  // Saldo totale per ID selezionato (book + wallet)
  const saldoIdSelezionato = (() => {
    if (filterAmicoId === "all") return null;
    const bookTot = saldoPerId(data, filterAmicoId);
    const amico = amici.find((a) => a.id === filterAmicoId);
    const walletTot = (amico?.walletExtra ?? []).reduce((s, w) => {
      const v = parseFloat(w.valore);
      return s + (Number.isFinite(v) && v > 0 ? v : 0);
    }, 0);
    return { bookTot, walletTot, totale: bookTot + walletTot };
  })();

  const handleAddBook = () => {
    const nome = prompt("Nome del bookmaker:")?.trim().toUpperCase();
    if (nome) addBook(nome);
  };

  // Conteggi per stats
  const countAperti = righe.filter((r) => amiciFiltrati.some((a) => r.celle[a.id]?.stato === "ATTIVO")).length;

  const buildStatId = (amicoId: number) => {
    const amico = amici.find((x) => x.id === amicoId)!;
    const c = { ATTIVO: 0, "DA APRIRE": 0, LIMITATO: 0, CHIUSO: 0, none: 0 };
    righe.forEach((r) => {
      const s = r.celle[amico.id]?.stato || "";
      if (s === "ATTIVO") c.ATTIVO++;
      else if (s === "DA APRIRE") c["DA APRIRE"]++;
      else if (s === "LIMITATO") c.LIMITATO++;
      else if (s === "CHIUSO") c.CHIUSO++;
      else c.none++;
    });
    return {
      nome: amico.nome.split(" ")[0],
      pills: [
        { label: "Aperti",    val: c["ATTIVO"],     color: "#22c55e" },
        { label: "Da aprire", val: c["DA APRIRE"],  color: "#F0B860" },
        { label: "Limitati",  val: c["LIMITATO"],   color: "#6CA9FF" },
        { label: "Bloccati",  val: c["CHIUSO"],     color: "#FF6E6E" },
      ],
    };
  };

  const statsIdSelezionato = filterAmicoId !== "all" ? buildStatId(filterAmicoId) : null;

  const statsGlobali = filterAmicoId === "all" ? amici.map((amico) => {
    const c = { ATTIVO: 0, "DA APRIRE": 0, LIMITATO: 0, CHIUSO: 0 };
    righe.forEach((r) => {
      const s = r.celle[amico.id]?.stato || "";
      if (s === "ATTIVO") c.ATTIVO++;
      else if (s === "DA APRIRE") c["DA APRIRE"]++;
      else if (s === "LIMITATO") c.LIMITATO++;
      else if (s === "CHIUSO") c.CHIUSO++;
    });
    return { id: amico.id, nome: amico.nome.split(" ").slice(0, 2).join(" "), ...c };
  }) : null;

  return (
    <AppShell>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-txt-primary">Book</h1>
          <div className="flex items-center gap-4 mt-1 flex-wrap">
            {saldoIdSelezionato ? (
              <>
                <span className="text-sm text-txt-secondary">
                  Book: <span className="text-txt-primary font-medium">€{toEuro(saldoIdSelezionato.bookTot)}</span>
                </span>
                {saldoIdSelezionato.walletTot > 0 && (
                  <span className="text-sm text-txt-secondary">
                    Wallet: <span className="text-lime font-medium">€{toEuro(saldoIdSelezionato.walletTot)}</span>
                  </span>
                )}
                <span className="text-sm text-txt-secondary">
                  Totale ID: <span className="text-lime font-semibold">€{toEuro(saldoIdSelezionato.totale)}</span>
                </span>
              </>
            ) : (
              <span className="text-sm text-txt-secondary">
                Saldo totale: <span className="text-txt-primary font-medium">€{toEuro(totale)}</span>
              </span>
            )}
          </div>
        </div>
        <button className="btn btn-ghost" onClick={handleAddBook}>
          <Icon d={ICONS.plus} size={14} /> Book custom
        </button>
      </div>

      {/* Search + filtro solo aperti */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <input
          type="text"
          placeholder="Cerca book…"
          value={searchBook}
          onChange={(e) => setSearchBook(e.target.value)}
          className="input max-w-xs"
        />
        <label className="flex items-center gap-1.5 text-xs text-txt-secondary cursor-pointer whitespace-nowrap">
          <input type="checkbox" checked={soloAttivi} onChange={(e) => setSoloAttivi(e.target.checked)} className="accent-lime" />
          Visualizza solo broker aperti
          {countAperti > 0 && <span className="ml-1 px-1.5 py-0.5 rounded bg-green-900/50 text-green-400 font-bold text-[10px]">{countAperti}</span>}
        </label>
      </div>

      {/* Tabs ID */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button
          onClick={() => setFilterAmicoId("all")}
          className={`px-3 py-1.5 rounded text-xs font-semibold border transition-colors ${
            filterAmicoId === "all"
              ? "bg-lime text-[#0F0F0F] border-lime"
              : "bg-bg-card border-bord text-txt-secondary hover:text-txt-primary hover:border-lime/40"
          }`}>
          Tutti
        </button>
        {amici.map((a) => {
          const attivi = righe.filter((r) => r.celle[a.id]?.stato === "ATTIVO").length;
          return (
            <button
              key={a.id}
              onClick={() => setFilterAmicoId(filterAmicoId === a.id ? "all" : a.id)}
              className={`px-3 py-1.5 rounded text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
                filterAmicoId === a.id
                  ? "bg-lime text-[#0F0F0F] border-lime"
                  : "bg-bg-card border-bord text-txt-secondary hover:text-txt-primary hover:border-lime/40"
              }`}>
              {a.nome.split(" ").slice(0, 2).join(" ")}
              {attivi > 0 && (
                <span className={`px-1 rounded text-[9px] font-bold ${(filterAmicoId as number) === a.id ? "bg-[#0F0F0F]/30 text-[#0F0F0F]" : "bg-green-900/50 text-green-400"}`}>
                  {attivi}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Stats per ID selezionato */}
      {statsIdSelezionato && (
        <div className="flex flex-wrap gap-2 mb-4 p-3 rounded-xl border border-bord bg-bg-card">
          <span className="text-xs text-txt-secondary font-semibold self-center mr-1">{statsIdSelezionato.nome}:</span>
          {statsIdSelezionato.pills.map((p) => p.val > 0 ? (
            <span key={p.label} className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold"
              style={{ background: p.color + "20", color: p.color, border: "1px solid " + p.color + "44" }}>
              <span className="font-bold">{p.val}</span> {p.label}
            </span>
          ) : null)}
        </div>
      )}

      {/* Resoconto globale tutti gli ID */}
      {statsGlobali && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          {statsGlobali.map((s) => (
            <div key={s.id} className="card p-3 cursor-pointer hover:border-lime/30 transition-colors"
              onClick={() => setFilterAmicoId(s.id)}>
              <div className="text-xs font-bold text-txt-primary mb-2">{s.nome}</div>
              <div className="grid grid-cols-2 gap-1">
                <span className="text-[10px] text-green-400"><span className="font-bold">{s.ATTIVO}</span> aperti</span>
                <span className="text-[10px] text-[#F0B860]"><span className="font-bold">{s["DA APRIRE"]}</span> da apr.</span>
                <span className="text-[10px] text-[#6CA9FF]"><span className="font-bold">{s.LIMITATO}</span> limit.</span>
                <span className="text-[10px] text-[#FF6E6E]"><span className="font-bold">{s.CHIUSO}</span> blocc.</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabella desktop */}
      <div className="hidden md:block">
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-bord">
                <th className="text-left px-4 py-3 label-tiny">Book</th>
                <th className="px-4 py-3 label-tiny">ID</th>
                <th className="text-right px-4 py-3 label-tiny">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {righeFiltrate.map((r) => {
                const url = BOOK_URLS[r.book];
                const saldoRiga = amiciFiltrati.reduce((a, id) => a + (r.celle[id.id]?.saldo || 0), 0);
                return (
                  <tr key={r.book} className="border-b border-bord/50 hover:bg-bg-hover/30">
                    <td className="px-4 py-3 w-48">
                      {url
                        ? <a href={url} target="_blank" rel="noreferrer" className="font-medium text-sm hover:text-lime">{r.book}</a>
                        : <span className="font-medium text-sm">{r.book}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 justify-center flex-wrap">
                        {amici.map((a) => {
                          const cella = r.celle[a.id] || { stato: "", saldo: 0 };
                          const stato = cella.stato as StatoBook;
                          const colore = COLORI_STATO[stato] || COLORI_STATO[""];
                          const primoNome = a.nome.split(" ")[0];
                          return (
                            <div key={a.id} className="relative group">
                              <button
                                onClick={() => cycleStato(r.book, a.id)}
                                className="px-2 py-0.5 rounded text-[11px] font-semibold border transition-all hover:scale-105 whitespace-nowrap"
                                style={{
                                  background: colore.dot + "22",
                                  color: colore.dot,
                                  borderColor: colore.dot + "55"
                                }}>
                                {primoNome}
                              </button>
                              <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50
                                opacity-0 group-hover:opacity-100 transition-opacity duration-150
                                bg-[#1a1c26] border border-bord rounded px-2 py-1 whitespace-nowrap text-[10px] shadow-lg">
                                <div className="font-semibold text-txt-primary">{a.nome}</div>
                                <div style={{ color: colore.dot }} className="font-bold">{colore.label}</div>
                                <div className="text-txt-secondary mt-0.5">click → cicla stato</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <SaldoCell
                        key={`${r.book}-${filterAmicoId}`}
                        righe={righeFiltrate}
                        book={r.book}
                        amici={amiciFiltrati}
                        setSaldo={setSaldo}
                        saldoRiga={saldoRiga}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Footer totali per amico */}
            <tfoot>
              <tr className="border-t border-bord bg-bg-hover/20">
                <td className="px-4 py-3 label-tiny">TOTALE BOOK</td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center gap-1.5 justify-center flex-wrap">
                    {amici.map((a) => {
                      const tot = righeFiltrate.reduce((s, r) => s + (r.celle[a.id]?.saldo || 0), 0);
                      return tot > 0 ? (
                        <span key={a.id} className="text-[11px] font-bold text-lime">
                          {a.nome.split(" ")[0]}: €{toEuro(tot)}
                        </span>
                      ) : null;
                    })}
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-sm font-bold text-lime">
                  €{toEuro(righeFiltrate.reduce((s, r) => s + amiciFiltrati.reduce((a, id) => a + (r.celle[id.id]?.saldo || 0), 0), 0))}
                </td>
              </tr>
              {/* Wallet per amico */}
              {amici.some((a) => (a.walletExtra ?? []).length > 0) && (
                <tr className="border-t border-bord/40">
                  <td className="px-4 py-2 label-tiny text-txt-secondary">WALLET</td>
                  <td className="px-4 py-2 text-center">
                    <div className="flex items-center gap-2 justify-center flex-wrap">
                      {amici.map((a) => {
                        const walletTot = (a.walletExtra ?? []).reduce((s, w) => {
                          const v = parseFloat(w.valore);
                          return s + (Number.isFinite(v) && v > 0 ? v : 0);
                        }, 0);
                        return walletTot > 0 ? (
                          <span key={a.id} className="text-[11px] text-acc-blue font-semibold">
                            {a.nome.split(" ")[0]}: €{toEuro(walletTot)}
                          </span>
                        ) : null;
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right text-sm font-semibold text-acc-blue">
                    €{toEuro(amici.reduce((s, a) => s + (a.walletExtra ?? []).reduce((w, x) => {
                      const v = parseFloat(x.valore); return w + (Number.isFinite(v) && v > 0 ? v : 0);
                    }, 0), 0))}
                  </td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {righeFiltrate.map((r) => {
          const url = BOOK_URLS[r.book];
          const saldoRiga = amiciFiltrati.reduce((a, id) => a + (r.celle[id.id]?.saldo || 0), 0);
          return (
            <div key={r.book} className="card p-4">
              <div className="flex items-center justify-between mb-3">
                {url
                  ? <a href={url} target="_blank" rel="noreferrer" className="font-semibold hover:text-lime">{r.book}</a>
                  : <span className="font-semibold">{r.book}</span>}
                <div className="text-right text-xs">
                  <div className="text-txt-primary font-medium">€{toEuro(saldoRiga)}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {amici.map((a) => {
                  const stato = (r.celle[a.id]?.stato || "") as StatoBook;
                  const colore = COLORI_STATO[stato] || COLORI_STATO[""];
                  return (
                    <button key={a.id} onClick={() => cycleStato(r.book, a.id)}
                      className="px-2 py-1 rounded text-[11px] font-semibold border transition-all"
                      style={{ background: colore.dot + "22", color: colore.dot, borderColor: colore.dot + "55" }}>
                      {a.nome.split(" ")[0]} {colore.label !== "—" && `· ${colore.label}`}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}

function SaldoCell({ righe, book, amici, setSaldo, saldoRiga }: {
  righe: any[]; book: string; amici: any[];
  setSaldo: (book: string, id: number, val: number) => void;
  saldoRiga: number;
}) {
  const r = righe.find((x) => x.book === book);
  if (!r || amici.length === 0) return <span className="text-txt-secondary text-sm">—</span>;

  if (amici.length === 1) {
    const a = amici[0];
    return (
      <input
        type="number"
        placeholder="Saldo"
        className="input w-24 text-right py-0.5 px-2 text-sm"
        defaultValue={r.celle[a.id]?.saldo || 0}
        onBlur={(e) => setSaldo(book, a.id, parseFloat(e.target.value) || 0)}
      />
    );
  }

  return (
    <span className={`text-sm font-medium ${saldoRiga > 0 ? "text-lime" : "text-txt-secondary"}`}>
      €{toEuro(saldoRiga)}
    </span>
  );
}
