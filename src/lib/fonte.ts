/**
 * Fon.Te — sync sicura, solo client.
 * Niente API privata, SPID, OTP o scraping area riservata.
 * Snapshot = quote × valore quota. Persistiamo solo dati strutturati.
 */
import { isIsoDate, isoData, parseAmount, sanitizeCsvText } from "./banca";
import type { Patrimonio } from "./quadra";

export type FonteComparto = "garantito" | "sviluppo" | "crescita" | "dinamico" | "custom";
export type FonteOrigine = "manuale" | "pdf" | "csv";
export type FonteContributoTipo = "lavoratore" | "datore" | "tfr" | "volontario" | "altro";
export type FonteContributoStato = "atteso" | "accreditato" | "quotato";

export type FonteSnapshot = {
  id: string;
  data: string;
  comparto: FonteComparto;
  compartoCustom?: string;
  numeroQuote: number;
  valoreQuota: number;
  posizione: number;
  fonte: FonteOrigine;
};

export type FonteContributo = {
  id: string;
  data: string;
  competenza: string;
  trimestre: string;
  fonte: FonteContributoTipo;
  importo: number;
  stato: FonteContributoStato;
  note: string;
};

export const FONTE_COMPARTI: { id: FonteComparto; label: string; ufficiale: string }[] = [
  { id: "garantito", label: "Garantito / Conservativo", ufficiale: "Conservativo" },
  { id: "sviluppo", label: "Sviluppo", ufficiale: "Sviluppo" },
  { id: "crescita", label: "Crescita", ufficiale: "Crescita" },
  { id: "dinamico", label: "Dinamico", ufficiale: "Dinamico" },
  { id: "custom", label: "Altro", ufficiale: "" },
];

export const FONTE_CONTRIBUTI_TIPI: { id: FonteContributoTipo; label: string }[] = [
  { id: "lavoratore", label: "Lavoratore" },
  { id: "datore", label: "Datore" },
  { id: "tfr", label: "TFR" },
  { id: "volontario", label: "Volontario" },
  { id: "altro", label: "Altro" },
];

export const FONTE_STATI: { id: FonteContributoStato; label: string }[] = [
  { id: "atteso", label: "Atteso (busta)" },
  { id: "accreditato", label: "Accreditato" },
  { id: "quotato", label: "Quotato" },
];

export const FONTE_QUOTA_URL: Record<FonteComparto, string | null> = {
  garantito:
    "https://www.fondofonte.it/gestione-finanziaria/i-valori-quota-dei-comparti/comparto-garantito/",
  sviluppo:
    "https://www.fondofonte.it/gestione-finanziaria/i-valori-quota-dei-comparti/comparto-bilanciato/",
  crescita:
    "https://www.fondofonte.it/gestione-finanziaria/i-valori-quota-dei-comparti/comparto-crescita/",
  dinamico:
    "https://www.fondofonte.it/gestione-finanziaria/i-valori-quota-dei-comparti/comparto-dinamico/",
  custom: null,
};

export const FONTE_QUOTA_INDEX_URL =
  "https://www.fondofonte.it/gestione-finanziaria/i-valori-quota-dei-comparti/";

export const FONTE_CSV_HEADERS =
  "data,comparto,numero_quote,valore_quota,tipo_contributo,importo,stato,note";

export const FONTE_CSV_TEMPLATE = `${FONTE_CSV_HEADERS}
2026-06-30,dinamico,100.0000,20.000,,,,"Estratto di giugno"
2026-06-30,dinamico,,,lavoratore,20.00,accreditato,Secondo trimestre
2026-06-30,dinamico,,,datore,40.00,accreditato,
2026-06-30,dinamico,,,tfr,100.00,atteso,Da busta
`;

const COMPARTI: FonteComparto[] = ["garantito", "sviluppo", "crescita", "dinamico", "custom"];
const ORIGINI: FonteOrigine[] = ["manuale", "pdf", "csv"];

const MESI_IT = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];

function asFiniteNonNeg(n: unknown): number {
  const x = typeof n === "number" ? n : Number(n);
  return Number.isFinite(x) && x >= 0 ? x : 0;
}

