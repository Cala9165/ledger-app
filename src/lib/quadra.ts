import { isIsoDate, isoData, parseAmount, todayIso } from "./banca";
import { fissaConPiano, isDebitoFissa, type RataPiano } from "./piano";
import { nuovoId } from "./id";

/** Id di categoria: le quattro di serie piu quelle aggiunte dall utente. */
export type FissaCategoria = string;

export type CategoriaFissa = { id: string; label: string };
export type Frequenza = "mensile" | "trimestrale" | "semestrale" | "annuale";

export type Fissa = {
  id: string;
  nome: string;
  importo: number;
  giorno: number;
  mese: number;
  frequenza: Frequenza;
  categoria: FissaCategoria;
  note: string;
  /** Spesa di un immobile (condominio, IMU, luce…): id della casa a cui appartiene. */
  immobileId?: string;
  /** Che voce è per quella casa: decide se la paga anche chi sta in affitto. */
  voce?: VoceCasa;
  /** Piano di ammortamento (mutuo/prestito), se l'utente ce l'ha. */
  piano?: RataPiano[];
};

/** Voci di spesa di una casa. Le utenze le paga anche un inquilino, IMU e condominio no. */
export type VoceCasa =
  | "condominio"
  | "imu"
  | "tari"
  | "assicurazione"
  | "luce"
  | "gas"
  | "internet"
  | "mutuo"
  | "altro";

export const VOCI_CASA: { id: VoceCasa; label: string }[] = [
  { id: "condominio", label: "Condominio" },
  { id: "imu", label: "IMU" },
  { id: "tari", label: "TARI (rifiuti)" },
  { id: "assicurazione", label: "Assicurazione casa" },
  { id: "luce", label: "Luce" },
  { id: "gas", label: "Gas" },
  { id: "internet", label: "Internet" },
  { id: "altro", label: "Altro" },
];

/** Voci che paga anche chi sta in affitto (per il confronto «resto o vado in affitto»). */
export const VOCI_ANCHE_IN_AFFITTO: ReadonlySet<VoceCasa> = new Set(["tari", "luce", "gas", "internet"]);
/** Voci che in un affitto ordinario paga l'inquilino, non il proprietario (la TARI la paga chi ci abita). */
export const VOCI_INQUILINO: ReadonlySet<VoceCasa> = new Set(["tari", "luce", "gas", "internet"]);

export type InvTransazioneTipo = "acquisto" | "vendita" | "versamento" | "prelievo";

export type InvTransazione = {
  id: string;
  data: string; // ISO date
  tipo: InvTransazioneTipo;
  /** Importo lordo trade/cassa (≥0). */
  importo: number;
  /** Commissione / fee (≥0). */
  commissione: number;
  note: string;
};

export type Investimento = {
  id: string;
  nome: string;
  tipo: "crypto" | "azioni" | "fondo" | "altro";
  /** Valore di mercato (equity usa questo, non il cost basis). */
  valore: number;
  note: string;
  /** Operazioni (acquisti, vendite, versamenti, prelievi) con commissione. */
  transazioni?: InvTransazione[];
  /** Ticker o id CoinGecko (es. BTC, bitcoin). */
  simbolo?: string;
  /** Prezzo medio/ultimo di acquisto (€ / unità). */
  prezzoAcquisto?: number;
  /** Quantità detenuta (opzionale). */
  quantita?: number;
  /** Ultimo prezzo di mercato € (da Aggiorna prezzi). */
  prezzoMercato?: number;
  /** ISO datetime dell’ultimo aggiornamento prezzo. */
  prezzoAggiornatoAt?: string;
};

const TXN_TIPI: InvTransazioneTipo[] = ["acquisto", "vendita", "versamento", "prelievo"];

export function invTransazioni(inv: Investimento): InvTransazione[] {
  return Array.isArray(inv.transazioni) ? inv.transazioni : [];
}

function safeMoneyNonNeg(n: unknown): number {
  const x = typeof n === "number" ? n : Number(n);
  return Number.isFinite(x) && x >= 0 ? x : 0;
}

