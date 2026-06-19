"use client";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import {
  riepilogo, meseLabel, toEuro,
  saldoTotale, saldoNetto, speseAllTime, speseDelMese, meseCorrente,
} from "@/lib/calculations";
import { Icon, ICONS } from "@/components/Icon";
import { SettingsModal } from "./SettingsModal";
import { TodoRow } from "@/components/TodoRow";
import { BackupRestore } from "./BackupRestore";

// ── Mini sparkline SVG ────────────────────────────────────────────────────────
function Spark({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data), min = Math.min(...data);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * 56;
    const y = 16 - ((v - min) / (max - min || 1)) * 14;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg width={60} height={18} style={{ overflow: "visible" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.8}
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, trend, spark }: {
  icon: string; label: string; value: string; sub?: string;
  trend?: { val: string; up: boolean };
  spark?: number[];
}) {
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid rgba(255,255,255,.08)",
      borderRadius: 12, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,.4)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>
        <span>{icon}</span><span>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", marginBottom: 6, fontFamily: "'Space Grotesk',sans-serif", letterSpacing: "-0.02em" }}>
        {value}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          {trend && (
            <span style={{ fontSize: 11, fontWeight: 500, color: trend.up ? "#10b981" : "#f87171" }}>
              {trend.up ? "▲" : "▼"} {trend.val}
            </span>
          )}
          {sub && <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{sub}</div>}
        </div>
        {spark && <Spark data={spark} color={trend?.up === false ? "#f87171" : "#10b981"} />}
      </div>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)", fontFamily: "'Space Grotesk',sans-serif", marginBottom: 12 }}>
      {children}
    </div>
  );
}