function money2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Quote / valore quota: 12,345 e 12.345 sono decimali, non migliaia.
 * Importi € (1.234,56) restano su parseAmount.
 */
export function parseFonteQty(raw: string): number {
  const t = raw.trim().replace(/\s/g, "").replace(/€/g, "").replace(/\u2212/g, "-");
  if (!t) return 0;
  const m = t.match(/^(-)?(\d{1,6})[,.](\d{3,8})$/);
  if (m) {
    const n = Number(`${m[1] ?? ""}${m[2]}.${m[3]}`);
    if (Number.isFinite(n)) return Math.abs(n);
  }
  return asFiniteNonNeg(parseAmount(raw));
}

export function fontePosizione(numeroQuote: unknown, valoreQuota: unknown): number {
  return money2(asFiniteNonNeg(numeroQuote) * asFiniteNonNeg(valoreQuota));
}

export function trimestreDaIso(iso: string): string {
  const d = isoData(iso);
  if (!isIsoDate(d)) return "";
  const y = d.slice(0, 4);
  const m = Number(d.slice(5, 7));
  const q = m >= 1 && m <= 12 ? Math.ceil(m / 3) : 0;
  return q ? `${y}-Q${q}` : "";
}

export function competenzaDaIso(iso: string): string {
  const d = isoData(iso);
  return isIsoDate(d) ? d.slice(0, 7) : "";
}

export function parseFonteComparto(raw: string | undefined | null): {
  comparto: FonteComparto;
  custom?: string;
} {
  const t = (raw ?? "").trim().toLowerCase();
  if (!t) return { comparto: "dinamico" };
  if (t === "custom" || t === "altro" || t === "altro (custom)") return { comparto: "custom" };
  if (t.includes("garant") || t.includes("conserv")) return { comparto: "garantito" };
  if (t.includes("svilup") || t.includes("bilanc")) return { comparto: "sviluppo" };
  if (t.includes("cresc")) return { comparto: "crescita" };
  if (t.includes("dinam")) return { comparto: "dinamico" };
  if ((COMPARTI as string[]).includes(t)) return { comparto: t as FonteComparto };
  return { comparto: "custom", custom: sanitizeCsvText(raw ?? "", 80) };
}

export function parseFonteTipo(raw: string | undefined | null): FonteContributoTipo | null {
  const t = (raw ?? "").trim().toLowerCase();
  if (!t) return null;
  if (t === "lavoratore" || t === "lav" || t === "iscritto" || t === "aderente") return "lavoratore";
  if (t === "datore" || t === "dat" || t === "azienda" || t === "titolare") return "datore";
  if (t === "tfr" || t === "trattamento di fine rapporto") return "tfr";
  if (t === "volontario" || t === "vol" || t === "versamento volontario") return "volontario";
  if (t === "altro" || t === "other") return "altro";
  return null;
}

export function parseFonteStato(raw: string | undefined | null): FonteContributoStato {
  const t = (raw ?? "").trim().toLowerCase();
  if (t === "atteso" || t === "attesa" || t === "expected" || t === "busta") return "atteso";
  if (t === "quotato" || t === "quotata" || t === "quoted") return "quotato";
  return "accreditato";
}

export function parseFonteOrigine(raw: unknown): FonteOrigine {
  return typeof raw === "string" && (ORIGINI as string[]).includes(raw) ? (raw as FonteOrigine) : "manuale";
}

export function labelFonteComparto(s: Pick<FonteSnapshot, "comparto" | "compartoCustom">): string {
  if (s.comparto === "custom") return s.compartoCustom?.trim() || "Altro";
  return FONTE_COMPARTI.find((c) => c.id === s.comparto)?.label ?? s.comparto;
}