/** Capitale versato = Σ(acquisto+versamento).importo + Σ tutte le commissioni. */
export function capitaleVersato(inv: Investimento): number {
  let sum = 0;
  for (const t of invTransazioni(inv)) {
    if (t.tipo === "acquisto" || t.tipo === "versamento") sum += safeMoneyNonNeg(t.importo);
    sum += safeMoneyNonNeg(t.commissione);
  }
  return sum;
}

/** Ricavato vendite = Σ(vendita+prelievo).importo (senza fee: le fee sono nel capitale versato). */
export function ricavatoVendite(inv: Investimento): number {
  let sum = 0;
  for (const t of invTransazioni(inv)) {
    if (t.tipo === "vendita" || t.tipo === "prelievo") sum += safeMoneyNonNeg(t.importo);
  }
  return sum;
}

/**
 * Cost basis / netto investito: capitale versato − ricavato.
 * (= Σ acquisto/versamento + Σ commissioni − Σ vendita/prelievo).
 */
export function investitoNetto(inv: Investimento): number {
  return capitaleVersato(inv) - ricavatoVendite(inv);
}

/** P&L latente ≈ valore mercato − (capitale versato − ricavato). */
export function pnlLatente(inv: Investimento): number {
  const val = Number.isFinite(inv.valore) ? inv.valore : 0;
  return val - investitoNetto(inv);
}

export function normalizzaInvTransazione(t: InvTransazione): InvTransazione {
  const tipo = TXN_TIPI.includes(t.tipo) ? t.tipo : "acquisto";
  return {
    id: typeof t.id === "string" && t.id ? t.id : nuovoId(),
    data: typeof t.data === "string" ? t.data : "",
    tipo,
    importo: safeMoneyNonNeg(t.importo),
    commissione: safeMoneyNonNeg(t.commissione),
    note: typeof t.note === "string" ? t.note : "",
  };
}

function optNonNeg(n: unknown): number | undefined {
  if (n === undefined || n === null || n === "") return undefined;
  const x = typeof n === "number" ? n : Number(n);
  return Number.isFinite(x) && x >= 0 ? x : undefined;
}

/** Costo ≈ quantità × prezzo acquisto (commissioni restano nelle operazioni). */
export function costoAcquistoApprox(inv: Investimento): number | null {
  const q = optNonNeg(inv.quantita);
  const p = optNonNeg(inv.prezzoAcquisto);
  if (q !== undefined && q > 0 && p !== undefined) return q * p;
  return null;
}

/** Hydrate: missing/corrupt transazioni → []; campi prezzo/quantità opzionali. */
export function normalizzaInvestimento(i: Investimento): Investimento {
  const raw = (Array.isArray(i.transazioni) ? i.transazioni : []).filter(
    (t) => !!t && typeof t === "object",
  );
  const simboloRaw = typeof i.simbolo === "string" ? i.simbolo.trim() : "";
  return {
    id: typeof i.id === "string" ? i.id : "",
    nome: typeof i.nome === "string" ? i.nome : "",
    tipo: (["crypto", "azioni", "fondo", "altro"] as const).includes(i.tipo)
      ? i.tipo
      : "altro",
    valore: Number.isFinite(i.valore) ? Math.max(0, i.valore) : 0,
    note: typeof i.note === "string" ? i.note : "",
    transazioni: raw.map((t) => normalizzaInvTransazione(t as InvTransazione)),
    simbolo: simboloRaw || undefined,
    prezzoAcquisto: optNonNeg(i.prezzoAcquisto),
    quantita: optNonNeg(i.quantita),
    prezzoMercato: optNonNeg(i.prezzoMercato),
    prezzoAggiornatoAt:
      typeof i.prezzoAggiornatoAt === "string" && i.prezzoAggiornatoAt
        ? i.prezzoAggiornatoAt
        : undefined,
  };
}

export const FREQUENZE: { id: Frequenza; label: string; mesi: number }[] = [
  { id: "mensile", label: "Mensile", mesi: 1 },
  { id: "trimestrale", label: "Ogni 3 mesi", mesi: 3 },
  { id: "semestrale", label: "Ogni 6 mesi", mesi: 6 },
  { id: "annuale", label: "Annuale", mesi: 12 },
];

export function mesiFrequenza(f: Frequenza | undefined): number {
  return FREQUENZE.find((x) => x.id === (f ?? "mensile"))?.mesi ?? 1;
}