export default function Dashboard() {
  const { data, addTodo, updateTodo, toggleTodo, removeTodo, addVersamento, removeVersamento, setCapitale } = useStore();
  const [showSettings, setShowSettings] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const [todoTesto, setTodoTesto] = useState("");
  const [todoData, setTodoData]   = useState("");
  const [todoOra, setTodoOra]     = useState("");
  const [todoAmico, setTodoAmico] = useState<number | "">("");
  const [todoBook, setTodoBook]   = useState("");

  const r         = riepilogo(data);
  const today     = new Date().toISOString().slice(0, 10);
  const meseOggi  = meseCorrente();
  const totSaldo  = saldoTotale(data);
  const totNetto  = saldoNetto(data);
  const totSpese  = speseAllTime(data);

  const um        = r.ultimoMese;
  const profLordo = um?.profitto ?? 0;
  const speseMese = um?.spese ?? 0;
  const profNetto = profLordo - speseMese;

  const totVers       = (data.versamenti || []).reduce((s: number, v: any) => s + v.importo, 0);
  const capitaleTotale = data.capitaleIniziale + totVers;
  const pnlTot        = totNetto - capitaleTotale;
  const roiTot        = capitaleTotale > 0 ? (pnlTot / capitaleTotale) * 100 : 0;
  const mesiCount     = r.mesi.length;
  const allTimeNetto  = r.mesi.reduce((s, m) => s + m.profitto - (m.spese || 0), 0);
  const roiMedio      = mesiCount > 0 ? allTimeNetto / mesiCount : 0;

  const sparkProfitti = [...r.mesi]
    .sort((a, b) => a.mese.localeCompare(b.mese))
    .slice(-7)
    .map(m => m.profitto - (m.spese || 0));

  const speseRecenti = [...data.spese]
    .filter(s => s.tipo !== "VERSAMENTO")
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, 5);

  const todosPending = data.todos
    .filter(t => !t.fatto)
    .sort((a, b) => {
      if (a.data && b.data) return a.data.localeCompare(b.data);
      if (a.data) return -1;
      if (b.data) return 1;
      return a.creato.localeCompare(b.creato);
    });
  const todosDone = data.todos
    .filter(t => t.fatto)
    .sort((a, b) => b.creato.localeCompare(a.creato));

  const handleAddTodo = () => {
    if (!todoTesto.trim()) return;
    addTodo({ testo: todoTesto.trim(), data: todoData || undefined, ora: todoOra || undefined, amicoId: todoAmico !== "" ? todoAmico : undefined, book: todoBook || undefined });
    setTodoTesto(""); setTodoData(""); setTodoOra(""); setTodoAmico(""); setTodoBook("");
  };

  const card: React.CSSProperties = {
    background: "var(--surface)", border: "1px solid rgba(255,255,255,.08)",
    borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,.4)",
  };
  const divider: React.CSSProperties = { borderTop: "1px solid rgba(255,255,255,.06)" };

  return (
    <AppShell>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Space Grotesk',sans-serif", letterSpacing: "-0.02em", margin: 0 }}>Dashboard</h1>
          {um && (
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
              Ultimo mese chiuso: <span style={{ color: "var(--text)" }}>{meseLabel(um.mese)}</span>
            </div>
          )}
        </div>
        <button onClick={() => setShowSettings(true)} className="btn btn-ghost">
          <Icon d={ICONS.settings} size={15} /> Impostazioni
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ── ROW 1: 4 KPI CARDS ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))", gap: 12 }}>
          <KpiCard icon="💰" label="Saldo lordo"
            value={`€${toEuro(totSaldo)}`}
            sub="book + wallet + carte"
            spark={sparkProfitti.map((_, i) => totSaldo - (sparkProfitti.length - 1 - i) * 200)}
            trend={{ val: "attuale", up: totSaldo >= 0 }}
          />
          <KpiCard icon="📊" label="Saldo netto"
            value={`€${toEuro(totNetto)}`}
            sub="lordo − spese totali"
            spark={sparkProfitti}
            trend={{ val: totNetto >= 0 ? "positivo" : "negativo", up: totNetto >= 0 }}
          />
          <KpiCard icon="📈" label={`Profitto ${um ? meseLabel(um.mese) : "mese"}`}
            value={`${profNetto >= 0 ? "+" : ""}€${toEuro(profNetto)}`}
            sub="lordo − spese mese"
            spark={sparkProfitti}
            trend={{ val: `lordo +€${toEuro(profLordo)}`, up: profNetto >= 0 }}
          />
          <KpiCard icon="🎯" label="ROI totale"
            value={`${roiTot >= 0 ? "+" : ""}${roiTot.toFixed(1)}%`}
            sub={`su €${toEuro(capitaleTotale)} investiti`}
            spark={sparkProfitti}
            trend={{ val: `PnL ${pnlTot >= 0 ? "+" : ""}€${toEuro(pnlTot)}`, up: roiTot >= 0 }}
          />
        </div>

        {/* ── ROW 2: STATISTICHE SECONDARIE ── */}
        <div style={{ ...card, padding: 16 }}>
          <SectionLabel>Riepilogo all-time</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 16 }}>
            {[
              { label: "Spese totali",    val: `−€${toEuro(totSpese)}`,                    color: "var(--amber)" },
              { label: "Profitto medio",  val: `${roiMedio >= 0 ? "+" : ""}€${toEuro(roiMedio)}`, color: roiMedio >= 0 ? "#10b981" : "#f87171" },
              { label: "All-time netto",  val: `${allTimeNetto >= 0 ? "+" : ""}€${toEuro(allTimeNetto)}`, color: allTimeNetto >= 0 ? "#10b981" : "#f87171" },
              { label: "Mesi chiusi",     val: String(mesiCount),                           color: "var(--violet-l)" },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{s.label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: s.color, fontFamily: "'Space Grotesk',sans-serif" }}>{s.val}</div>
                {s.label === "Mesi chiusi" && <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>registrati</div>}
                {s.label === "Profitto medio" && <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>su {mesiCount} mes{mesiCount === 1 ? "e" : "i"}</div>}
              </div>
            ))}
          </div>
        </div>

        {/* ── ROW 3: CAPITALE + SALDO MESE ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {/* Capitale */}
          <CapitaleCard
            capitaleIniziale={data.capitaleIniziale}
            dataPartenza={data.dataPartenza}
            versamenti={data.versamenti}
            onSetCapitale={v => setCapitale(v, data.dataPartenza)}
            onAddVersamento={(imp, note) => addVersamento(imp, today, note)}
            onRemoveVersamento={removeVersamento}
          />
          {/* Profitto mese dettaglio */}
          <div style={{ ...card, padding: 16 }}>
            <SectionLabel>Profitto mese chiuso{um ? ` · ${meseLabel(um.mese)}` : ""}</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { label: "Profitto lordo", val: `${profLordo >= 0 ? "+" : ""}€${toEuro(profLordo)}`, color: profLordo >= 0 ? "var(--text)" : "#f87171", sub: "prima delle spese" },
                { label: "Spese del mese", val: `−€${toEuro(speseMese)}`, color: "var(--amber)", sub: "mese corrente" },
                { label: "Profitto netto",  val: `${profNetto >= 0 ? "+" : ""}€${toEuro(profNetto)}`, color: profNetto >= 0 ? "#10b981" : "#f87171", sub: "lordo − spese" },
              ].map(row => (
                <div key={row.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>{row.label}</div>
                    <div style={{ fontSize: 10, color: "var(--muted)", opacity: .7 }}>{row.sub}</div>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: row.color, fontFamily: "'Space Grotesk',sans-serif" }}>{row.val}</div>
                </div>
              ))}
              {um && (
                <div style={{ ...divider, paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>Base prossimo mese</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#38bdf8" }}>€{toEuro(um.capitaleFine)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── GRAFICO ── */}
        {r.mesi.length > 0 && <GraficoStorico mesi={r.mesi} />}

        {/* ── ROW 4: SPESE + TODO ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {/* Spese recenti */}
          <div style={{ ...card, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", ...divider, display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "none", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
              <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)" }}>Spese recenti</span>
              <a href="/spese" style={{ fontSize: 11, color: "var(--teal)", textDecoration: "none" }}>Vedi tutte →</a>
            </div>
            {speseRecenti.length === 0 ? (
              <div style={{ padding: "20px 16px", color: "var(--muted)", fontSize: 13, textAlign: "center" }}>Nessuna spesa</div>
            ) : speseRecenti.map((s, i) => {
              const amico = s.amicoId ? data.amici.find(a => a.id === s.amicoId) : null;
              return (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: i < speseRecenti.length - 1 ? "1px solid rgba(255,255,255,.04)" : "none" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.descrizione}</div>
                    <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{s.data}{amico && ` · ${amico.nome}`}</div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#f87171", flexShrink: 0 }}>−€{toEuro(s.importo)}</div>
                </div>
              );
            })}
          </div>

          {/* Da fare rapido */}
          <div style={{ ...card, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,.06)", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)" }}>Da fare</span>
              {todosPending.length > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 99, background: "rgba(45,212,191,.15)", color: "var(--teal)" }}>
                  {todosPending.length}
                </span>
              )}
            </div>
            <div style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,.06)" }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input className="input flex-1" style={{ fontSize: 12 }} placeholder="Nuovo task…"
                  value={todoTesto} onChange={e => setTodoTesto(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleAddTodo(); }} />
                <button className="btn btn-lime" style={{ padding: "0 12px" }} onClick={handleAddTodo}>
                  <Icon d={ICONS.plus} size={14} />
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <input className="input" type="date" style={{ fontSize: 11 }} value={todoData} onChange={e => setTodoData(e.target.value)} />
                <input className="input" type="time" style={{ fontSize: 11 }} value={todoOra} onChange={e => setTodoOra(e.target.value)} />
              </div>
            </div>
            <div style={{ maxHeight: 240, overflowY: "auto" }}>
              {todosPending.length === 0 ? (
                <div style={{ padding: "20px 16px", color: "var(--muted)", fontSize: 13, textAlign: "center" }}>Nessun task 🎉</div>
              ) : todosPending.map((t, i) => (
                <TodoRow key={t.id} t={t} amici={data.amici} righeBook={data.righeBook} today={today}
                  border={i < todosPending.length - 1} onToggle={() => toggleTodo(t.id)}
                  onRemove={() => removeTodo(t.id)} onUpdate={patch => updateTodo(t.id, patch)} />
              ))}
            </div>
            {todosDone.length > 0 && (
              <div style={{ borderTop: "1px solid rgba(255,255,255,.06)" }}>
                <button onClick={() => setShowDone(!showDone)}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "var(--muted)" }}>
                  <span>Completate ({todosDone.length})</span>
                  <Icon d={showDone ? ICONS.chevronU : ICONS.chevronD} size={12} />
                </button>
              </div>
            )}
          </div>
        </div>

        <BackupRestore />
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </AppShell>
  );
}

