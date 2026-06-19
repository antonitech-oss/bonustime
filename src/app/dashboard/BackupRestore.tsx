"use client";
import { useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { sanitizeAppData } from "@/lib/initialData";

export function BackupRestore() {
  const data = useStore((s) => s.data);
  const replaceAll = useStore((s) => s.replaceAll);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function download() {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `bonustime-backup-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg({ ok: true, text: "Backup scaricato." });
    setTimeout(() => setMsg(null), 3000);
  }

  function exportCSV(type: "spese" | "book" | "sessioni") {
    let rows: string[] = [];
    if (type === "spese") {
      rows = ["Data,Descrizione,Importo,Tipo,Note",
        ...data.spese.map((s) => `${s.data},"${s.descrizione}",${s.importo},${s.tipo},"${s.note ?? ""}"`),
      ];
    } else if (type === "book") {
      const amiciH = data.amici.map((a) => a.nome).join(",");
      rows = [`Book,${amiciH}`,
        ...data.righeBook.map((r) =>
          `${r.book},${data.amici.map((a) => r.celle[a.id]?.saldo ?? 0).join(",")}`
        ),
      ];
    } else if (type === "sessioni") {
      rows = ["Amico,Nome,Book,Deposito,Aperta,Settlement,Chiusa il",
        ...data.sessioniPasquale.map((s) => {
          const amico = data.amici.find((a) => a.id === s.amicoId)?.nome ?? s.amicoId;
          return `"${amico}","${s.nome ?? ""}","${s.book ?? ""}",${s.importoDeposito},${s.aperta},${s.settlementFinale ?? ""},${s.chiusaIl?.slice(0,10) ?? ""}`;
        }),
      ];
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bonustime-${type}-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg({ ok: true, text: `Export ${type} scaricato.` });
    setTimeout(() => setMsg(null), 3000);
  }

  function autoBackup() {
    try {
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bonustime-AUTOBACKUP-${new Date().toISOString().slice(0,19).replace(/:/g,"-")}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw = JSON.parse(ev.target?.result as string);
        const clean = sanitizeAppData(raw);
        replaceAll(clean);
        setMsg({ ok: true, text: `Ripristino ok — ${clean.amici.length} amici, ${clean.sessioniPasquale.length} sessioni.` });
      } catch {
        setMsg({ ok: false, text: "File non valido." });
      }
      if (inputRef.current) inputRef.current.value = "";
    };
    reader.readAsText(file);
  }

  return (
    <div id="backup" className="rounded-xl bg-[#0f1725] border border-[#1e2840] p-5 space-y-4">
      <h2 className="text-sm font-bold text-white">Backup & Ripristino</h2>
      <p className="text-xs text-gray-500">
        Dati salvati nel browser (localStorage). Scarica il backup per trasferirli su un altro dispositivo o tenerli al sicuro.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          onClick={download}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-600 text-white text-sm font-semibold transition-colors"
        >
          Scarica backup (.json)
        </button>
        <label className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1e2840] hover:bg-[#2a3a50] text-gray-300 text-sm font-semibold cursor-pointer transition-colors">
          Carica backup
          <input
            ref={inputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleFile}
          />
        </label>
      </div>
      <div className="border-t border-[#1e2840] pt-3">
        <p className="text-xs text-gray-600 mb-2 uppercase tracking-widest">Export CSV</p>
        <div className="flex flex-wrap gap-2">
          {(["spese","book","sessioni"] as const).map((t) => (
            <button key={t} onClick={() => exportCSV(t)}
              className="px-3 py-1.5 rounded text-xs font-semibold bg-[#1e2840] hover:bg-[#2a3a50] text-gray-300 transition-colors capitalize">
              {t}.csv
            </button>
          ))}
        </div>
      </div>
      {msg ? (
        <p className={"text-xs font-semibold " + (msg.ok ? "text-green-400" : "text-red-400")}>
          {msg.ok ? "ok " : "err "}{msg.text}
        </p>
      ) : null}
    </div>
  );
}