/** Importo che esce dal conto quando scatta, diviso sui mesi. */
export function competenzaMese(f: Fissa): number {
  return f.importo / mesiFrequenza(f.frequenza);
}

export function normalizzaFissa(f: Fissa): Fissa {
  const out: Fissa = {
    ...f,
    frequenza: f.frequenza ?? "mensile",
    mese: f.mese ?? 1,
  };
  if (typeof out.immobileId !== "string" || !out.immobileId) delete out.immobileId;
  if (typeof out.voce !== "string") delete out.voce;
  if (!Array.isArray(out.piano) || out.piano.length === 0) delete out.piano;
  return out;
}

export type Patrimonio = {
  fonteTotale: number;
  fonteInvestito: number;
  fonteAttesa: number;
  capitaleMutuo: number;
  capitalePrestito: number;
  saldoConto: number;
  valoreCasa: number;
  mq: number;
  prezzoAcquisto: number;
  annoAcquisto: number;
  affittoEq: number;
  rivalutazionePct: number;
  manutenzionePct: number;
  straordinarie: number;
  closingCosts: number;
  capexTetto: number;
  capexInfissi: number;
  capexPorte: number;
  bonusAliquota: number;
  bonusQuoteTotali: number;
  bonusQuoteGodute: number;
  retribuzioneUtile: number;
  fonteLavPct: number;
  fonteDatPct: number;
  /** TFR già accantonato a Fon.Te (stock, non competenza mese). */
  tfrAccantonato: number;
  /** Fon.Te compare solo se l'utente l'ha aggiunto. */
  fonteAttivo?: boolean;
  /** Nome del fondo pensione come lo chiama l'utente. */
  fonteNome?: string;
};

export type UsoImmobile = "abito" | "affitto" | "mista";

export const USI_IMMOBILE: { id: UsoImmobile; label: string }[] = [
  { id: "abito", label: "Ci abito" },
  { id: "affitto", label: "La affitto" },
  { id: "mista", label: "Mista" },
];

/** Una spesa fatta una volta per la casa: notaio, imposte, agenzia, lavori. */
export type SpesaAcquisto = {
  id: string;
  nome: string;
  importo: number;
  tipo: "atto" | "lavori";
  /** Lavori con bonus fiscale (tetto, infissi): rientrano in parte col 730. */
  detraibile: boolean;
};

export type Immobile = {
  id: string;
  nome: string;
  mq: number;
  valoreCasa: number;
  prezzoAcquisto: number;
  annoAcquisto: number;
  affittoEq: number;
  capitaleMutuo: number;
  closingCosts: number;
  capexTetto: number;
  capexInfissi: number;
  capexPorte: number;
  rivalutazionePct: number;
  manutenzionePct: number;
  bonusAliquota: number;
  bonusQuoteTotali: number;
  bonusQuoteGodute: number;
  fissaMutuoId: string;
  citta?: string;
  uso?: UsoImmobile;
  /** Prezzo al m² della zona, se l'utente lo conosce: serve a stimare il valore di oggi. */
  eurMqZona?: number;
  /** Notaio, imposte, lavori: la lista che sostituisce i campi sparsi. */
  speseAcquisto?: SpesaAcquisto[];
  /** TAN del mutuo (0,025 = 2,5 %). */
  mutuoTan?: number;
  /** Ultima rata del mutuo, AAAA-MM. */
  mutuoFine?: string;
  /** La rivalutazione l'ha scritta l'utente (o l'ha presa dal dato di mercato)? Senza, niente voto sulla leva. */
  rivalutazioneScelta?: boolean;
};

export const IMMOBILE_VUOTO: Omit<Immobile, "id" | "nome"> = {
  mq: 0,
  valoreCasa: 0,
  prezzoAcquisto: 0,
  annoAcquisto: new Date().getFullYear(),
  affittoEq: 0,
  capitaleMutuo: 0,
  closingCosts: 0,
  capexTetto: 0,
  capexInfissi: 0,
  capexPorte: 0,
  rivalutazionePct: 0.03,
  manutenzionePct: 0.01,
  bonusAliquota: 0.5,
  bonusQuoteTotali: 10,
  bonusQuoteGodute: 0,
  fissaMutuoId: "",
  citta: "",
  uso: "abito",
  eurMqZona: 0,
  speseAcquisto: [],
  mutuoTan: 0,
  mutuoFine: "",
  rivalutazioneScelta: false,
};

