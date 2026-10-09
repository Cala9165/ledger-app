/**
 * Prezzi di mercato delle case: quanto stanno salendo davvero.
 *
 * Serve a un campo solo: la «rivalutazione attesa», che altrimenti si tira a
 * indovinare. L'app NON decide al posto tuo: mostra il dato ufficiale e scegli tu.
 *
 * Il registro FONTI è aperto di proposito: aggiungere Immobiliare.it Insights,
 * OMI o un borsino vuol dire aggiungere una voce qui, non toccare l'interfaccia.
 */

export const MERCATO_CACHE_KEY = "ledger.mercato.v1";

/** L'indice ufficiale esce ogni trimestre: una volta al giorno è già generoso. */
export const MERCATO_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export type KvStorage = {
  getItem: (k: string) => string | null;
  setItem: (k: string, v: string) => void;
  removeItem: (k: string) => void;
};

/** Cosa misura una fonte. Serve a non confrontare mele con pere. */
export type Misura = "case" | "azioni";

export type Rilevazione = {
  /** Id della fonte che ha risposto. */
  fonte: string;
  misura: Misura;
  /** Variazione sull'anno, in frazione: 0,052 = +5,2 %. */
  variazioneAnnua: number;
  /** Periodo dell'ultimo dato, es. "2026-Q1". */
  periodo: string;
  /** Ambito geografico: qui sta il limite da dichiarare, non da nascondere. */
  ambito: string;
  /** Quando la fonte ha pubblicato, ISO. Vuoto se non lo dichiara. */
  aggiornatoAl: string;
  /** Viene dalla cache, non dalla rete. */
  daCache?: boolean;
};

export type EsitoMercato = { ok: true; dato: Rilevazione } | { ok: false; errore: string };

export type FonteMercato = {
  id: string;
  nome: string;
  misura: Misura;
  /** Cosa misura, in una riga, per chi legge. */
  descrizione: string;
  /** Ambito del dato: serve a non spacciare un indice nazionale per la tua via. */
  ambito: string;
  /** Con chiave o login non è utilizzabile da sola nel browser. */
  richiedeChiave: boolean;
  carica: (segnale?: AbortSignal) => Promise<EsitoMercato>;
};

// ---------------------------------------------------------------- Eurostat

export const EUROSTAT_HPI_URL =
  "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_hpi_q" +
  "?format=JSON&geo=IT&unit=I15_Q&purchase=TOTAL&lastTimePeriod=8";

/** Forma JSON-stat, ridotta a quel che serve. */
export type EurostatJson = {
  label?: string;
  updated?: string;
  dimension?: { time?: { category?: { index?: Record<string, number> } } };
  value?: Record<string, number>;
};

/**
 * Ultimo trimestre contro lo stesso trimestre dell'anno prima.
 * Anno su anno di proposito: trimestre su trimestre darebbe la stagionalità,
 * non la tendenza. Salta i trimestri senza valore invece di restituire NaN.
 */
export function variazioneAnnuaDaEurostat(
  j: EurostatJson,
): { variazioneAnnua: number; periodo: string } | null {
  const index = j?.dimension?.time?.category?.index;
  const value = j?.value;
  if (!index || !value) return null;

  const periodi = Object.keys(index).sort((a, b) => index[a] - index[b]);
  // Serve almeno un anno di storia: quattro trimestri prima più quello corrente.
  if (periodi.length < 5) return null;

  for (let i = periodi.length - 1; i >= 4; i--) {
    const ora = value[index[periodi[i]]];
    const annoPrima = value[index[periodi[i - 4]]];
    if (!Number.isFinite(ora) || !Number.isFinite(annoPrima) || annoPrima <= 0) continue;
    return { variazioneAnnua: ora / annoPrima - 1, periodo: periodi[i] };
  }
  return null;
}

export function erroreMercato(stato: number | "rete" | "vuoto"): string {
  if (stato === "rete") return "Nessuna risposta: sei offline o la fonte non risponde.";
  if (stato === "vuoto") return "La fonte ha risposto ma senza dati utilizzabili.";
  if (stato === 429) return "Troppe richieste alla fonte: riprova tra qualche minuto.";
  if (stato >= 500) return "La fonte ha un problema suo: riprova più tardi.";
  return `La fonte ha rifiutato la richiesta (codice ${stato}).`;
}

export const EUROSTAT: FonteMercato = {
  id: "eurostat",
  nome: "Eurostat",
  misura: "case",
  descrizione: "Indice ufficiale dei prezzi delle abitazioni, trimestrale",
  ambito: "Italia",
  richiedeChiave: false,
  carica: async (segnale) => {
    let r: Response;
    try {
      r = await fetch(EUROSTAT_HPI_URL, { signal: segnale });
    } catch {
      return { ok: false, errore: erroreMercato("rete") };
    }
    if (!r.ok) return { ok: false, errore: erroreMercato(r.status) };
    let j: EurostatJson;
    try {
      j = (await r.json()) as EurostatJson;
    } catch {
      return { ok: false, errore: erroreMercato("vuoto") };
    }
    const v = variazioneAnnuaDaEurostat(j);
    if (!v) return { ok: false, errore: erroreMercato("vuoto") };
    return {
      ok: true,
      dato: {
        fonte: EUROSTAT.id,
        misura: EUROSTAT.misura,
        variazioneAnnua: v.variazioneAnnua,
        periodo: v.periodo,
        ambito: EUROSTAT.ambito,
        aggiornatoAl: typeof j.updated === "string" ? j.updated : "",
      },
    };
  },
};