export function buildFonteSnapshot(input: {
  id?: string;
  data: string;
  comparto: FonteComparto;
  compartoCustom?: string;
  numeroQuote: number;
  valoreQuota: number;
  fonte: FonteOrigine;
}): FonteSnapshot {
  const data = isoData(input.data);
  return {
    id: typeof input.id === "string" && input.id ? input.id : "",
    data: isIsoDate(data) ? data : "",
    comparto: COMPARTI.includes(input.comparto) ? input.comparto : "dinamico",
    compartoCustom:
      input.comparto === "custom" && input.compartoCustom?.trim()
        ? sanitizeCsvText(input.compartoCustom, 80)
        : undefined,
    numeroQuote: asFiniteNonNeg(input.numeroQuote),
    valoreQuota: asFiniteNonNeg(input.valoreQuota),
    posizione: fontePosizione(input.numeroQuote, input.valoreQuota),
    fonte: parseFonteOrigine(input.fonte),
  };
}

export function normalizzaFonteSnapshot(raw: unknown): FonteSnapshot | null {
  if (raw === null || raw === undefined || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const r = raw as Partial<FonteSnapshot>;
  const { comparto, custom } = parseFonteComparto(
    typeof r.comparto === "string" ? r.comparto : "",
  );
  const data = typeof r.data === "string" ? isoData(r.data) : "";
  const snap = buildFonteSnapshot({
    id: typeof r.id === "string" ? r.id : "",
    data,
    comparto: r.comparto && COMPARTI.includes(r.comparto) ? r.comparto : comparto,
    compartoCustom: r.compartoCustom ?? custom,
    numeroQuote: r.numeroQuote as number,
    valoreQuota: r.valoreQuota as number,
    fonte: parseFonteOrigine(r.fonte),
  });
  if (!snap.data && snap.numeroQuote === 0 && snap.valoreQuota === 0) return null;
  return snap;
}

export function normalizzaFonteContributo(raw: unknown): FonteContributo | null {
  if (raw === null || raw === undefined || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const r = raw as Partial<FonteContributo> & { tipo?: string };
  const dataRaw = typeof r.data === "string" ? isoData(r.data) : "";
  const data = isIsoDate(dataRaw) ? dataRaw : "";
  const tipo = parseFonteTipo(r.fonte) ?? parseFonteTipo(r.tipo) ?? "altro";
  const importo = asFiniteNonNeg(r.importo);
  const competenzaRaw = typeof r.competenza === "string" ? r.competenza.trim() : "";
  const trimestreRaw = typeof r.trimestre === "string" ? r.trimestre.trim() : "";
  const competenza = /^\d{4}-\d{2}$/.test(competenzaRaw) ? competenzaRaw : competenzaDaIso(data);
  const trimestre = /^20\d{2}-Q[1-4]$/.test(trimestreRaw) ? trimestreRaw : trimestreDaIso(data);
  if (!data && importo === 0 && !competenza && !trimestre) return null;
  return {
    id: typeof r.id === "string" ? r.id : "",
    data,
    competenza,
    trimestre,
    fonte: tipo,
    importo,
    stato: parseFonteStato(r.stato),
    note: typeof r.note === "string" ? sanitizeCsvText(r.note, 300) : "",
  };
}

export function hydrateFonteSnapshots(raw: unknown): FonteSnapshot[] {
  if (!Array.isArray(raw)) return [];
  const out: FonteSnapshot[] = [];
  for (const row of raw) {
    const n = normalizzaFonteSnapshot(row);
    if (n) out.push(n);
  }
  return out;
}

export function hydrateFonteContributi(raw: unknown): FonteContributo[] {
  if (!Array.isArray(raw)) return [];
  const out: FonteContributo[] = [];
  for (const row of raw) {
    const n = normalizzaFonteContributo(row);
    if (n) out.push(n);
  }
  return out;
}

export function applyFonteSnapshotToPatrimonio(
  p: Patrimonio,
  snap: FonteSnapshot,
): Patrimonio {
  const posizione = fontePosizione(snap.numeroQuote, snap.valoreQuota);
  const attesa = asFiniteNonNeg(p.fonteAttesa);
  return {
    ...p,
    fonteInvestito: posizione,
    fonteTotale: money2(posizione + attesa),
  };
}

/** Ultimo snapshot rimosso: azzera investito; totale = solo attesa (niente orphan stock). */
export function clearFontePosizioneFromPatrimonio(p: Patrimonio): Patrimonio {
  const attesa = asFiniteNonNeg(p.fonteAttesa);
  return {
    ...p,
    fonteInvestito: 0,
    fonteTotale: money2(attesa),
  };
}

export type FonteBreakdown = {
  lavoratore: number;
  datore: number;
  tfr: number;
  volontario: number;
  altro: number;
  totale: number;
  atteso: number;
  accreditato: number;
  quotato: number;
  lastData: string;
};

export function fonteBreakdown(contributi: FonteContributo[]): FonteBreakdown {
  const z: FonteBreakdown = {
    lavoratore: 0,
    datore: 0,
    tfr: 0,
    volontario: 0,
    altro: 0,
    totale: 0,
    atteso: 0,
    accreditato: 0,
    quotato: 0,
    lastData: "",
  };
  for (const c of contributi) {
    const n = asFiniteNonNeg(c.importo);
    z[c.fonte] += n;
    z.totale += n;
    z[c.stato] += n;
    if (c.data && isIsoDate(c.data) && c.data > z.lastData) z.lastData = c.data;
  }
  z.lavoratore = money2(z.lavoratore);
  z.datore = money2(z.datore);
  z.tfr = money2(z.tfr);
  z.volontario = money2(z.volontario);
  z.altro = money2(z.altro);
  z.totale = money2(z.totale);
  z.atteso = money2(z.atteso);
  z.accreditato = money2(z.accreditato);
  z.quotato = money2(z.quotato);
  return z;
}

export function fonteLastUpdate(
  snapshots: FonteSnapshot[],
  contributi: FonteContributo[],
): string {
  let max = "";
  for (const s of snapshots) {
    if (s.data && isIsoDate(s.data) && s.data > max) max = s.data;
  }
  for (const c of contributi) {
    if (c.data && isIsoDate(c.data) && c.data > max) max = c.data;
  }
  return max;
}

export function latestFonteSnapshot(snapshots: FonteSnapshot[]): FonteSnapshot | null {
  if (!snapshots.length) return null;
  return [...snapshots].sort((a, b) => {
    const da = isIsoDate(a.data) ? a.data : "";
    const db = isIsoDate(b.data) ? b.data : "";
    if (da !== db) return db.localeCompare(da);
    return (b.id || "").localeCompare(a.id || "");
  })[0] ?? null;
}

export function fonteContributoDupKey(
  c: Pick<FonteContributo, "data" | "fonte" | "importo" | "competenza" | "trimestre">,
): string {
  const d = isoData(c.data);
  const comp = (c.competenza || competenzaDaIso(d) || c.trimestre || "").toLowerCase();
  return `${d}|${c.fonte}|${asFiniteNonNeg(c.importo).toFixed(2)}|${comp}`;
}

export function fonteSnapshotDupKey(
  s: Pick<FonteSnapshot, "data" | "comparto" | "numeroQuote" | "valoreQuota">,
): string {
  return `${isoData(s.data)}|${s.comparto}|${asFiniteNonNeg(s.numeroQuote)}|${asFiniteNonNeg(s.valoreQuota)}`;
}

export function partizionaFonteContributi(
  parsed: FonteContributo[],
  existing: FonteContributo[],
): { nuovi: FonteContributo[]; duplicati: FonteContributo[] } {
  const seen = new Set(existing.map(fonteContributoDupKey));
  const nuovi: FonteContributo[] = [];
  const duplicati: FonteContributo[] = [];
  const inFile = new Set<string>();
  for (const c of parsed) {
    const k = fonteContributoDupKey(c);
    if (seen.has(k) || inFile.has(k)) {
      duplicati.push(c);
      continue;
    }
    inFile.add(k);
    nuovi.push(c);
  }
  return { nuovi, duplicati };
}

export function partizionaFonteSnapshots(
  parsed: FonteSnapshot[],
  existing: FonteSnapshot[],
): { nuovi: FonteSnapshot[]; duplicati: FonteSnapshot[] } {
  const seen = new Set(existing.map(fonteSnapshotDupKey));
  const nuovi: FonteSnapshot[] = [];
  const duplicati: FonteSnapshot[] = [];
  const inFile = new Set<string>();
  for (const s of parsed) {
    const k = fonteSnapshotDupKey(s);
    if (seen.has(k) || inFile.has(k)) {
      duplicati.push(s);
      continue;
    }
    inFile.add(k);
    nuovi.push(s);
  }
  return { nuovi, duplicati };
}

function splitLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQ = !inQ;
      }
      continue;
    }
    if (ch === sep && !inQ) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function detectSep(line: string): ";" | "," | "\t" {
  let semi = 0;
  let comma = 0;
  let tab = 0;
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQ = !inQ;
      continue;
    }
    if (inQ) continue;
    if (ch === ";") semi++;
    if (ch === ",") comma++;
    if (ch === "\t") tab++;
  }
  if (tab > semi && tab > comma) return "\t";
  return semi >= comma ? ";" : ",";
}

