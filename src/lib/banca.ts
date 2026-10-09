import {
  classifica,
  merchantKey,
  type Regola,
} from "./categorie";

export type Movimento = {
  data: string;
  descrizione: string;
  importo: number;
  segno: "uscita" | "entrata";
};

export type MovimentoManuale = Movimento & { id: string; cat: string; archiviato?: boolean };

export function isoData(s: string): string {
  const t = s.trim();
  // Padded ISO (optional time): 2026-09-05 or 2026-09-05T12:00:00
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  // Unpadded ISO: 2026-9-5 / 2026-09-5 / 2026-9-05(+time)
  const up = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[Tt\s].*)?$/);
  if (up) {
    return `${up[1]}-${up[2].padStart(2, "0")}-${up[3].padStart(2, "0")}`;
  }
  // YMD with / or . (exports): 2026/09/12 · 2026.9.5
  const ymd = t.match(/^(\d{4})[./](\d{1,2})[./](\d{1,2})(?:[Tt\s].*)?$/);
  if (ymd) {
    return `${ymd[1]}-${ymd[2].padStart(2, "0")}-${ymd[3].padStart(2, "0")}`;
  }
  const m = t.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m) {
    return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return t;
}

/** True only for real calendar days (rejects 2026-02-31, 2025-02-29, month 13…). */
export function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function monthStart(iso: string): string {
  const d = isoData(iso);
  // isoData pads 2026-9-5 → 2026-09-05; avoid slice producing "2026-9--01".
  return /^\d{4}-\d{2}/.test(d) ? `${d.slice(0, 7)}-01` : d;
}

