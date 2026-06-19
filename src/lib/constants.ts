import type { StatoBook } from "./types";

export const SCHEMA_VERSION = 3;
export const MIN_VERSION = 3;

export const CYCLE_STATI: StatoBook[] = ["", "DA APRIRE", "ATTIVO", "LIMITATO", "CHIUSO"];

export const COLORI_STATO: Record<string, { bg: string; txt: string; dot: string; label: string }> = {
  "":          { bg: "bg-[#2a2a2a]",      txt: "text-[#9ca3af]",     dot: "#6b7280", label: "—"          },
  "DA APRIRE": { bg: "bg-acc-yellow/15",  txt: "text-acc-yellow",    dot: "#F0B860", label: "Da aprire"  },
  "ATTIVO":    { bg: "bg-green-500/15",   txt: "text-green-400",     dot: "#22c55e", label: "Aperto"     },
  "LIMITATO":  { bg: "bg-acc-blue/15",    txt: "text-acc-blue",      dot: "#6CA9FF", label: "Limitato"   },
  "CHIUSO":    { bg: "bg-acc-red/15",     txt: "text-acc-red",       dot: "#FF6E6E", label: "Bloccato"   },
};

export const MESI = [
  "Gen", "Feb", "Mar", "Apr", "Mag", "Giu",
  "Lug", "Ago", "Set", "Ott", "Nov", "Dic",
];

export const BOOK_ADM = [
  // --- esistenti (ordine originale) ---
  "SISAL",
  "POKERSTARS",
  "SNAI",
  "GOLDBET",
  "LOTTOMATICA",
  "ADMIRAL",
  "BETFLAG",
  "QUIGIOCO",
  "WILLIAM HILL",
  "MYLOTTERIES",
  // --- nuovi ---
  "BET365",
  "BETCLIC",
  "BETFAIR",
  "BETN1",
  "BETWAY",
  "BETSSON",
  "BGAME",
  "CASINOMANIA",
  "CASINOVENEZIA",
  "DAZNBET",
  "DOMUSBET",
  "EPLAY24",
  "EUROBET",
  "FANTASYTEAM",
  "GENIUSWIN",
  "IN GIOCO",
  "LEOVEGAS",
  "MARATHON BET",
  "NETWIN",
  "NOVIBET",
  "PLANETWIN 365",
  "SPORTITALIABET",
  "SPORTIUM",
  "STAKE",
  "STANLEY BET",
  "STARCASINO",
  "STARVEGAS",
  "STARYES",
  "VINCITU",
  "WINBET",
  "ZONAGIOCO",
];

export const BOOK_URLS: Record<string, string> = {
  "SISAL":           "https://www.sisal.it",
  "POKERSTARS":      "https://www.pokerstars.it",
  "SNAI":            "https://www.snai.it",
  "GOLDBET":         "https://www.goldbet.it",
  "LOTTOMATICA":     "https://www.lottomatica.it",
  "ADMIRAL":         "https://www.admiralbet.it",
  "BETFLAG":         "https://www.betflag.it",
  "QUIGIOCO":        "https://www.quigioco.it",
  "WILLIAM HILL":    "https://www.williamhill.it",
  "MYLOTTERIES":     "https://www.mylotteries.it",
  "BET365":          "https://www.bet365.it",
  "BETCLIC":         "https://www.betclic.it",
  "BETFAIR":         "https://www.betfair.it",
  "BETN1":           "https://www.betn1.it",
  "BETWAY":          "https://www.betway.it",
  "BETSSON":         "https://www.betsson.it",
  "BGAME":           "https://www.bgame.it",
  "CASINOMANIA":     "https://www.casinomania.it",
  "CASINOVENEZIA":   "https://www.casinovenezia.it",
  "DAZNBET":         "https://www.daznbet.it",
  "DOMUSBET":        "https://www.domusbet.it",
  "EPLAY24":         "https://www.eplay24.it",
  "EUROBET":         "https://www.eurobet.it",
  "FANTASYTEAM":     "https://www.fantasyteam.it",
  "GENIUSWIN":       "https://www.geniuswin.it",
  "IN GIOCO":        "https://www.ingioco.it",
  "LEOVEGAS":        "https://www.leovegas.it",
  "MARATHON BET":    "https://www.marathonbet.it",
  "NETWIN":          "https://www.netwin.it",
  "NOVIBET":         "https://www.novibet.it",
  "PLANETWIN 365":   "https://www.planetwin365.it",
  "SPORTITALIABET":  "https://www.sportitaliabet.it",
  "SPORTIUM":        "https://www.sportium.it",
  "STAKE":           "https://stake.com",
  "STANLEY BET":     "https://www.stanleybet.it",
  "STARCASINO":      "https://www.starcasino.it",
  "STARVEGAS":       "https://www.starvegas.it",
  "STARYES":         "https://www.staryes.it",
  "VINCITU":         "https://www.vincitu.it",
  "WINBET":          "https://www.winbet.it",
  "ZONAGIOCO":       "https://www.zonagioco.it",
};

export function getAdminEmail(): string {
  return (process.env.NEXT_PUBLIC_ADMIN_EMAIL || "").toLowerCase();
}