function normHeader(h: string): string {
  return h.toLowerCase().replace(/\s+/g, "_").replace(/[^\w]/g, "");
}

function headerIdx(headers: string[], cands: string[]): number {
  const n = headers.map(normHeader);
  return n.findIndex((h) => cands.some((c) => h === c || h.includes(c)));
}

export type FonteCsvResult = {
  snapshots: FonteSnapshot[];
  contributi: FonteContributo[];
  saltate: number;
  motivi: string[];
};

export function parseFonteCsv(text: string): FonteCsvResult {
  const raw = text.replace(/^\uFEFF/, "").trim();
  if (!raw) return { snapshots: [], contributi: [], saltate: 0, motivi: ["File vuoto"] };
  const lines = raw.split(/\r\n|\n|\r/).filter((l) => l.trim());
  if (!lines.length) return { snapshots: [], contributi: [], saltate: 0, motivi: ["Nessuna riga"] };

  const sep = detectSep(lines[0]);
  const first = splitLine(lines[0], sep).map((h) => h.toLowerCase());
  const looksHeader =
    first.some((h) => h.includes("data")) &&
    first.some(
      (h) =>
        h.includes("comparto") ||
        h.includes("quote") ||
        h.includes("contribut") ||
        h.includes("importo"),
    );
  const start = looksHeader ? 1 : 0;
  const headers = looksHeader ? splitLine(lines[0], sep) : [];
  const iData = looksHeader ? headerIdx(headers, ["data", "date"]) : 0;
  const iComp = looksHeader ? headerIdx(headers, ["comparto", "line", "compartiment"]) : 1;
  const iQuote = looksHeader
    ? headerIdx(headers, ["numero_quote", "numeroquote", "nquote", "quote"])
    : 2;
  const iNav = looksHeader
    ? headerIdx(headers, ["valore_quota", "valorequota", "nav", "quota"])
    : 3;
  const iTipo = looksHeader
    ? headerIdx(headers, ["tipo_contributo", "tipocontributo", "tipo", "fonte"])
    : 4;
  const iImp = looksHeader ? headerIdx(headers, ["importo", "amount"]) : 5;
  const iStato = looksHeader ? headerIdx(headers, ["stato", "status"]) : 6;
  const iNote = looksHeader ? headerIdx(headers, ["note", "nota"]) : 7;

  const snapshots: FonteSnapshot[] = [];
  const contributi: FonteContributo[] = [];
  let saltate = 0;
  let noDate = 0;
  let noUseful = 0;
  let bad = 0;

  for (let r = start; r < lines.length; r++) {
    const cols = splitLine(lines[r], sep);
    if (cols.every((c) => !c)) {
      saltate++;
      continue;
    }
    const data = isoData(iData >= 0 ? (cols[iData] ?? "") : "");
    if (!isIsoDate(data)) {
      noDate++;
      saltate++;
      continue;
    }
    const { comparto, custom } = parseFonteComparto(iComp >= 0 ? (cols[iComp] ?? "") : "");
    const quoteRaw = iQuote >= 0 ? (cols[iQuote] ?? "").trim() : "";
    const navRaw = iNav >= 0 ? (cols[iNav] ?? "").trim() : "";
    const tipoRaw = iTipo >= 0 ? (cols[iTipo] ?? "") : "";
    const impRaw = iImp >= 0 ? (cols[iImp] ?? "").trim() : "";
    const statoRaw = iStato >= 0 ? (cols[iStato] ?? "") : "";
    const note = iNote >= 0 ? sanitizeCsvText(cols[iNote] ?? "", 300) : "";
    const hasQuote = quoteRaw !== "" && /\d/.test(quoteRaw);
    const hasNav = navRaw !== "" && /\d/.test(navRaw);
    const tipo = parseFonteTipo(tipoRaw);
    const hasImp = impRaw !== "" && /\d/.test(impRaw);
    let used = false;

    if (hasQuote && hasNav) {
      snapshots.push(
        buildFonteSnapshot({
          data,
          comparto,
          compartoCustom: custom,
          numeroQuote: asFiniteNonNeg(parseFonteQty(quoteRaw)),
          valoreQuota: asFiniteNonNeg(parseFonteQty(navRaw)),
          fonte: "csv",
        }),
      );
      used = true;
    } else if (hasQuote || hasNav) {
      bad++;
      saltate++;
    }

    if (tipo && hasImp) {
      contributi.push({
        id: "",
        data,
        competenza: competenzaDaIso(data),
        trimestre: trimestreDaIso(data),
        fonte: tipo,
        importo: asFiniteNonNeg(parseAmount(impRaw)),
        stato: parseFonteStato(statoRaw),
        note,
      });
      used = true;
    } else if (hasImp && !tipo && !hasQuote && !hasNav) {
      bad++;
      saltate++;
    }

    if (!used && !(hasQuote || hasNav || hasImp || tipo)) {
      noUseful++;
      saltate++;
    }
  }

  const motivi: string[] = [];
  if (noDate) motivi.push(`${noDate} ${noDate === 1 ? "riga" : "righe"} senza data valida`);
  if (bad) motivi.push(`${bad} ${bad === 1 ? "riga incompleta" : "righe incomplete"} (mancano quote e valore, o il tipo di versamento)`);
  if (noUseful) motivi.push(`${noUseful} ${noUseful === 1 ? "riga vuota" : "righe vuote"}`);
  if (!snapshots.length && !contributi.length && !motivi.length) motivi.push("Nessuna riga utile");
  return { snapshots, contributi, saltate, motivi };
}