export function addDaysIso(iso: string, n: number): string {
  const base = isoData(iso);
  if (!isIsoDate(base)) return todayIso();
  const [y, m, d] = base.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export function prevMonthRange(today: string): { dal: string; al: string } {
  const base = isoData(today);
  const ref = isIsoDate(base) ? base : todayIso();
  const [y, m] = ref.split("-").map(Number);
  const last = new Date(y, m - 1, 0);
  const py = last.getFullYear();
  const pm = last.getMonth() + 1;
  return {
    dal: `${py}-${String(pm).padStart(2, "0")}-01`,
    al: `${py}-${String(pm).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`,
  };
}

export function inRange(data: string, dal: string, al: string): boolean {
  const d = isoData(data);
  // Garbage / non-calendar (2026-02-31) must not match lexicographic ranges.
  if (!isIsoDate(d)) return false;
  let a = isoData(dal);
  let b = isoData(al);
  if (!isIsoDate(a) || !isIsoDate(b)) return false;
  if (a > b) [a, b] = [b, a];
  return d >= a && d <= b;
}

export function giorniNelPeriodo(dal: string, al: string): number {
  const a = isoData(dal);
  const b = isoData(al);
  // Cleared / garbage / non-calendar → 1 (never NaN in UI "X giorni")
  if (!isIsoDate(a) || !isIsoDate(b)) return 1;
  const lo = a <= b ? a : b;
  const hi = a <= b ? b : a;
  const [y1, m1, d1] = lo.split("-").map(Number);
  const [y2, m2, d2] = hi.split("-").map(Number);
  const t1 = new Date(y1, m1 - 1, d1).getTime();
  const t2 = new Date(y2, m2 - 1, d2).getTime();
  if (!Number.isFinite(t1) || !Number.isFinite(t2)) return 1;
  return Math.max(1, Math.round(Math.abs(t2 - t1) / 86400000) + 1);
}

export function extentDate(movimenti: { data: string }[]): { min: string; max: string } {
  let min = "";
  let max = "";
  for (const m of movimenti) {
    const d = isoData(m.data);
    // Ignore garbage / non-calendar so Carta dal–al stay valid type=date values.
    if (!isIsoDate(d)) continue;
    if (!min || d < min) min = d;
    if (!max || d > max) max = d;
  }
  const t = todayIso();
  return { min: min || t, max: max || t };
}

const MESI_IT = [
  "gen",
  "feb",
  "mar",
  "apr",
  "mag",
  "giu",
  "lug",
  "ago",
  "set",
  "ott",
  "nov",
  "dic",
];

export function fmtIt(iso: string): string {
  const d = isoData(iso);
  const parts = d.split("-");
  if (parts.length < 3) return d;
  const m = Number(parts[1]);
  return `${Number(parts[2])} ${MESI_IT[m - 1] ?? parts[1]}`;
}

export type MovimentoClassificato = Movimento & {
  cat: string;
  archiviato?: boolean;
  /** dupKey + numero di occorrenza: distingue due spese identiche lo stesso giorno. */
  rowKey?: string;
  /** Presente se riga da movimentiManuali. */
  manualeId?: string;
};

const NON_VARIABILE = new Set(["fissa", "prelievo", "entrata"]);

export function isVariabile(m: { segno: string; cat: string; archiviato?: boolean }): boolean {
  // Archiviate non entrano in V (Home/Banca Periodo).
  return m.segno === "uscita" && !NON_VARIABILE.has(m.cat) && !m.archiviato;
}

export function movKey(m: { data: string; descrizione: string; importo: number }): string {
  return `${isoData(m.data)}|${m.descrizione}|${m.importo}`;
}

export function dupKey(m: Movimento): string {
  const desc = m.descrizione.trim().toLowerCase().replace(/\s+/g, " ");
  return `${isoData(m.data)}|${desc}|${m.importo.toFixed(2)}|${m.segno}`;
}

export function partizionaCsv(
  parsed: Movimento[],
  existing: Movimento[],
): { nuovi: Movimento[]; duplicati: Movimento[] } {
  const seen = new Set(existing.map(dupKey));
  const nuovi: Movimento[] = [];
  const duplicati: Movimento[] = [];
  const inFile = new Set<string>();
  for (const m of parsed) {
    const k = dupKey(m);
    if (seen.has(k) || inFile.has(k)) {
      duplicati.push(m);
      continue;
    }
    inFile.add(k);
    nuovi.push(m);
  }
  return { nuovi, duplicati };
}

/** Media mensile delle variabili sul periodo dei movimenti. */
export function variabiliMensili(movimenti: MovimentoClassificato[]): {
  tot: number;
  mesi: number;
  mese: number;
} {
  // Ignore non-calendar / garbage dates so they do not inflate mesi or tot (legacy persist).
  const vars = movimenti.filter((m) => isVariabile(m) && isIsoDate(isoData(m.data)));
  const tot = vars.reduce((s, m) => s + m.importo, 0);
  const months = new Set(vars.map((m) => isoData(m.data).slice(0, 7)));
  const mesi = Math.max(1, months.size);
  return { tot, mesi, mese: tot / mesi };
}

export function variabiliPerMese(
  movimenti: MovimentoClassificato[],
): { mese: string; tot: number; n: number }[] {
  const map = new Map<string, { tot: number; n: number }>();
  for (const m of movimenti) {
    if (!isVariabile(m)) continue;
    const d = isoData(m.data);
    if (!isIsoDate(d)) continue;
    const k = d.slice(0, 7);
    const cur = map.get(k) ?? { tot: 0, n: 0 };
    cur.tot += m.importo;
    cur.n += 1;
    map.set(k, cur);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([mese, v]) => ({ mese, tot: v.tot, n: v.n }));
}

export function variabiliNelPeriodo(
  movimenti: MovimentoClassificato[],
  dal: string,
  al: string,
): {
  tot: number;
  n: number;
  giorni: number;
  mediaGiorno: number;
  lista: MovimentoClassificato[];
} {
  const lista = movimenti
    .filter((m) => isVariabile(m) && inRange(m.data, dal, al))
    .sort((a, b) => isoData(b.data).localeCompare(isoData(a.data)));
  const tot = lista.reduce((s, m) => s + m.importo, 0);
  const giorni = giorniNelPeriodo(dal, al);
  return { tot, n: lista.length, giorni, mediaGiorno: tot / giorni, lista };
}

export const GIORNI_MESE = 30.44;

/** V da portare a mese: media/giorno sul periodo reale × 30,44. Non invento mesi vuoti. */
export function vMensile(mediaGiorno: number): number {
  return mediaGiorno * GIORNI_MESE;
}

export function groupByDay(
  movimenti: MovimentoClassificato[],
): { data: string; items: MovimentoClassificato[]; tot: number }[] {
  const map = new Map<string, MovimentoClassificato[]>();
  for (const m of movimenti) {
    const d = isoData(m.data);
    if (!isIsoDate(d)) continue;
    const arr = map.get(d) ?? [];
    arr.push(m);
    map.set(d, arr);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([data, items]) => ({
      data,
      items,
      tot: items.reduce((s, m) => s + m.importo, 0),
    }));
}

/** Importo IT/EN: 1.234,56 · 1234,56 · 1,234.56 · 1,234 · 1.234 · (15,00) · 15,00- trailing. */
export function parseAmount(raw: string): number {
  // Normalizza meno unicode (− U+2212) prima dello strip
  const cleaned = raw
    .trim()
    .replace(/\u2212/g, "-")
    .replace(/\s/g, "")
    .replace(/€/g, "");
  // Contabile: (1.234,56) → negativo (prima di strip parentesi)
  const parenNeg = /^\(.*\)$/.test(cleaned);
  const t = cleaned.replace(/[^\d,.\-+]/g, "");
  if (!t || t === "-" || t === "+" || t === "," || t === ".") return 0;
  // Leading or trailing sign (DE/IT exports: 15,00- / 15,00+)
  const lead = t[0] === "-" || t[0] === "+" ? t[0] : "";
  const trail =
    !lead && (t.endsWith("-") || t.endsWith("+")) ? t.slice(-1) : "";
  const neg = parenNeg || lead === "-" || trail === "-";
  const body = lead ? t.slice(1) : trail ? t.slice(0, -1) : t;
  // Doppio segno / segno residuo → invalido
  if (!body || /[+-]/.test(body)) return 0;
  let n: number;
  if (body.includes(",") && body.includes(".")) {
    // Ultimo separatore = decimali (IT 1.234,56 o EN 1,234.56)
    const lastComma = body.lastIndexOf(",");
    const lastDot = body.lastIndexOf(".");
    if (lastComma > lastDot) {
      n = Number(body.replace(/\./g, "").replace(",", "."));
    } else {
      n = Number(body.replace(/,/g, ""));
    }
  } else if (/^\d{1,3}(,\d{3})+$/.test(body)) {
    // Solo virgole come migliaia EN: 1,234 → 1234 (non 1.234)
    n = Number(body.replace(/,/g, ""));
  } else if (body.includes(",")) {
    // Solo virgola: decimale IT (1,23 / 1,2)
    const parts = body.split(",");
    if (parts.length === 2 && parts[1].length <= 2) {
      n = Number(parts[0].replace(/\./g, "") + "." + parts[1]);
    } else {
      n = Number(body.replace(",", "."));
    }
  } else if (/^\d{1,3}(\.\d{3})+$/.test(body)) {
    // Solo punti come migliaia IT: 1.234 → 1234
    n = Number(body.replace(/\./g, ""));
  } else {
    n = Number(body);
  }
  if (!Number.isFinite(n)) return 0;
  return neg ? -Math.abs(n) : n;
}

/** Split CSV rispettando virgolette (molte banche usano ; e campi tra "). */
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
  // Conta separatori fuori dalle virgolette (TSV banche / Excel)
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


/** Strip control chars from CSV text fields (XSS/layout). React still escapes on render. */
export function sanitizeCsvText(s: string, maxLen = 500): string {
  return s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

/**
 * Colonna Segno / D/C / Dare-Avere (estratto conto IT + ISO 20022).
 * Dare/D/DBIT/addebito → uscita; Avere/C/CRDT/accredito → entrata.
 */
export function parseSegnoCell(raw: string): Movimento["segno"] | null {
  const t = raw
    .trim()
    .replace(/\u2212/g, "-")
    .replace(/\s+/g, "")
    .toLowerCase()
    .replace(/[.]/g, "");
  if (!t) return null;
  if (
    t === "d" ||
    t === "db" ||
    t === "dr" ||
    t === "dbt" ||
    t === "dbit" ||
    t === "debit" ||
    t === "debito" ||
    t === "debits" ||
    t === "dare" ||
    t === "addebito" ||
    t === "addebiti" ||
    t === "uscita" ||
    t === "uscite" ||
    t === "withdrawal" ||
    t === "withdrawals" ||
    t === "-" ||
    t === "-1" ||
    t === "neg" ||
    t === "negative"
  ) {
    return "uscita";
  }
  if (
    t === "c" ||
    t === "cr" ||
    t === "crd" ||
    t === "crdt" ||
    t === "credit" ||
    t === "credito" ||
    t === "credits" ||
    t === "avere" ||
    t === "a" ||
    t === "accredito" ||
    t === "accrediti" ||
    t === "entrata" ||
    t === "entrate" ||
    t === "deposit" ||
    t === "deposits" ||
    t === "+" ||
    t === "+1"
  ) {
    return "entrata";
  }
  return null;
}

function normHeader(h: string): string {
  return h.toLowerCase().replace(/\s+/g, "");
}

/** Header della colonna indicatore, non un importo (evita che "dare/avere" finisca in Addebiti). */
function isSegnoHeader(h: string): boolean {
  const n = normHeader(h);
  if (!n) return false;
  if (
    n === "segno" ||
    n === "sign" ||
    n === "d/c" ||
    n === "c/d" ||
    n === "dc" ||
    n === "cd" ||
    n === "d-c" ||
    n === "c-d" ||
    n === "segnoperazione" ||
    n === "segnooperazione" ||
    n === "segnomovimento" ||
    n === "signoperation"
  ) {
    return true;
  }
  return (
    n.includes("dare/avere") ||
    n.includes("avere/dare") ||
    n.includes("dare-avere") ||
    n.includes("uscita/entrata") ||
    n.includes("entrata/uscita") ||
    n.includes("uscite/entrate") ||
    n.includes("entrate/uscite") ||
    n.includes("credit/debit") ||
    n.includes("debit/credit") ||
    n.includes("creditdebit") ||
    n.endsWith("d/c") ||
    n.endsWith("c/d")
  );
}

type ColIdx = {
  iData: number;
  iDesc: number;
  iAddebito: number;
  iAccredito: number;
  iImporto: number;
  iSegno: number;
};

/** True for a pure amount cell (incl. 0,00 / € 0 / EUR 0 / (0,00)), not free text with digits. */
function looksLikeAmountCell(raw: string): boolean {
  const t = raw.trim();
  if (!t || !/\d/.test(t)) return false;
  // Letters / * / # → description / card mask, not Importo column.
  // ISO currency codes stripped so "EUR 12,34" still counts as amount.
  const stripped = t
    .replace(/\u2212/g, "-")
    .replace(/\b(?:EUR|USD|CHF|GBP)\b/gi, "")
    .replace(/[€$\s.,'+\-()]/g, "");
  return /^\d+$/.test(stripped);
}

/** Prefer decimal money (12,34 / 0,00) over bare integers (ref/ID) when scoring Importo. */
function amountCellScore(raw: string): number {
  if (!looksLikeAmountCell(raw)) return -1;
  const t = raw.trim();
  // 12,34 / 0,00 / (15,00) / 3.50- → real money (beats long numeric refs).
  if (/[,.]\d{1,2}\s*[)\-+]?\s*$/.test(t) || /^\(.*\)$/.test(t)) return 3;
  if (/[,.]/.test(t)) return 2;
  const digits = t.replace(/\D/g, "");
  // Short integers can be whole euros; long digit runs are usually IDs / refs.
  if (digits.length <= 6) return 1;
  return 0;
}

function inferHeaderlessCols(cols: string[]): ColIdx | null {
  let iData = -1;
  let iImporto = -1;
  let iSegno = -1;
  let bestAmount = -1;
  for (let i = 0; i < cols.length; i++) {
    const cell = cols[i] ?? "";
    if (iData < 0 && isIsoDate(isoData(cell))) {
      iData = i;
      continue;
    }
    if (iSegno < 0 && parseSegnoCell(cell) !== null && cell.trim().length <= 16) {
      iSegno = i;
      continue;
    }
    // Include explicit zeros; prefer decimal money over bare integer ref/ID columns.
    const score = amountCellScore(cell);
    if (score > bestAmount) {
      bestAmount = score;
      iImporto = i;
    }
  }
  if (iData < 0 || iImporto < 0) return null;
  let iDesc = -1;
  let best = -1;
  for (let i = 0; i < cols.length; i++) {
    if (i === iData || i === iImporto || i === iSegno) continue;
    const cell = (cols[i] ?? "").trim();
    if (!cell) continue;
    // Valuta / saldo / ref must not beat merchant text as descrizione.
    if (isIsoDate(isoData(cell))) continue;
    if (looksLikeAmountCell(cell)) continue;
    // Prefer cells with letters (merchant / causale) over punctuation-only leftovers.
    const letterBonus = /[a-zA-ZàèéìòùÀÈÉÌÒÙ]/u.test(cell) ? 1000 : 0;
    const n = letterBonus + cell.length;
    if (n > best) {
      best = n;
      iDesc = i;
    }
  }
  return { iData, iDesc, iAddebito: -1, iAccredito: -1, iImporto, iSegno };
}

function lineLooksLikeHeader(line: string): boolean {
  const low = line.toLowerCase();
  if (low.includes("descrizione") || low.includes("description") || low.includes("causale")) {
    return true;
  }
  if (
    low.includes("data") &&
    (low.includes("addebit") ||
      low.includes("accredit") ||
      low.includes("importo") ||
      low.includes("amount") ||
      low.includes("uscita") ||
      low.includes("entrata") ||
      low.includes("segno") ||
      low.includes("d/c") ||
      low.includes("dare/avere"))
  ) {
    return true;
  }
  if (low.includes("creditdebit") || low.includes("credit/debit") || low.includes("debit/credit")) {
    return true;
  }
  return false;
}

export type ParseCsvResult = {
  movimenti: Movimento[];
  /** Righe dati saltate (vuote, senza cella importo, senza descrizione, data invalida). Zeri espliciti tenuti. */
  saltate: number;
  /** Motivi aggregati per feedback UI. */
  motivi: string[];
};

export function parseCsvMovimentiDetailed(text: string): ParseCsvResult {
  const raw = text.replace(/^\uFEFF/, "").trim();
  if (!raw) return { movimenti: [], saltate: 0, motivi: ["File vuoto"] };

  // CRLF, LF, or classic Mac CR-only (\r?\n alone leaves a single blob).
  const lines = raw.split(/\r\n|\n|\r/).filter((l) => l.trim());
  if (!lines.length) return { movimenti: [], saltate: 0, motivi: ["Nessuna riga"] };

  const sep = detectSep(lines[0]);

  let headerIdx = 0;
  let headerFound = false;
  for (let i = 0; i < Math.min(lines.length, 40); i++) {
    if (lineLooksLikeHeader(lines[i])) {
      headerIdx = i;
      headerFound = true;
      break;
    }
  }

  let iData = -1;
  let iDesc = -1;
  let iAddebito = -1;
  let iAccredito = -1;
  let iImporto = -1;
  let iSegno = -1;
  let headerless = false;
  let dataStart = 1;

  if (headerFound) {
    const header = splitLine(lines[headerIdx], sep).map((h) => h.toLowerCase());
    const idx = (cands: string[], exclude: number[] = []) =>
      header.findIndex((h, i) => !exclude.includes(i) && cands.some((c) => h.includes(c)));

    iSegno = header.findIndex((h) => isSegnoHeader(h));
    const skip = iSegno >= 0 ? [iSegno] : [];

    iData = idx(["data contabile", "data valuta", "booking date", "value date", "booking", "date", "data"], skip);
    iDesc = idx(["descrizione completa", "descrizione", "description", "causale", "narration", "merchant"], skip);
    iAddebito = idx(["addebiti", "addebit", "debit", "uscita", "dare", "withdrawals"], skip);
    iAccredito = idx(["accrediti", "accredit", "credit", "entrata", "avere", "deposits"], skip);
    iImporto = idx(["importo", "amount", "somma", "transaction amount"], skip);
    dataStart = headerIdx + 1;
  } else {
    // Easy win: no header keywords, first date+amount row dictates columns.
    let inferred: ColIdx | null = null;
    for (let i = 0; i < Math.min(lines.length, 8); i++) {
      inferred = inferHeaderlessCols(splitLine(lines[i], sep));
      if (inferred) break;
    }
    if (inferred) {
      ({ iData, iDesc, iAddebito, iAccredito, iImporto, iSegno } = inferred);
      headerless = true;
      dataStart = 0;
    } else {
      const header = splitLine(lines[0], sep).map((h) => h.toLowerCase());
      const idx = (cands: string[]) => header.findIndex((h) => cands.some((c) => h.includes(c)));
      iData = idx(["data contabile", "data valuta", "booking date", "value date", "booking", "date", "data"]);
      iDesc = idx(["descrizione completa", "descrizione", "description", "causale", "narration", "merchant"]);
      iAddebito = idx(["addebiti", "addebit", "debit", "uscita", "dare", "withdrawals"]);
      iAccredito = idx(["accrediti", "accredit", "credit", "entrata", "avere", "deposits"]);
      iImporto = idx(["importo", "amount", "somma", "transaction amount"]);
      dataStart = 1;
    }
  }

  const out: Movimento[] = [];
  let saltate = 0;
  let noImporto = 0;
  let noDesc = 0;
  let badDate = 0;

  for (let r = dataStart; r < lines.length; r++) {
    const cols = splitLine(lines[r], sep);
    if (cols.every((c) => !c)) {
      saltate++;
      continue;
    }
    const skipDesc = [iData, iImporto, iSegno, iAddebito, iAccredito].filter((i) => i >= 0);
    const desc = sanitizeCsvText(
      iDesc >= 0
        ? (cols[iDesc] ?? "")
        : cols.filter((_, i) => !skipDesc.includes(i)).join(" ") || cols.join(" "),
    );
    if (!desc || desc.toLowerCase().includes("sbilancio")) {
      saltate++;
      noDesc++;
      continue;
    }

    let importo = 0;
    let segno: Movimento["segno"] = "uscita";
    // Explicit numeric cell (incl. 0,00) vs empty — keep real zero rows with date+desc.
    let sawAmount = false;
    if (iAddebito >= 0 || iAccredito >= 0) {
      const rawD = iAddebito >= 0 ? (cols[iAddebito] ?? "") : "";
      const rawC = iAccredito >= 0 ? (cols[iAccredito] ?? "") : "";
      const d = iAddebito >= 0 ? Math.abs(parseAmount(rawD)) : 0;
      const c = iAccredito >= 0 ? Math.abs(parseAmount(rawC)) : 0;
      if (d > 0) {
        importo = d;
        segno = "uscita";
        sawAmount = true;
      } else if (c > 0) {
        importo = c;
        segno = "entrata";
        sawAmount = true;
      } else if (/\d/.test(rawD) || /\d/.test(rawC)) {
        importo = 0;
        sawAmount = true;
        const fromSegno = iSegno >= 0 ? parseSegnoCell(cols[iSegno] ?? "") : null;
        segno = fromSegno ?? (/\d/.test(rawD) ? "uscita" : "entrata");
      }
    } else if (iImporto >= 0) {
      const raw = cols[iImporto] ?? "";
      if (/\d/.test(raw)) {
        const n = parseAmount(raw);
        importo = Math.abs(n);
        sawAmount = true;
        const fromSegno = iSegno >= 0 ? parseSegnoCell(cols[iSegno] ?? "") : null;
        segno = fromSegno ?? (n < 0 ? "uscita" : "entrata");
      }
    }
    if (!sawAmount) {
      saltate++;
      noImporto++;
      continue;
    }

    const dataRaw = iData >= 0 ? cols[iData] ?? "" : "";
    const data = isoData(dataRaw);
    // Unusable / non-calendar date → skip (would poison Carta extent / type=date).
    if (!isIsoDate(data)) {
      saltate++;
      badDate++;
      continue;
    }

    out.push({
      data,
      descrizione: desc,
      importo,
      segno,
    });
  }

  const motivi: string[] = [];
  if (sep === ";") motivi.push("Separatore ; (CSV IT)");
  if (iSegno >= 0) motivi.push("Colonna Segno/D-C");
  if (headerless) motivi.push("CSV senza intestazione");
  if (noImporto) motivi.push(`${noImporto} senza importo`);
  if (noDesc) motivi.push(`${noDesc} senza descrizione`);
  if (badDate) motivi.push(`${badDate} con data non valida`);
  if (!out.length && saltate) motivi.push("Nessun movimento valido");

  return { movimenti: out, saltate, motivi };
}

export function parseCsvMovimenti(text: string): Movimento[] {
  return parseCsvMovimentiDetailed(text).movimenti;
}

export function classificaMovimenti(
  movimenti: Movimento[],
  extra: Regola[] = [],
  nascoste: string[] = [],
  overrides: Record<string, string> = {},
): MovimentoClassificato[] {
  return movimenti.map((m) => {
    const key = movKey(m);
    const forced = overrides[key];
    return {
      ...m,
      cat: forced ?? classifica(m.descrizione, m.segno, extra, nascoste),
    };
  });
}

export function buildClassified(
  csv: Movimento[],
  seed: Movimento[],
  regole: Regola[],
  nascoste: string[],
  manuali: MovimentoManuale[],
  overrides: Record<string, string>,
  movimentiArchiviati: string[] = [],
): MovimentoClassificato[] {
  const archived = new Set(movimentiArchiviati);
  const base = csv.length ? csv : seed;
  // Due spese identiche lo stesso giorno (due caffè da 2,50) hanno la stessa dupKey:
  // archiviarne una archiviava anche l'altra, e V calava del doppio. Serve un numero
  // d'ordine per occorrenza.
  const visti = new Map<string, number>();
  const file = classificaMovimenti(base, regole, nascoste, overrides).map((m) => {
    const k = dupKey(m);
    const n = visti.get(k) ?? 0;
    visti.set(k, n + 1);
    const rowKey = `${k}#${n}`;
    // Chiave vecchia senza numero d'ordine: vale per la prima occorrenza soltanto,
    // altrimenti tornerebbe a trascinarsi dietro le gemelle.
    const archiviato = archived.has(rowKey) || (n === 0 && archived.has(k));
    return { ...m, rowKey, archiviato };
  });
  return [
    ...file,
    ...manuali.map((m) => ({
      data: m.data,
      descrizione: m.descrizione,
      importo: m.importo,
      segno: m.segno,
      cat: m.cat,
      archiviato: !!m.archiviato,
      manualeId: m.id,
    })),
  ];
}

/** True se la riga è archiviata (manuale.flag o dupKey in Set CSV). */
export function isArchiviato(
  m: { archiviato?: boolean; rowKey?: string } | Movimento,
  movimentiArchiviati: string[] = [],
): boolean {
  if ("archiviato" in m && m.archiviato) return true;
  if ("rowKey" in m && typeof m.rowKey === "string" && m.rowKey) {
    return movimentiArchiviati.includes(m.rowKey);
  }
  if ("data" in m && "descrizione" in m && "importo" in m && "segno" in m) {
    // Senza numero d'ordine non si sa quale occorrenza sia: basta che una lo sia.
    const k = dupKey(m as Movimento);
    return movimentiArchiviati.some((x) => x === k || x.startsWith(`${k}#`));
  }
  return false;
}

export { merchantKey };