// ----------------------------------------------------------- Alpha Vantage

export const AV_KEY_STORAGE = "ledger.alphaVantageKey";
export const AV_URL_BASE = "https://www.alphavantage.co/query";
/** Dove si chiede la chiave gratuita, da mostrare all'utente. */
export const AV_REGISTRAZIONE = "https://www.alphavantage.co/support/#api-key";

export function leggiChiaveAv(storage?: KvStorage | null): string {
  const s = storage ?? (typeof localStorage !== "undefined" ? localStorage : null);
  if (!s) return "";
  try {
    return (s.getItem(AV_KEY_STORAGE) ?? "").trim();
  } catch {
    return "";
  }
}

export function scriviChiaveAv(chiave: string, storage?: KvStorage | null): void {
  const s = storage ?? (typeof localStorage !== "undefined" ? localStorage : null);
  if (!s) return;
  try {
    const pulita = chiave.trim();
    if (pulita) s.setItem(AV_KEY_STORAGE, pulita);
    else s.removeItem(AV_KEY_STORAGE);
  } catch {
    // Niente spazio: la chiave è facoltativa, non vale rompere il resto.
  }
}

export function mascheraChiave(chiave: string): string {
  const c = chiave.trim();
  if (!c) return "";
  if (c.length <= 4) return "····";
  return `····${c.slice(-4)}`;
}

export type AvMensileJson = {
  "Monthly Time Series"?: Record<string, Record<string, string>>;
  Note?: string;
  Information?: string;
  "Error Message"?: string;
};

/**
 * Ultimo mese contro lo stesso mese dell'anno prima, sulla chiusura.
 * Stesso criterio usato per le case, così i due numeri sono confrontabili.
 */
export function variazioneAnnuaDaAlphaVantage(
  j: AvMensileJson,
): { variazioneAnnua: number; periodo: string } | null {
  const serie = j?.["Monthly Time Series"];
  if (!serie) return null;
  const date = Object.keys(serie).sort();
  if (date.length < 13) return null;
  const chiusura = (d: string) => {
    const riga = serie[d] || {};
    const k = Object.keys(riga).find((x) => /close/i.test(x) && !/adjusted/i.test(x));
    const n = k ? Number(riga[k]) : Number.NaN;
    return Number.isFinite(n) ? n : Number.NaN;
  };
  for (let i = date.length - 1; i >= 12; i--) {
    const ora = chiusura(date[i]);
    const annoPrima = chiusura(date[i - 12]);
    if (!Number.isFinite(ora) || !Number.isFinite(annoPrima) || annoPrima <= 0) continue;
    return { variazioneAnnua: ora / annoPrima - 1, periodo: date[i].slice(0, 7) };
  }
  return null;
}

export const SP500: FonteMercato = {
  id: "alphavantage-sp500",
  nome: "Alpha Vantage",
  misura: "azioni",
  descrizione: "S&P 500 (ETF SPY), variazione sull'ultimo anno",
  ambito: "Stati Uniti",
  richiedeChiave: true,
  carica: async (segnale) => {
    const chiave = leggiChiaveAv();
    if (!chiave) return { ok: false, errore: "Serve la chiave gratuita Alpha Vantage." };
    const url = `${AV_URL_BASE}?function=TIME_SERIES_MONTHLY&symbol=SPY&apikey=${encodeURIComponent(chiave)}`;
    let r: Response;
    try {
      r = await fetch(url, { signal: segnale });
    } catch {
      return { ok: false, errore: erroreMercato("rete") };
    }
    if (!r.ok) return { ok: false, errore: erroreMercato(r.status) };
    let j: AvMensileJson;
    try {
      j = (await r.json()) as AvMensileJson;
    } catch {
      return { ok: false, errore: erroreMercato("vuoto") };
    }
    // Alpha Vantage risponde 200 anche quando rifiuta: il motivo sta nel corpo.
    if (j["Error Message"]) return { ok: false, errore: "Chiave o simbolo non validi." };
    if (j.Note || j.Information) {
      return { ok: false, errore: "Limite di richieste raggiunto: riprova tra qualche minuto." };
    }
    const v = variazioneAnnuaDaAlphaVantage(j);
    if (!v) return { ok: false, errore: erroreMercato("vuoto") };
    return {
      ok: true,
      dato: {
        fonte: SP500.id,
        misura: SP500.misura,
        variazioneAnnua: v.variazioneAnnua,
        periodo: v.periodo,
        ambito: SP500.ambito,
        aggiornatoAl: "",
      },
    };
  },
};