export type FonteQuotaPubblica = {
  comparto: FonteComparto;
  valore: number;
  periodo: string;
  anno: number;
  mese: number;
};

const MONTH_RE = new RegExp(
  `\\b(${MESI_IT.join("|")})\\s+(\\d{1,3}[,.]\\d{2,4})\\b`,
  "gi",
);

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseFonteQuotaHtml(
  html: string,
  hint: FonteComparto = "dinamico",
): FonteQuotaPubblica | null {
  if (typeof html !== "string" || !html.trim()) return null;
  const text = stripHtml(html);
  if (!text) return null;
  const yearHits = [...text.matchAll(/\b(20\d{2})\b/g)];
  let best: FonteQuotaPubblica | null = null;

  const consider = (anno: number, chunk: string) => {
    MONTH_RE.lastIndex = 0;
    const m = MONTH_RE.exec(chunk);
    if (!m) return;
    const meseNome = m[1].toLowerCase();
    const mese = MESI_IT.indexOf(meseNome) + 1;
    const valore = asFiniteNonNeg(parseFonteQty(m[2]));
    if (!(valore >= 5 && valore <= 80) || mese < 1) return;
    const cand: FonteQuotaPubblica = {
      comparto: hint,
      valore,
      periodo: `${m[1][0].toUpperCase()}${m[1].slice(1)} ${anno}`,
      anno,
      mese,
    };
    if (!best || cand.anno > best.anno || (cand.anno === best.anno && cand.mese > best.mese)) {
      best = cand;
    }
  };

  if (yearHits.length) {
    for (let i = 0; i < yearHits.length; i++) {
      const anno = Number(yearHits[i][1]);
      const from = yearHits[i].index ?? 0;
      const to = i + 1 < yearHits.length ? (yearHits[i + 1].index ?? text.length) : text.length;
      if (anno < 2000 || anno > 2100) continue;
      consider(anno, text.slice(from, Math.min(to, from + 400)));
    }
  }
  if (!best) consider(new Date().getFullYear(), text);
  return best;
}