// ── GraficoStorico ─────────────────────────────────────────────────────────────
function GraficoStorico({ mesi }: { mesi: { mese: string; profitto: number; spese?: number; capitaleFine?: number }[] }) {
  const [tab, setTab] = useState<"3M"|"6M"|"12M"|"ALL">("ALL");
  const sorted   = [...mesi].sort((a, b) => a.mese.localeCompare(b.mese));
  const filtered = tab === "ALL" ? sorted : sorted.slice(-(tab === "3M" ? 3 : tab === "6M" ? 6 : 12));
  const vals   = filtered.map(m => m.profitto - (m.spese || 0));
  const labels = filtered.map(m => meseLabel(m.mese).split(" ")[0]);
  const min    = Math.min(0, ...vals), max = Math.max(1, ...vals), range = max - min || 1;
  const W = 700, H = 200, PAD = { t: 24, b: 32, l: 48, r: 16 };
  const iW = W - PAD.l - PAD.r, iH = H - PAD.t - PAD.b;
  const pts = vals.map((v, i) => ({
    x: PAD.l + (filtered.length <= 1 ? iW / 2 : (i / (filtered.length - 1)) * iW),
    y: PAD.t + iH - ((v - min) / range) * iH, v, label: labels[i],
  }));
  const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaD = pts.length > 0 ? `${pathD} L${pts[pts.length-1].x.toFixed(1)},${(PAD.t+iH).toFixed(1)} L${pts[0].x.toFixed(1)},${(PAD.t+iH).toFixed(1)} Z` : "";
  const zeroY = PAD.t + iH - ((0 - min) / range) * iH;
  const C = "#8b5cf6";

  return (
    <div style={{ background: "var(--surface)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,.4)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
        <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)" }}>Andamento profitti</span>
        <div style={{ display: "flex", gap: 4 }}>
          {(["3M","6M","12M","ALL"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer",
              border: tab === t ? "none" : "1px solid rgba(255,255,255,.08)",
              background: tab === t ? "var(--violet)" : "transparent",
              color: tab === t ? "#fff" : "var(--muted)",
            }}>{t}</button>
          ))}
        </div>
      </div>
      {filtered.length > 0 ? (
        <div style={{ padding: "8px 16px 12px" }}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 180 }}>
            <defs>
              <linearGradient id="vGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C} stopOpacity="0.25" />
                <stop offset="100%" stopColor={C} stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {[0,.25,.5,.75,1].map(t => {
              const y = PAD.t + t * iH, v = max - t * range;
              return (
                <g key={t}>
                  <line x1={PAD.l} y1={y} x2={W-PAD.r} y2={y} stroke="rgba(255,255,255,.06)" strokeWidth="1" />
                  <text x={PAD.l-6} y={y+3} fill="#64748b" fontSize="9" textAnchor="end">
                    {v >= 1000 ? `${(v/1000).toFixed(1)}k` : v.toFixed(0)}
                  </text>
                </g>
              );
            })}
            {min < 0 && <line x1={PAD.l} y1={zeroY} x2={W-PAD.r} y2={zeroY} stroke="rgba(255,255,255,.2)" strokeWidth="1" strokeDasharray="4,3" />}
            {areaD && <path d={areaD} fill="url(#vGrad)" />}
            {pathD && <path d={pathD} fill="none" stroke={C} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
            {pts.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r="5" fill={C} opacity=".3" />
                <circle cx={p.x} cy={p.y} r="3" fill={C} />
                <text x={p.x} y={H-4} fill="#64748b" fontSize="9" textAnchor="middle">{p.label}</text>
                {(i === 0 || i === pts.length-1 || pts.length <= 6) && (
                  <text x={p.x} y={p.y-8} fill={C} fontSize="9" textAnchor="middle" fontWeight="bold">
                    {p.v >= 0 ? "+" : ""}€{p.v >= 1000 ? (p.v/1000).toFixed(1)+"k" : p.v.toFixed(0)}
                  </text>
                )}
              </g>
            ))}
          </svg>
        </div>
      ) : (
        <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Nessun dato per il periodo</div>
      )}

      {/* Storico tabella */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,.06)" }}>
        <div style={{ padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)" }}>Storico mesi</span>
          <span style={{ fontSize: 10, color: "var(--muted)" }}>{mesi.length} chiusi</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                {["Mese","Lordo","Spese","Netto"].map(h => (
                  <th key={h} style={{ textAlign: h === "Mese" ? "left" : "right", padding: "6px 16px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...mesi].sort((a,b) => b.mese.localeCompare(a.mese)).map(m => {
                const netto = m.profitto - (m.spese || 0);
                return (
                  <tr key={m.mese} style={{ borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                    <td style={{ padding: "8px 16px", color: "var(--text)", fontWeight: 500, whiteSpace: "nowrap" }}>{meseLabel(m.mese)}</td>
                    <td style={{ padding: "8px 16px", textAlign: "right", color: "var(--muted)", whiteSpace: "nowrap" }}>+€{toEuro(m.profitto)}</td>
                    <td style={{ padding: "8px 16px", textAlign: "right", color: "var(--amber)", whiteSpace: "nowrap" }}>{(m.spese||0) > 0 ? `−€${toEuro(m.spese||0)}` : "—"}</td>
                    <td style={{ padding: "8px 16px", textAlign: "right", fontWeight: 600, color: netto >= 0 ? "#10b981" : "#f87171", whiteSpace: "nowrap" }}>{netto >= 0 ? "+" : ""}€{toEuro(netto)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── CapitaleCard ──────────────────────────────────────────────────────────────
function CapitaleCard({ capitaleIniziale, dataPartenza, versamenti, onSetCapitale, onAddVersamento, onRemoveVersamento }: {
  capitaleIniziale: number; dataPartenza?: string;
  versamenti: { id: string; importo: number; nota?: string; data?: string }[];
  onSetCapitale: (v: number) => void;
  onAddVersamento: (imp: number, note?: string) => void;
  onRemoveVersamento: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal]         = useState(String(capitaleIniziale));
  const [addingV, setAddingV] = useState(false);
  const [vImp, setVImp]       = useState("");
  const [vNote, setVNote]     = useState("");
  const totVers = versamenti.reduce((s, v) => s + v.importo, 0);
  const totale  = capitaleIniziale + totVers;
  const card: React.CSSProperties = { background: "var(--surface)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,.4)" };

  return (
    <div style={card}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)", fontFamily: "'Space Grotesk',sans-serif", marginBottom: 12 }}>
        Capitale · {dataPartenza ? new Date(dataPartenza + "T00:00:00").toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" }) : "—"}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>Capitale base</span>
          {editing ? (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input className="input" style={{ width: 96, textAlign: "right", padding: "2px 8px", fontSize: 12 }}
                type="number" value={val} onChange={e => setVal(e.target.value)} autoFocus />
              <button className="btn btn-lime" style={{ padding: "2px 8px", fontSize: 11 }}
                onClick={() => { onSetCapitale(parseFloat(val)||0); setEditing(false); }}>✓</button>
              <button style={{ fontSize: 11, color: "var(--muted)", background: "none", border: "none", cursor: "pointer" }}
                onClick={() => { setEditing(false); setVal(String(capitaleIniziale)); }}>✕</button>
            </div>
          ) : (
            <button style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", background: "none", border: "none", cursor: "pointer" }}
              onClick={() => setEditing(true)}>€{toEuro(capitaleIniziale)}</button>
          )}
        </div>
        {versamenti.map(v => (
          <div key={v.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>{v.nota || "Versamento"}{v.data ? ` · ${v.data}` : ""}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#38bdf8" }}>+€{toEuro(v.importo)}</span>
              <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }} onClick={() => onRemoveVersamento(v.id)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
            </div>
          </div>
        ))}
        {addingV ? (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input className="input" style={{ flex: 1, fontSize: 11, padding: "4px 8px" }} type="number" placeholder="€"
              value={vImp} onChange={e => setVImp(e.target.value)} autoFocus />
            <input className="input" style={{ width: 80, fontSize: 11, padding: "4px 8px" }} placeholder="Nota"
              value={vNote} onChange={e => setVNote(e.target.value)} />
            <button className="btn btn-lime" style={{ padding: "2px 8px", fontSize: 11 }} onClick={() => {
              const imp = parseFloat(vImp); if (imp > 0) onAddVersamento(imp, vNote||undefined);
              setAddingV(false); setVImp(""); setVNote("");
            }}>✓</button>
            <button style={{ fontSize: 11, color: "var(--muted)", background: "none", border: "none", cursor: "pointer" }}
              onClick={() => { setAddingV(false); }}>✕</button>
          </div>
        ) : (
          <button style={{ fontSize: 10, color: "var(--muted)", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
            onClick={() => setAddingV(true)}>+ aggiungi versamento</button>
        )}
      </div>
      <div style={{ borderTop: "1px solid rgba(255,255,255,.06)", paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500 }}>Totale liquidità</span>
        <span style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", fontFamily: "'Space Grotesk',sans-serif" }}>€{toEuro(totale)}</span>
      </div>
    </div>
  );
}