/**
 * Solo per i salvataggi di prima delle case multiple: la casa che stava nel patrimonio.
 * Il mutuo è la spesa fissa che si chiama così: l'id dipende da come l'aveva salvata l'utente.
 */
export function immobileDaPatrimonio(p: Patrimonio, fisse: unknown = []): Immobile {
  const mutuo = (Array.isArray(fisse) ? fisse : []).find(
    (f): f is Fissa =>
      !!f &&
      typeof f === "object" &&
      typeof (f as Fissa).id === "string" &&
      /mutuo/i.test(`${(f as Fissa).id} ${typeof (f as Fissa).nome === "string" ? (f as Fissa).nome : ""}`),
  );
  return {
    id: "casa",
    nome: "Casa",
    mq: p.mq,
    valoreCasa: p.valoreCasa,
    prezzoAcquisto: p.prezzoAcquisto,
    annoAcquisto: p.annoAcquisto,
    affittoEq: p.affittoEq,
    capitaleMutuo: p.capitaleMutuo,
    closingCosts: p.closingCosts,
    capexTetto: p.capexTetto,
    capexInfissi: p.capexInfissi,
    capexPorte: p.capexPorte,
    rivalutazionePct: p.rivalutazionePct,
    manutenzionePct: p.manutenzionePct,
    bonusAliquota: p.bonusAliquota,
    bonusQuoteTotali: p.bonusQuoteTotali,
    bonusQuoteGodute: p.bonusQuoteGodute,
    fissaMutuoId: mutuo?.id ?? "",
  };
}

/** I campi sparsi di prima (notaio, tetto, infissi, porte) diventano la lista delle spese. */
export function speseAcquistoDaCampi(
  i: Pick<Immobile, "closingCosts" | "capexTetto" | "capexInfissi" | "capexPorte">,
): SpesaAcquisto[] {
  const out: SpesaAcquisto[] = [];
  const add = (
    id: string,
    nome: string,
    importo: number,
    tipo: SpesaAcquisto["tipo"],
    detraibile: boolean,
  ) => {
    if (Number.isFinite(importo) && importo > 0) out.push({ id, nome, importo, tipo, detraibile });
  };
  add("atto", "Notaio, agenzia e imposte", i.closingCosts, "atto", false);
  add("tetto", "Tetto", i.capexTetto, "lavori", true);
  add("infissi", "Infissi", i.capexInfissi, "lavori", true);
  add("porte", "Porte interne", i.capexPorte, "lavori", false);
  return out;
}

function normalizzaSpesaAcquisto(x: unknown): SpesaAcquisto | null {
  if (!x || typeof x !== "object") return null;
  const r = x as Partial<SpesaAcquisto>;
  const importo =
    typeof r.importo === "number" && Number.isFinite(r.importo) ? Math.max(0, r.importo) : 0;
  return {
    id: typeof r.id === "string" && r.id ? r.id : nuovoId(),
    nome: typeof r.nome === "string" ? r.nome : "",
    importo,
    tipo: r.tipo === "lavori" ? "lavori" : "atto",
    detraibile: r.tipo === "lavori" && !!r.detraibile,
  };
}

/**
 * Hydrate di un immobile: campi nuovi con valori neutri, lista spese costruita
 * dai campi vecchi una volta sola. Uno zero messo dall'utente resta zero: con la
 * vecchia guardia `!(i.mq > 0)` i metri quadri azzerati tornavano da soli.
 */