export type FonteQuotaErrorKind = "cors" | "offline" | "parse" | "empty";

export class FonteQuotaError extends Error {
  readonly kind: FonteQuotaErrorKind;
  constructor(kind: FonteQuotaErrorKind, message: string) {
    super(message);
    this.name = "FonteQuotaError";
    this.kind = kind;
  }
}

export function italianFonteQuotaError(kind: FonteQuotaErrorKind): string {
  switch (kind) {
    case "cors":
      return "Il sito del fondo non si lascia leggere da qui. Aprilo con «Apri il sito» e scrivi tu il valore.";
    case "offline":
      return "Niente connessione, o il sito del fondo non risponde. Scrivi tu il valore della quota.";
    case "parse":
      return "Ho aperto il sito del fondo ma non trovo il valore. Scrivilo tu, copiandolo dalla pagina.";
    case "empty":
      return "Sul sito del fondo non c'è ancora il valore. Scrivilo tu.";
    default:
      return "Valore della quota non disponibile adesso.";
  }
}

export async function fetchFonteQuotaUfficiale(
  comparto: FonteComparto,
): Promise<FonteQuotaPubblica> {
  const url = FONTE_QUOTA_URL[comparto];
  if (!url) throw new FonteQuotaError("empty", "Comparto custom: niente pagina ufficiale.");
  let res: Response;
  try {
    res = await fetch(url, { method: "GET", mode: "cors", credentials: "omit" });
  } catch {
    throw new FonteQuotaError("cors", italianFonteQuotaError("cors"));
  }
  if (!res.ok) throw new FonteQuotaError("offline", italianFonteQuotaError("offline"));
  let html = "";
  try {
    html = await res.text();
  } catch {
    throw new FonteQuotaError("offline", italianFonteQuotaError("offline"));
  }
  const parsed = parseFonteQuotaHtml(html, comparto);
  if (!parsed) throw new FonteQuotaError("parse", italianFonteQuotaError("parse"));
  return parsed;
}

