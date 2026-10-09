/**
 * Dati di prova per scripts/stress.mts: una famiglia inventata, numeri tondi.
 * Niente qui viene da un salvataggio vero: il piano del mutuo è generato con la
 * formula dell'ammortamento alla francese, le spese sono cifre di comodo.
 */
import type { Movimento } from "../src/lib/banca.ts";
import type { ProfiloPrivato } from "../src/lib/profilo-privato.ts";
import type { RataPiano } from "../src/lib/piano.ts";
import type { Cedolino, Fissa, Immobile, Patrimonio, QuadraState } from "../src/lib/quadra.ts";

const r2 = (x: number) => Math.round(x * 100) / 100;
const pad2 = (n: number) => String(n).padStart(2, "0");

/** Rata costante: K · t / (1 − (1 + t)^−n), t = TAN / 12. Con TAN 0 è K / n. */
export function rataFrancese(capitale: number, tanAnno: number, nRate: number): number {
  const t = tanAnno / 12;
  if (t === 0) return capitale / nRate;
  return (capitale * t) / (1 - (1 + t) ** -nRate);
}

export type OpzioniPiano = {
  erogato: number;
  tan: number;
  nRate: number;
  /** AAAA-MM della prima rata. */
  primaRata: string;
  /** Rate pagate fino a questo mese compreso (AAAA-MM). */
  pagateFino: string;
  /** Mese senza riga nel piano (la banca non l'ha riportata). */
  buco?: string;
  /** Mese in cui l'addebito include qualche euro di spese oltre a capitale + interessi. */
  meseSpese?: string;
  spese?: number;
};

