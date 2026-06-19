(function() {
  const raw = JSON.parse(localStorage.getItem("bonustime-v3") || "{}");
  const data = raw?.state?.data;
  if (!data) { console.error("Store non trovato"); return; }

  const antonio = data.amici.find(a => a.nome.toUpperCase().includes("ANTONIO"));
  if (!antonio) { console.error("Amico Antonio non trovato"); return; }

  const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

  if (!data.sessioniPasquale) data.sessioniPasquale = [];
  if (!data.bonusRicevuti) data.bonusRicevuti = [];

  const sessionId = uid();
  data.sessioniPasquale.push({
    id: sessionId,
    amicoId: antonio.id,
    dataInizio: "2026-06-05",
    depositante: "MIO",
    importoDeposito: 500,
    aperta: true,
    puntate: [
      { id: uid(), data: "2026-06-05", importo: 100, tipo: "BONUS",    esito: "PERSA", note: "Multipla(4)" },
      { id: uid(), data: "2026-06-06", importo: 90,  tipo: "NORMALE",  esito: "VINTA", vincita: 103.50, note: "Singola" },
      { id: uid(), data: "2026-06-09", importo: 21,  tipo: "BONUS",    esito: "VINTA", vincita: 115.20, note: "Multipla(4)" },
      { id: uid(), data: "2026-06-09", importo: 50,  tipo: "NORMALE",  esito: "PERSA", note: "Multipla(3)" },
    ]
  });

  data.bonusRicevuti.push({
    id: uid(),
    amicoId: antonio.id,
    data: "2026-06-05",
    book: "",
    tipo: "SPORT",
    importo: 100,
  });

  raw.state.data = data;
  localStorage.setItem("bonustime-v3", JSON.stringify(raw));
  console.log("✅ Dati inseriti per", antonio.nome, "— ricarica la pagina (F5)");
})();