export type FontePdfExtract = {
  snapshot: Omit<FonteSnapshot, "id"> | null;
  contributi: Omit<FonteContributo, "id">[];
  confidence: "alta" | "bassa" | "nessuna";
  avvisi: string[];
};

function findNearAmount(text: string, labels: RegExp[], qty = false): number | null {
  for (const lab of labels) {
    // La prima alternativa non può spezzare le cifre: «4051,2345» non si ferma a «405».
    // Un intero senza decimali vale lo stesso.
    const re = new RegExp(
      lab.source + "[\\s:=]*([€]?\\s*\\d{1,3}(?:[.\\s]\\d{3})*(?:[,.]\\d+)?(?!\\d)|\\d+[,.]\\d+|\\d+)",
      lab.flags.includes("i") ? "i" : lab.flags,
    );
    const m = text.match(re);
    if (m?.[1]) {
      const n = qty ? parseFonteQty(m[1]) : parseAmount(m[1]);
      if (Number.isFinite(n) && n > 0) return Math.abs(n);
    }
  }
  return null;
}

function findDateInText(text: string): string {
  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso && isIsoDate(iso[1])) return iso[1];
  const it = text.match(/\b(\d{1,2})[./](\d{1,2})[./](20\d{2})\b/);
  if (it) {
    const d = isoData(`${it[1]}/${it[2]}/${it[3]}`);
    if (isIsoDate(d)) return d;
  }
  const long = text.match(
    new RegExp(`\\b(\\d{1,2})\\s+(${MESI_IT.join("|")})\\s+(20\\d{2})\\b`, "i"),
  );
  if (long) {
    const mese = MESI_IT.indexOf(long[2].toLowerCase()) + 1;
    const d = `${long[3]}-${String(mese).padStart(2, "0")}-${String(Number(long[1])).padStart(2, "0")}`;
    if (isIsoDate(d)) return d;
  }
  return "";
}