/** Piano alla francese, riga per riga, arrotondato al centesimo come fanno le banche. */
export function pianoFrancese(o: OpzioniPiano): RataPiano[] {
  const t = o.tan / 12;
  const rata = r2(rataFrancese(o.erogato, o.tan, o.nRate));
  let [y, m] = o.primaRata.split("-").map(Number);
  let k = o.erogato;
  const out: RataPiano[] = [];
  for (let n = 1; n <= o.nRate; n++) {
    const mese = `${y}-${pad2(m)}`;
    const i = r2(k * t);
    const c = n === o.nRate ? k : r2(rata - i);
    k = r2(k - c);
    const extra = mese === o.meseSpese ? (o.spese ?? 0) : 0;
    if (mese !== o.buco) {
      out.push({ n, d: `${mese}-01`, c, i, r: r2(c + i + extra), k, p: mese <= o.pagateFino });
    }
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

// --- Mutuo della casa demo: 100.000 € al 2,4 % in 20 anni, dal gennaio 2020 ---
export const DEMO_EROGATO = 100_000;
export const DEMO_TAN = 0.024;
export const DEMO_N_RATE = 240;
export const DEMO_PRIMA_RATA = "2020-01";
export const DEMO_PAGATE_FINO = "2026-09";
/** Mese senza riga: il piano ha un buco lì. */
export const DEMO_MESE_BUCO = "2021-03";
/** In questo mese l'addebito è capitale + interessi + DEMO_SPESE_RATA. */
export const DEMO_MESE_SPESE = "2026-09";
export const DEMO_SPESE_RATA = 2.5;

export const DEMO_RATA_MUTUO = r2(rataFrancese(DEMO_EROGATO, DEMO_TAN, DEMO_N_RATE));

export const DEMO_PIANO_MUTUO: RataPiano[] = pianoFrancese({
  erogato: DEMO_EROGATO,
  tan: DEMO_TAN,
  nRate: DEMO_N_RATE,
  primaRata: DEMO_PRIMA_RATA,
  pagateFino: DEMO_PAGATE_FINO,
  buco: DEMO_MESE_BUCO,
  meseSpese: DEMO_MESE_SPESE,
  spese: DEMO_SPESE_RATA,
});

// --- Prestito auto: 12.000 € al 6 % in 4 anni, dal gennaio 2024 ---
export const DEMO_PRESTITO_EROGATO = 12_000;
export const DEMO_PRESTITO_TAN = 0.06;
export const DEMO_RATA_PRESTITO = r2(rataFrancese(DEMO_PRESTITO_EROGATO, DEMO_PRESTITO_TAN, 48));
export const DEMO_PIANO_PRESTITO: RataPiano[] = pianoFrancese({
  erogato: DEMO_PRESTITO_EROGATO,
  tan: DEMO_PRESTITO_TAN,
  nRate: 48,
  primaRata: "2024-01",
  pagateFino: DEMO_PAGATE_FINO,
});

const residuo = (piano: RataPiano[]) => piano.filter((r) => r.p).at(-1)?.k ?? 0;
/** Debito residuo dopo l'ultima rata pagata. */
export const DEMO_CAPITALE_MUTUO = residuo(DEMO_PIANO_MUTUO);
export const DEMO_CAPITALE_PRESTITO = residuo(DEMO_PIANO_PRESTITO);

export const DEMO_CASA_ID = "casa-demo";

const fissa = (f: Omit<Fissa, "mese" | "frequenza" | "note"> & Partial<Fissa>): Fissa => ({
  mese: 1,
  frequenza: "mensile",
  note: "",
  ...f,
});

/**
 * Spese fisse demo. Competenza al mese delle spese della casa:
 * condominio 90 · assicurazione 120/12 = 10 · TARI 240/12 = 20 · luce 60 · gas 45 · internet 25.
 */
export const DEMO_FISSE: Fissa[] = [
  fissa({
    id: "mutuo",
    nome: "Rata mutuo",
    importo: DEMO_RATA_MUTUO,
    giorno: 1,
    categoria: "debito",
    note: "TAN 2,40% fisso",
    immobileId: DEMO_CASA_ID,
    voce: "mutuo",
    piano: DEMO_PIANO_MUTUO,
  }),
  fissa({
    id: "prestito",
    nome: "Prestito auto",
    importo: DEMO_RATA_PRESTITO,
    giorno: 1,
    categoria: "debito",
    piano: DEMO_PIANO_PRESTITO,
  }),
  fissa({ id: "condominio", nome: "Condominio", importo: 90, giorno: 15, categoria: "casa", immobileId: DEMO_CASA_ID, voce: "condominio" }),
  fissa({
    id: "assicurazione",
    nome: "Assicurazione casa",
    importo: 120,
    giorno: 10,
    mese: 3,
    frequenza: "annuale",
    categoria: "casa",
    immobileId: DEMO_CASA_ID,
    voce: "assicurazione",
  }),
  fissa({
    id: "tari",
    nome: "TARI",
    importo: 240,
    giorno: 5,
    mese: 9,
    frequenza: "annuale",
    categoria: "casa",
    immobileId: DEMO_CASA_ID,
    voce: "tari",
  }),
  fissa({ id: "luce", nome: "Luce", importo: 60, giorno: 20, categoria: "casa", immobileId: DEMO_CASA_ID, voce: "luce" }),
  fissa({ id: "gas", nome: "Gas", importo: 45, giorno: 20, categoria: "casa", immobileId: DEMO_CASA_ID, voce: "gas" }),
  fissa({ id: "internet", nome: "Internet", importo: 25, giorno: 12, categoria: "casa", immobileId: DEMO_CASA_ID, voce: "internet" }),
  fissa({ id: "palestra", nome: "Palestra", importo: 40, giorno: 1, categoria: "vita" }),
  fissa({ id: "telefono", nome: "Telefono", importo: 10, giorno: 1, categoria: "vita" }),
  fissa({ id: "streaming", nome: "Streaming", importo: 12, giorno: 1, categoria: "vita" }),
];

export function demoFissa(id: string): Fissa {
  const f = DEMO_FISSE.find((x) => x.id === id);
  if (!f) throw new Error(`fissa demo ${id} assente`);
  return f;
}

/**
 * Casa demo: 80 m² in una zona da 2.000 €/m² (valore 160.000), pagata 140.000.
 * Spese di acquisto: atto 8.000 · tetto 12.000 e infissi 2.000 col bonus · porte 3.000 senza.
 */
export const DEMO_CASA: Immobile = {
  id: DEMO_CASA_ID,
  nome: "Casa demo",
  mq: 80,
  valoreCasa: 0,
  prezzoAcquisto: 140_000,
  annoAcquisto: 2020,
  affittoEq: 700,
  capitaleMutuo: DEMO_CAPITALE_MUTUO,
  closingCosts: 0,
  capexTetto: 0,
  capexInfissi: 0,
  capexPorte: 0,
  rivalutazionePct: 0.02,
  manutenzionePct: 0.01,
  bonusAliquota: 0.5,
  bonusQuoteTotali: 10,
  bonusQuoteGodute: 3,
  fissaMutuoId: "mutuo",
  citta: "Città di prova",
  uso: "abito",
  eurMqZona: 2000,
  speseAcquisto: [
    { id: "atto", nome: "Notaio e imposte", importo: 8000, tipo: "atto", detraibile: false },
    { id: "tetto", nome: "Tetto", importo: 12_000, tipo: "lavori", detraibile: true },
    { id: "infissi", nome: "Infissi", importo: 2000, tipo: "lavori", detraibile: true },
    { id: "porte", nome: "Porte interne", importo: 3000, tipo: "lavori", detraibile: false },
  ],
  mutuoTan: DEMO_TAN,
  mutuoFine: DEMO_PIANO_MUTUO[DEMO_PIANO_MUTUO.length - 1].d.slice(0, 7),
};

/** Patrimonio demo: i campi casa ricalcano la casa demo con i vecchi campi sparsi. */
export const DEMO_PATRIMONIO: Patrimonio = {
  fonteTotale: 0,
  fonteInvestito: 0,
  fonteAttesa: 0,
  capitaleMutuo: DEMO_CAPITALE_MUTUO,
  capitalePrestito: DEMO_CAPITALE_PRESTITO,
  saldoConto: 5000,
  valoreCasa: 0,
  mq: 80,
  prezzoAcquisto: 140_000,
  annoAcquisto: 2020,
  affittoEq: 700,
  rivalutazionePct: 0.02,
  manutenzionePct: 0.01,
  straordinarie: 0,
  closingCosts: 8000,
  capexTetto: 12_000,
  capexInfissi: 2000,
  capexPorte: 3000,
  bonusAliquota: 0.5,
  bonusQuoteTotali: 10,
  bonusQuoteGodute: 3,
  retribuzioneUtile: 0,
  fonteLavPct: 0,
  fonteDatPct: 0,
  tfrAccantonato: 0,
  fonteAttivo: false,
  fonteNome: "",
};

export const DEMO_STATO: QuadraState = {
  redditoMensile: 2000,
  redditoAnnuo: 24_000,
  fisse: DEMO_FISSE,
  patrimonio: DEMO_PATRIMONIO,
  mancanti: [],
};

/** Netto ordinario: 2.000 e 2.500 − 500 di 730 → media 2.000. */
export const DEMO_CEDOLINI: Cedolino[] = [
  { id: "2026-06", mese: "2026-06", netto: 2000, nota: "" },
  { id: "2026-07", mese: "2026-07", netto: 2500, nota: "di cui 500 € 730" },
];

export const DEMO_MOVIMENTI: Movimento[] = [
  { data: "2026-08-01", descrizione: "SUPERMERCATO DEMO", importo: 40, segno: "uscita" },
  { data: "2026-08-02", descrizione: "BAR DEMO", importo: 3, segno: "uscita" },
];

/** Stato completo (dati + extra dello store) da usare come `current` di hydratePersisted. */
export function demoStatoCompleto() {
  return {
    ...DEMO_STATO,
    regole: [] as { needle: string; cat: string }[],
    categorieCustom: [] as { id: string; label: string }[],
    categorieNascoste: [] as string[],
    fisseCategorie: [] as { id: string; label: string }[],
    investimenti: [],
    movimentiManuali: [],
    movimentiArchiviati: [] as string[],
    csvMovimenti: [] as Movimento[],
    csvMeta: null,
    overrideCat: {} as Record<string, string>,
    cedolini: DEMO_CEDOLINI,
    immobili: [DEMO_CASA],
    immobileSelezionatoId: DEMO_CASA_ID,
    nascostoSaldo: false,
    mostraDettaglioDebito: false,
    fonteSnapshots: [],
    fonteContributi: [],
    legacyImportato: true,
  };
}

/** Profilo privato inventato: la forma di src/private/profilo.json, con dati di prova. */
export function demoProfilo(): ProfiloPrivato {
  return {
    piani: { mutuo: DEMO_PIANO_MUTUO, fantasma: DEMO_PIANO_PRESTITO },
    movimenti: DEMO_MOVIMENTI,
    immobili: {
      [DEMO_CASA_ID]: { eurMqZona: 2000 },
      "casa-inesistente": { eurMqZona: 9999, mutuoTan: 0.09 },
    },
    fisseCasa: {
      [DEMO_CASA_ID]: { condominio: "condominio", luce: "luce", tari: "tari" },
      "casa-inesistente": { palestra: "altro" },
    },
    regole: [
      { needle: "supermercato demo", cat: "spesa" },
      { needle: "bar demo", cat: "bar" },
    ],
  };
}
