import { isoData } from "./banca";
import { competenzaMese, type Fissa } from "./quadra";

/**
 * Una riga del piano di ammortamento, come la dà la banca.
 * n numero rata · d data · c quota capitale · i interessi · r addebito · k debito residuo dopo la rata · p pagata.
 */
export type RataPiano = {
  n: number;
  d: string;
  c: number;
  i: number;
  r: number;
  k: number;
  p: boolean;
};

export function yyyymm(iso: string): string {
  const d = isoData(iso);
  // Pad 2026-9-5 → 2026-09 so rataInMese matches piano keys.
  return /^\d{4}-\d{2}/.test(d) ? d.slice(0, 7) : iso.slice(0, 7);
}

export function rataInMese(piano: RataPiano[], iso: string): RataPiano | undefined {
  const m = yyyymm(iso);
  return piano.find((x) => x.d.startsWith(m));
}

/** Il piano sta dentro la spesa fissa: niente piano nel codice, niente piano per id. */
export function pianoDi(f: Fissa | undefined | null): RataPiano[] | null {
  return f && Array.isArray(f.piano) && f.piano.length > 0 ? f.piano : null;
}

export function rataDi(f: Fissa | undefined | null, iso: string): RataPiano | undefined {
  const p = pianoDi(f);
  return p ? rataInMese(p, iso) : undefined;
}

/** Addebito di cassa − (capitale + interessi). Alcune banche lasciano qualche euro di spese nella rata. */
export function deltaAddebito(r: RataPiano): number {
  return Math.round((r.r - r.c - r.i) * 100) / 100;
}

/** True when piano i+c matches addebito (within 1 cent). */
export function splitChiude(r: RataPiano): boolean {
  return Math.abs(deltaAddebito(r)) < 0.015;
}

/** True se la fissa ha un piano di ammortamento caricato. */
export function hasPiano(f: Fissa | undefined | null): boolean {
  return pianoDi(f) !== null;
}

/** Con un piano la rata è sempre mensile e sempre debito (annuale dividerebbe per 12 la rata). */
export function healPianoFissa(f: Fissa): Fissa {
  if (!hasPiano(f)) return f;
  return { ...f, frequenza: "mensile", categoria: "debito" };
}

/**
 * Rata di cassa del mese dal piano.
 * Non invento: se manca la riga, resta l’importo scritto nella spesa.
 */
export function fissaConPiano(f: Fissa, iso: string): Fissa {
  if (!hasPiano(f)) return f;
  const r = rataDi(f, iso);
  if (!r) return { ...f, frequenza: "mensile" };
  return { ...f, importo: r.r, frequenza: "mensile" };
}

/** Debito per il tetto banca: categoria debito, oppure piano collegato (anche se rietichettata). */
export function isDebitoFissa(f: Fissa): boolean {
  return f.categoria === "debito" || hasPiano(f);
}

export function totaleFisseAl(fisse: Fissa[], iso: string): number {
  return fisse.reduce((s, f) => s + competenzaMese(fissaConPiano(f, iso)), 0);
}

export function ultimaPagata(piano: RataPiano[]): RataPiano | undefined {
  let last: RataPiano | undefined;
  for (const r of piano) {
    if (r.p) last = r;
  }
  return last;
}

function oggiIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Ultima rata già addebitata a una data. Conta la data della rata, non il flag
 * «pagata» salvato al giorno dell'import: il piano va avanti da solo.
 */
export function ultimaPagataAl(piano: RataPiano[], iso = oggiIso()): RataPiano | undefined {
  const giorno = isoData(iso);
  let last: RataPiano | undefined;
  for (const r of piano) {
    if (r.p || isoData(r.d) <= giorno) last = r;
  }
  return last;
}

/** Quanto devi ancora oggi secondo il piano. */
export function residuoAl(piano: RataPiano[], iso = oggiIso()): number {
  const u = ultimaPagataAl(piano, iso);
  return u ? Math.max(0, u.k) : erogatoPiano(piano);
}

/** Le rate che devono ancora arrivare. */
export function rateFuture(piano: RataPiano[], iso = oggiIso()): RataPiano[] {
  const u = ultimaPagataAl(piano, iso);
  const idx = u ? piano.indexOf(u) : -1;
  return piano.slice(idx + 1);
}

/** Quanto è stato erogato: debito dopo la prima rata + capitale della prima rata. */
export function erogatoPiano(piano: RataPiano[]): number {
  const first = piano[0];
  return first ? Math.round((first.k + first.c) * 100) / 100 : 0;
}

export function interessiAnnoPiano(piano: RataPiano[], year: number): number {
  const y = String(year);
  return piano.filter((r) => r.d.startsWith(y)).reduce((s, r) => s + r.i, 0);
}

export function capitaleAnnoPiano(piano: RataPiano[], year: number): number {
  const y = String(year);
  return piano.filter((r) => r.d.startsWith(y)).reduce((s, r) => s + r.c, 0);
}

/** Hydrate: righe piano malformate fuori, il resto resta. */
export function normalizzaPiano(raw: unknown): RataPiano[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const ok = raw.filter(
    (r): r is RataPiano =>
      !!r &&
      typeof r === "object" &&
      typeof (r as RataPiano).d === "string" &&
      Number.isFinite((r as RataPiano).r) &&
      Number.isFinite((r as RataPiano).c) &&
      Number.isFinite((r as RataPiano).i) &&
      Number.isFinite((r as RataPiano).k),
  );
  return ok.length ? ok.map((r) => ({ ...r, p: !!r.p })) : undefined;
}