export function normalizzaImmobile(i: Immobile): Immobile {
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const base: Immobile = {
    ...IMMOBILE_VUOTO,
    ...i,
    nome: typeof i.nome === "string" ? i.nome : "",
    mq: num(i.mq),
    valoreCasa: num(i.valoreCasa),
    prezzoAcquisto: num(i.prezzoAcquisto),
    capitaleMutuo: num(i.capitaleMutuo),
    affittoEq: num(i.affittoEq),
    closingCosts: num(i.closingCosts),
    capexTetto: num(i.capexTetto),
    capexInfissi: num(i.capexInfissi),
    capexPorte: num(i.capexPorte),
    fissaMutuoId: typeof i.fissaMutuoId === "string" ? i.fissaMutuoId : "",
    citta: typeof i.citta === "string" ? i.citta : "",
    uso: i.uso === "affitto" || i.uso === "mista" ? i.uso : "abito",
    eurMqZona: Math.max(0, num(i.eurMqZona)),
    mutuoTan: Math.max(0, num(i.mutuoTan)),
    mutuoFine: typeof i.mutuoFine === "string" ? i.mutuoFine : "",
    // Le case già salvate tengono la loro ipotesi: il campo manca solo nei salvataggi vecchi.
    rivalutazioneScelta: typeof i.rivalutazioneScelta === "boolean" ? i.rivalutazioneScelta : true,
  };
  base.speseAcquisto = Array.isArray(i.speseAcquisto)
    ? i.speseAcquisto
        .map(normalizzaSpesaAcquisto)
        .filter((x): x is SpesaAcquisto => x !== null)
    : speseAcquistoDaCampi(base);
  return base;
}

export function normalizzaImmobili(immobili: unknown): Immobile[] {
  if (!Array.isArray(immobili)) return [];
  return immobili
    .filter(
      (i): i is Immobile =>
        !!i && typeof i === "object" && typeof (i as Immobile).id === "string" && !!(i as Immobile).id,
    )
    .map(normalizzaImmobile);
}

export type QuadraState = {
  redditoMensile: number;
  redditoAnnuo: number;
  fisse: Fissa[];
  patrimonio: Patrimonio;
  mancanti: string[];
};

export type Cedolino = {
  id: string;
  mese: string;
  netto: number;
  nota: string;
  fileName?: string;
};

export const CATEGORIE: CategoriaFissa[] = [
  { id: "debito", label: "Debito" },
  { id: "casa", label: "Casa" },
  { id: "vita", label: "Vita" },
  { id: "altro", label: "Altro" },
];

/** Categoria di ripiego quando ne viene cancellata una in uso. */
export const CATEGORIA_FISSA_DEFAULT = "altro";

export const CATEGORIE_FISSE_BUILTIN: ReadonlySet<string> = new Set(CATEGORIE.map((c) => c.id));