/**
 * Registro delle fonti, in ordine di preferenza.
 *
 * Da aggiungere qui quando ci sarà un server capace di custodire una chiave:
 * — Immobiliare.it Insights: API commerciale per agenzie, serve un contratto.
 * — OMI (Agenzia delle Entrate): €/m² per zona, gratis ma dietro login
 *   Fisconline/Entratel e aggiornato ogni sei mesi.
 * Entrambe hanno richiedeChiave true e restano fuori dalla cascata finché
 * l'app gira solo nel browser: una chiave nel browser è una chiave pubblica.
 */
export const FONTI: FonteMercato[] = [EUROSTAT, SP500];

/** Una fonte con chiave entra nella cascata solo se la chiave c'è davvero. */
export function fonteDisponibile(f: FonteMercato, storage?: KvStorage | null): boolean {
  if (!f.richiedeChiave) return true;
  if (f.id === SP500.id) return Boolean(leggiChiaveAv(storage));
  return false;
}

export function fontiUtilizzabili(
  misura?: Misura,
  fonti: readonly FonteMercato[] = FONTI,
  storage?: KvStorage | null,
): FonteMercato[] {
  return fonti.filter(
    (f) => (misura === undefined || f.misura === misura) && fonteDisponibile(f, storage),
  );
}

/** Fonti che saprebbero rispondere ma a cui manca la chiave: servono a spiegarlo all'utente. */
export function fontiSenzaChiave(
  misura?: Misura,
  fonti: readonly FonteMercato[] = FONTI,
  storage?: KvStorage | null,
): FonteMercato[] {
  return fonti.filter(
    (f) => (misura === undefined || f.misura === misura) && !fonteDisponibile(f, storage),
  );
}

// ------------------------------------------------------------------- cache

/** Una cache per misura: case e azioni non devono pestarsi i piedi. */
function chiaveCache(misura: Misura): string {
  return `${MERCATO_CACHE_KEY}.${misura}`;
}

export function leggiCache(
  misura: Misura,
  storage?: KvStorage | null,
  ora = Date.now(),
): Rilevazione | null {
  const s = storage ?? (typeof localStorage !== "undefined" ? localStorage : null);
  if (!s) return null;
  try {
    const raw = s.getItem(chiaveCache(misura));
    if (!raw) return null;
    const p = JSON.parse(raw) as { at?: number; dato?: Rilevazione };
    if (!p || typeof p.at !== "number" || !p.dato) return null;
    if (ora - p.at > MERCATO_CACHE_TTL_MS) return null;
    if (!Number.isFinite(p.dato.variazioneAnnua)) return null;
    if (p.dato.misura !== misura) return null;
    return { ...p.dato, daCache: true };
  } catch {
    return null;
  }
}

export function scriviCache(dato: Rilevazione, storage?: KvStorage | null, ora = Date.now()): void {
  const s = storage ?? (typeof localStorage !== "undefined" ? localStorage : null);
  if (!s) return;
  try {
    s.setItem(chiaveCache(dato.misura), JSON.stringify({ at: ora, dato }));
  } catch {
    // Spazio esaurito: questo dato è un di più, non vale rompere il salvataggio vero.
  }
}

/**
 * Prova le fonti in ordine e restituisce la prima che risponde.
 * Con la cache ancora fresca non tocca la rete.
 */
export async function caricaMercato(
  misura: Misura,
  opts?: {
    fonti?: readonly FonteMercato[];
    storage?: KvStorage | null;
    segnale?: AbortSignal;
    forza?: boolean;
    ora?: number;
  },
): Promise<EsitoMercato> {
  const ora = opts?.ora ?? Date.now();
  const storage = opts?.storage;
  if (!opts?.forza) {
    const c = leggiCache(misura, storage, ora);
    if (c) return { ok: true, dato: c };
  }
  const fonti = fontiUtilizzabili(misura, opts?.fonti ?? FONTI, storage);
  if (!fonti.length) {
    const senza = fontiSenzaChiave(misura, opts?.fonti ?? FONTI, storage);
    return {
      ok: false,
      errore: senza.length
        ? `Serve la chiave gratuita ${senza[0].nome}.`
        : "Nessuna fonte disponibile per questo dato.",
    };
  }
  let ultimo = "";
  for (const f of fonti) {
    const esito = await f.carica(opts?.segnale);
    if (esito.ok) {
      scriviCache(esito.dato, storage, ora);
      return esito;
    }
    ultimo = esito.errore;
  }
  // Rete muta: meglio un dato vecchio, dichiarato come tale, che nessun dato.
  const vecchio = leggiCache(misura, storage, ora);
  if (vecchio) return { ok: true, dato: vecchio };
  return { ok: false, errore: ultimo || erroreMercato("rete") };
}

export function nomeFonte(id: string, fonti: readonly FonteMercato[] = FONTI): string {
  return fonti.find((f) => f.id === id)?.nome ?? id;
}