export function parseFontePdfText(text: string): FontePdfExtract {
  const avvisi: string[] = [];
  const t = typeof text === "string" ? text.replace(/\s+/g, " ").trim() : "";
  if (!t) {
    return {
      snapshot: null,
      contributi: [],
      confidence: "nessuna",
      avvisi: ["Questo PDF non ha testo da leggere (forse è una scansione). Scrivi i numeri a mano o usa la tabella CSV."],
    };
  }

  const data = findDateInText(t);
  // Solo le parole chiave della linea: mai il testo grezzo del PDF come nome.
  const { comparto, custom } = /garant|conserv|svilup|bilanc|cresc|dinam/i.test(t)
    ? parseFonteComparto(t.match(/garant\w*|conserv\w*|svilup\w*|bilanc\w*|cresc\w*|dinam\w*/i)?.[0] ?? "")
    : { comparto: "custom" as FonteComparto, custom: "" };
  const numeroQuote = findNearAmount(t, [
    /n(?:umero|\.)?\s*quote/i,
    /quote\s+(?:n(?:umero|\.)?|assegnate|in\s+essere)/i,
    /n°\s*quote/i,
  ], true);
  const valoreQuota = findNearAmount(t, [
    /valore\s+(?:della\s+)?quota/i,
    /quota\s+unitaria/i,
    /nav/i,
  ], true);
  const posizioneRaw = findNearAmount(t, [
    /posizione\s+(?:individuale|complessiva)?/i,
    /montante/i,
    /importo\s+posizione/i,
  ]);

  let snapshot: Omit<FonteSnapshot, "id"> | null = null;
  let confidence: FontePdfExtract["confidence"] = "nessuna";

  if (numeroQuote != null && valoreQuota != null) {
    snapshot = buildFonteSnapshot({
      data: data || "",
      comparto,
      compartoCustom: custom,
      numeroQuote,
      valoreQuota,
      fonte: "pdf",
    });
    confidence = data ? "alta" : "bassa";
    if (!data) avvisi.push("Nel PDF non c'è la data: scrivila prima di salvare.");
    if (posizioneRaw != null) {
      const calc = fontePosizione(numeroQuote, valoreQuota);
      if (Math.abs(calc - posizioneRaw) > 1) {
        avvisi.push(
          `Il totale scritto nel PDF (${posizioneRaw.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €) non torna con quote × valore (${calc.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €): uso quote × valore, controlla prima di salvare.`,
        );
        confidence = "bassa";
      }
    }
  } else if (posizioneRaw != null && (numeroQuote != null || valoreQuota != null)) {
    avvisi.push("Ho trovato il totale ma non il numero di quote o il valore della quota: non li invento, scrivili tu.");
    confidence = "bassa";
  } else {
    avvisi.push(
      "Non trovo con sicurezza numero di quote e valore della quota. Scrivi i numeri a mano o usa la tabella CSV.",
    );
  }

  const contributi: Omit<FonteContributo, "id">[] = [];
  const pairs: [FonteContributoTipo, RegExp[]][] = [
    ["lavoratore", [/contributo\s+lavoratore/i, /quota\s+lavoratore/i, /aderente/i]],
    ["datore", [/contributo\s+datore/i, /quota\s+datore/i, /azienda/i]],
    ["tfr", [/\bTFR\b/i, /trattamento\s+di\s+fine\s+rapporto/i]],
    ["volontario", [/volontar/i]],
  ];
  for (const [tipo, labs] of pairs) {
    const n = findNearAmount(t, labs);
    if (n != null && n > 0) {
      contributi.push({
        data: data || "",
        competenza: competenzaDaIso(data),
        trimestre: trimestreDaIso(data),
        fonte: tipo,
        importo: money2(n),
        stato: "accreditato",
        note: "Da PDF (da confermare)",
      });
    }
  }

  if (contributi.length && confidence === "nessuna") confidence = "bassa";
  if (!snapshot && !contributi.length && !avvisi.length) {
    avvisi.push("Niente da salvare in questo PDF. Scrivi i numeri a mano o usa la tabella CSV.");
  }
  return { snapshot, contributi, confidence, avvisi };
}

export function fonteCsvFilename(): string {
  return "fonte-modello.csv";
}