/** Etichetta -> id stabile. Stringa vuota se l etichetta non ha caratteri utili. */
export function slugCategoriaFissa(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Di serie + personalizzate, senza duplicati e a prova di persist corrotto. */
export function categorieFisse(custom: readonly CategoriaFissa[] = []): CategoriaFissa[] {
  const visti = new Set<string>(CATEGORIE.map((c) => c.id));
  const extra: CategoriaFissa[] = [];
  for (const c of custom) {
    if (!c || typeof c.id !== "string" || !c.id || visti.has(c.id)) continue;
    visti.add(c.id);
    extra.push({ id: c.id, label: typeof c.label === "string" && c.label ? c.label : c.id });
  }
  return [...CATEGORIE, ...extra];
}

/** Etichetta da mostrare per un id, anche se quella categoria non esiste piu. */
export function labelCategoriaFissa(id: string, custom: readonly CategoriaFissa[] = []): string {
  return categorieFisse(custom).find((c) => c.id === id)?.label ?? id;
}

export const PATRIMONIO_VUOTO: Patrimonio = {
  fonteTotale: 0,
  fonteInvestito: 0,
  fonteAttesa: 0,
  capitaleMutuo: 0,
  capitalePrestito: 0,
  saldoConto: 0,
  valoreCasa: 0,
  mq: 0,
  prezzoAcquisto: 0,
  annoAcquisto: 0,
  affittoEq: 0,
  rivalutazionePct: 0,
  manutenzionePct: 0,
  straordinarie: 0,
  closingCosts: 0,
  capexTetto: 0,
  capexInfissi: 0,
  capexPorte: 0,
  bonusAliquota: 0,
  bonusQuoteTotali: 0,
  bonusQuoteGodute: 0,
  retribuzioneUtile: 0,
  fonteLavPct: 0,
  fonteDatPct: 0,
  tfrAccantonato: 0,
  fonteAttivo: false,
  fonteNome: "",
};

/** L'app nuda: niente case, niente spese, niente stipendio. Chi la apre mette i suoi. */
export const STATO_VUOTO: QuadraState = {
  redditoMensile: 0,
  redditoAnnuo: 0,
  fisse: [],
  patrimonio: PATRIMONIO_VUOTO,
  mancanti: [],
};

/** Un numero di 4 cifre fra 1990 e 2100 senza € è un anno («arretrati 2026 730»), non un importo. */
function sembraAnno(raw: string): boolean {
  return /^\d{4}$/.test(raw) && Number(raw) >= 1990 && Number(raw) <= 2100;
}

/**
 * Il rimborso 730 scritto nella nota del cedolino. L'importo può stare prima
 * («500 € 730», «1.234,56€730», «1'234 € 730», «1234.56 730») o dopo («730 di 480 €»,
 * «rimborso 730: 480,00», «730 480»). Un anno o una data non sono un importo: nel
 * dubbio non si toglie niente dal netto.
 */
export function extraCedolino(c: Cedolino): number {
  const nota = typeof c.nota === "string" ? c.nota : "";
  const importo = (raw: string, conEuro: boolean): number | null => {
    if (!conEuro && sembraAnno(raw)) return null;
    const n = parseAmount(raw);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  // Prima di «730», separato da spazio o da €: «12730» non è «12 € 730».
  for (const m of nota.matchAll(/(\d[\d.,'\u2019]*)(?:\s*(€)\s*|\s+)730(?![\d.,'\u2019])/gi)) {
    const n = importo(m[1], m[2] === "€");
    if (n !== null) return n;
  }
  // Dopo «730», subito o dopo «:», «=», «- », «di», «da», «pari a». Non valgono: un meno
  // attaccato alla cifra («730 -120» è un 730 a debito), una data («15/06», «15-06-2026»),
  // le migliaia con lo spazio («1 234»). E deve sembrare un importo: col €, coi centesimi o
  // almeno tre cifre («730 2 rate» non è un rimborso di 2 €).
  const dopo = nota.match(
    /(?<![\d.,'\u2019])730(?![\d.,'\u2019])\s*(?:[:=]\s*|[-–]\s+|(?:di|da|pari a|per)\s+)?(€\s*)?(\d[\d.,'\u2019]*)(?![\d/\-–]|\s+\d)(\s*€)?/i,
  );
  if (dopo) {
    const conEuro = !!dopo[1] || !!dopo[3];
    const sembraImporto = conEuro || /[.,]\d{2}$/.test(dopo[2]) || dopo[2].replace(/\D/g, "").length >= 3;
    const n = sembraImporto ? importo(dopo[2], conEuro) : null;
    if (n !== null) return n;
  }
  return 0;
}

export function nettoOrdinario(c: Cedolino): number {
  const extra = extraCedolino(c);
  const netto = Number.isFinite(c.netto) ? c.netto : 0;
  return Math.max(0, netto - Math.min(extra, Math.max(0, netto)));
}

export function redditoMedio(cedolini: Cedolino[]): number {
  if (!cedolini.length) return 0;
  return cedolini.reduce((s, c) => s + nettoOrdinario(c), 0) / cedolini.length;
}

/**
 * Cedolini dal salvataggio. Una riga senza mese non deve far fallire tutto il
 * ripristino: si ripara dal suo id se è un mese, altrimenti si scarta solo lei.
 */
export function mergeMissingCedolini(rows: Cedolino[] | undefined): Cedolino[] {
  if (!Array.isArray(rows)) return [];
  const out: Cedolino[] = [];
  for (const r of rows as unknown[]) {
    if (!r || typeof r !== "object") continue;
    const c = r as Partial<Cedolino>;
    const mese =
      typeof c.mese === "string" && /^\d{4}-\d{2}$/.test(c.mese)
        ? c.mese
        : typeof c.id === "string" && /^\d{4}-\d{2}$/.test(c.id)
          ? c.id
          : "";
    if (!mese) continue;
    out.push({
      id: typeof c.id === "string" && c.id ? c.id : mese,
      mese,
      netto: typeof c.netto === "number" && Number.isFinite(c.netto) ? c.netto : 0,
      nota: typeof c.nota === "string" ? c.nota : "",
      ...(typeof c.fileName === "string" && c.fileName ? { fileName: c.fileName } : {}),
    });
  }
  return out.sort((a, b) => a.mese.localeCompare(b.mese));
}

/**
 * Mese dal nome del file. L'anno deve stare fra l'anno scorso e il prossimo:
 * «Cedolino 3103.pdf» è il 31 marzo, non marzo 2031.
 */
export function guessCedolinoMese(fileName: string, oggi = new Date()): string {
  const n = fileName.toLowerCase();
  const anno = oggi.getFullYear();
  const plausibile = (y: number, m: number) => y >= anno - 1 && y <= anno + 1 && m >= 1 && m <= 12;
  for (const m of n.matchAll(/(\d{4})[-_.](\d{2})(?!\d)/g)) {
    if (plausibile(Number(m[1]), Number(m[2]))) return `${m[1]}-${m[2]}`;
  }
  for (const m of n.matchAll(/(?<!\d)(\d{2})(\d{2})(?!\d)/g)) {
    const y = 2000 + Number(m[1]);
    if (plausibile(y, Number(m[2]))) return `${y}-${m[2]}`;
  }
  for (const m of n.matchAll(/(?<!\d)(\d{4})(\d{2})(?!\d)/g)) {
    if (plausibile(Number(m[1]), Number(m[2]))) return `${m[1]}-${m[2]}`;
  }
  return "";
}

export function scadeQuelGiorno(f: Fissa, date: Date): boolean {
  const fissa = normalizzaFissa(f);
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const dueDay = Math.min(fissa.giorno, last);
  if (day !== dueDay) return false;
  const start = fissa.mese;
  const step = mesiFrequenza(fissa.frequenza);
  if (step >= 12) return month === start;
  const delta = (month - start + 12) % 12;
  return delta % step === 0;
}

export function fisseQuelGiorno(fisse: Fissa[], isoDate: string): Fissa[] {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return fisse.filter((f) => scadeQuelGiorno(f, date));
}

/** Addebiti fisse (importo pieno) che cadono tra dal e al, inclusi. */
export function fisseNelPeriodo(
  fisse: Fissa[],
  dal: string,
  al: string,
): { data: string; fissa: Fissa }[] {
  // Pad + calendar-validate: unpadded hi ("2026-9-5") is lexicographically > padded
  // "2026-09-…" and would walk past the real end of the period.
  let a = isoData(dal);
  let b = isoData(al);
  if (!isIsoDate(a) || !isIsoDate(b)) return [];
  if (a > b) [a, b] = [b, a];
  const [ys, ms, ds] = a.split("-").map(Number);
  const [ye, me, de] = b.split("-").map(Number);
  const cur = new Date(ys, ms - 1, ds);
  const endMs = new Date(ye, me - 1, de).getTime();
  const out: { data: string; fissa: Fissa }[] = [];
  // Inclusive day walk bounded by the real calendar span (old fixed caps of
  // 800d / 50y silently dropped Carta multi-decade / +100y periods).
  const daySpan = Number.isFinite(endMs)
    ? Math.round((endMs - cur.getTime()) / 86400000) + 1
    : 0;
  const safety = Math.max(1, daySpan) + 1;
  for (let i = 0; i < safety; i++) {
    const iso = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
    if (iso > b) break;
    for (const f of fisseQuelGiorno(fisse, iso)) {
      out.push({ data: iso, fissa: f });
    }
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/** TFR competenza ≈ retribuzione / 13,5. Quota lav/dat da % Patrimonio. */
export function fonteMese(p: Patrimonio): {
  lavoratore: number;
  datore: number;
  tfr: number;
  totale: number;
} {
  const ru = Number.isFinite(p.retribuzioneUtile) ? Math.max(0, p.retribuzioneUtile) : 0;
  const lavPct = Number.isFinite(p.fonteLavPct) ? Math.max(0, p.fonteLavPct) : 0;
  const datPct = Number.isFinite(p.fonteDatPct) ? Math.max(0, p.fonteDatPct) : 0;
  const lavoratore = ru * lavPct;
  const datore = ru * datPct;
  const tfr = ru / 13.5;
  return { lavoratore, datore, tfr, totale: lavoratore + datore + tfr };
}

/** Proiezione annuale (×12) della competenza mensile Fon.Te da busta. */
export function fonteAnno(p: Patrimonio): {
  lavoratore: number;
  datore: number;
  tfr: number;
  totale: number;
} {
  const m = fonteMese(p);
  return {
    lavoratore: m.lavoratore * 12,
    datore: m.datore * 12,
    tfr: m.tfr * 12,
    totale: m.totale * 12,
  };
}

/** Hydrate: tfrAccantonato mancante → 0; % Fon.Te finite. */
export function normalizzaPatrimonio(p: Patrimonio): Patrimonio {
  const tfr =
    typeof p.tfrAccantonato === "number" && Number.isFinite(p.tfrAccantonato)
      ? Math.max(0, p.tfrAccantonato)
      : 0;
  return {
    ...p,
    tfrAccantonato: tfr,
    fonteLavPct: Number.isFinite(p.fonteLavPct) ? Math.max(0, p.fonteLavPct) : 0,
    fonteDatPct: Number.isFinite(p.fonteDatPct) ? Math.max(0, p.fonteDatPct) : 0,
    retribuzioneUtile: Number.isFinite(p.retribuzioneUtile)
      ? Math.max(0, p.retribuzioneUtile)
      : 0,
  };
}

/**
 * `null` = nessuna lista (dato vecchio, si usa il patrimonio globale).
 * `[]` = non hai case: vale zero. Dedurlo dalla lunghezza faceva riapparire
 * il mutuo dell'ultima casa appena cancellata.
 */
export function debitoCapitale(p: Patrimonio, immobili: Immobile[] | null = null): number {
  const caseMutui =
    immobili === null ? p.capitaleMutuo : immobili.reduce((s, i) => s + i.capitaleMutuo, 0);
  return caseMutui + p.capitalePrestito;
}


/** Stesso criterio di casa.valoreEffettivo: valore tuo → m² × prezzo della zona → prezzo pagato. */
export function valoreCasaPerEquity(v: {
  valoreCasa: number;
  mq: number;
  prezzoAcquisto: number;
  eurMqZona?: number;
}): number {
  if (v.valoreCasa > 0) return v.valoreCasa;
  const zona = v.eurMqZona ?? 0;
  if (v.mq > 0 && zona > 0) return Math.round(v.mq * zona);
  if (v.prezzoAcquisto > 0) return v.prezzoAcquisto;
  return 0;
}

/** Stessa regola di debitoCapitale: `null` = dato vecchio, `[]` = nessuna casa. */
export function equity(
  p: Patrimonio,
  immobili: Immobile[] | null = null,
  investimenti: { valore: number }[] = [],
): number {
  const caseVal =
    immobili === null
      ? valoreCasaPerEquity(p) // salvataggio di prima delle case multiple
      : immobili.reduce((s, i) => s + valoreCasaPerEquity(i), 0);
  const inv = investimenti.reduce((s, i) => s + (Number.isFinite(i.valore) ? i.valore : 0), 0);
  return p.fonteTotale + p.saldoConto + caseVal + inv - debitoCapitale(p, immobili);
}

/** Tetto banca: 33% del netto meno debiti già in corso. Non si muove se scende V.
 * Allinea Home/Formule: isDebitoFissa + fissaConPiano (mensile / rata piano). */
export function rMaxResidua(state: QuadraState, iso = todayIso()): number {
  if (!Number.isFinite(state.redditoMensile)) return 0;
  const day = isIsoDate(isoData(iso)) ? isoData(iso) : todayIso();
  const debiti = state.fisse
    .filter(isDebitoFissa)
    .reduce((s, f) => s + competenzaMese(fissaConPiano(f, day)), 0);
  const tetto = 0.33 * state.redditoMensile - debiti;
  return Number.isFinite(tetto) ? Math.max(0, tetto) : 0;
}

/** Quanto puoi impegnare in una rata nuova: il più basso tra cassa (CF) e tetto banca. */
export function capacitaPrestito(cf: number, tettoBanca: number): number {
  if (!Number.isFinite(cf) || !Number.isFinite(tettoBanca)) return 0;
  return Math.max(0, Math.min(cf, tettoBanca));
}

