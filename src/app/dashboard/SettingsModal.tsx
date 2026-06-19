"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { toEuro, nextMeseYM, meseLabel, saldoTotale, saldoNetto } from "@/lib/calculations";
import { useConfirm } from "@/components/ConfirmDialog";
import { Icon, ICONS } from "@/components/Icon";

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { data, setCapitale, addVersamento, removeVersamento, chiudiMese, resetAll, replaceAll } = useStore();
  const confirm = useConfirm();

  const [capitale, setCapitaleVal] = useState(String(data.capitaleIniziale || ""));
  const [dataPartenza, setDataPartenza] = useState(data.dataPartenza || "");
  const [versImporto, setVersImporto] = useState("");
  const [versData, setVersData] = useState(new Date().toISOString().slice(0, 10));
  const [versNote, setVersNote] = useState("");
  const [capitaleFine, setCapitaleFine] = useState(() => {
    const tot = saldoNetto(data);
    return tot > 0 ? String(tot) : "";
  });
  const [meseNote, setMeseNote] = useState("");

  const prossimo = nextMeseYM(data.mesiProfit);
  const capitaleFineParsed = parseFloat(capitaleFine) || 0;
  const ultimoCapFine = data.mesiProfit.length
    ? data.mesiProfit[data.mesiProfit.length - 1].capitaleFine
    : data.capitaleIniziale;
  const profitoPreview = capitaleFineParsed - ultimoCapFine;

  const handleSalvaCapitale = () => {
    setCapitale(parseFloat(capitale) || 0, dataPartenza || undefined);
  };

  const handleAddVers = () => {
    const imp = parseFloat(versImporto);
    if (!imp || !versData) return;
    addVersamento(imp, versData, versNote || undefined);
    setVersImporto(""); setVersNote("");
  };

  const handleChiudiMese = async () => {
    if (!capitaleFineParsed) return;
    const ok = await confirm({
      title: `Chiudi ${meseLabel(prossimo)}?`,
      message: `Profitto: ${profitoPreview >= 0 ? "+" : ""}€${toEuro(profitoPreview)}`,
      confirmText: "Chiudi mese",
    });
    if (ok) {
      chiudiMese(capitaleFineParsed, meseNote || undefined);
      setCapitaleFine(""); setMeseNote("");
    }
  };

  const handleReset = async () => {
    const ok = await confirm({
      title: "Azzera tutto?",
      message: "Tutti i dati verranno eliminati. Questa azione è irreversibile.",
      danger: true,
      confirmText: "Azzera",
    });
    if (ok) { resetAll(); onClose(); }
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bonustime-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        const ok = await confirm({ title: "Ripristina backup?", message: "I dati attuali verranno sostituiti." });
        if (ok) replaceAll(parsed);
      } catch { alert("File non valido"); }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4"
      onClick={onClose}>
      <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-bord sticky top-0 bg-bg-card">
          <h2 className="font-bold text-base">Impostazioni</h2>
          <button onClick={onClose} className="text-txt-secondary hover:text-txt-primary">
            <Icon d={ICONS.close} size={18} />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Capitale base */}
          <section>
            <div className="label-tiny mb-3">Capitale base</div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <label className="text-xs text-txt-secondary mb-1 block">Importo €</label>
                <input className="input" type="number" placeholder="0" value={capitale}
                  onChange={(e) => setCapitaleVal(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-txt-secondary mb-1 block">Data inizio</label>
                <input className="input" type="date" value={dataPartenza}
                  onChange={(e) => setDataPartenza(e.target.value)} />
              </div>
            </div>
            <button className="btn btn-lime w-full" onClick={handleSalvaCapitale}>Salva</button>
          </section>

          {/* Versamenti */}
          <section>
            <div className="label-tiny mb-3">Versamenti aggiuntivi</div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <input className="input" type="number" placeholder="Importo €" value={versImporto}
                onChange={(e) => setVersImporto(e.target.value)} />
              <input className="input" type="date" value={versData}
                onChange={(e) => setVersData(e.target.value)} />
            </div>
            <input className="input mb-2" placeholder="Note (opzionale)" value={versNote}
              onChange={(e) => setVersNote(e.target.value)} />
            <button className="btn btn-ghost w-full mb-3" onClick={handleAddVers}>+ Aggiungi versamento</button>
            {data.versamenti.length > 0 && (
              <div className="space-y-1">
                {[...data.versamenti].reverse().map((v) => (
                  <div key={v.id} className="flex items-center justify-between py-1.5 border-b border-bord/50">
                    <div>
                      <span className="text-sm font-medium text-lime">+€{toEuro(v.importo)}</span>
                      <span className="text-xs text-txt-secondary ml-2">{v.data}</span>
                      {v.note && <span className="text-xs text-txt-secondary ml-1">· {v.note}</span>}
                    </div>
                    <button className="text-txt-secondary hover:text-acc-red p-1"
                      onClick={() => removeVersamento(v.id)}>
                      <Icon d={ICONS.trash} size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Chiudi mese */}
          <section>
            <div className="label-tiny mb-3">Chiudi mese · {meseLabel(prossimo)}</div>
            <input className="input mb-2" type="number" placeholder="Capitale fine mese €" value={capitaleFine}
              onChange={(e) => setCapitaleFine(e.target.value)} />
            {capitaleFineParsed > 0 && (
              <div className={`text-sm mb-2 ${profitoPreview >= 0 ? "text-lime" : "text-acc-red"}`}>
                Profitto: {profitoPreview >= 0 ? "+" : ""}€{toEuro(profitoPreview)}
              </div>
            )}
            <input className="input mb-2" placeholder="Note (opzionale)" value={meseNote}
              onChange={(e) => setMeseNote(e.target.value)} />
            <button className="btn btn-lime w-full" onClick={handleChiudiMese}
              disabled={!capitaleFineParsed}>
              Chiudi {meseLabel(prossimo)}
            </button>
          </section>

          {/* Backup */}
          <section id="backup">
            <div className="label-tiny mb-3">Backup</div>
            <div className="grid grid-cols-3 gap-2">
              <button className="btn btn-ghost" onClick={handleExport}>
                <Icon d={ICONS.backup} size={14} /> Scarica
              </button>
              <label className="btn btn-ghost cursor-pointer">
                <Icon d={ICONS.upload} size={14} /> Ripristina
                <input type="file" accept=".json" className="hidden" onChange={handleImport} />
              </label>
              <button className="btn btn-danger" onClick={handleReset}>Azzera</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
