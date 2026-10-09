import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function eur(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    // In it-IT «1070 €» resta senza punto: le app delle banche scrivono «1.070 €».
    useGrouping: "always",
  } as unknown as Intl.NumberFormatOptions).format(n);
}

export function pct(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("it-IT", {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

export function money(n: number, hidden: boolean, digits = 2): string {
  return hidden ? "••••" : eur(n, digits);
}

export const MESI_IT = [
  "Gen",
  "Feb",
  "Mar",
  "Apr",
  "Mag",
  "Giu",
  "Lug",
  "Ago",
  "Set",
  "Ott",
  "Nov",
  "Dic",
];

export function labelMese(yyyymm: string): string {
  const m = Number(yyyymm.slice(5, 7));
  const y = yyyymm.slice(0, 4);
  return `${MESI_IT[m - 1] ?? yyyymm} ${y.slice(2)}`;
}

/** «1 spesa», «3 spese»: il numero accordato al nome. */
export function plurale(n: number, uno: string, tanti: string): string {
  return `${n.toLocaleString("it-IT")} ${n === 1 ? uno : tanti}`;
}

const MESI_LUNGHI = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];

/** «2025-Q4» → «4º trimestre 2025», «2026-08» → «agosto 2026». Il dato salvato non cambia. */
export function periodoLeggibile(s: string | undefined | null): string {
  const t = (s ?? "").trim();
  const q = t.match(/^(\d{4})-?Q([1-4])$/i);
  if (q) return `${q[2]}º trimestre ${q[1]}`;
  const m = t.match(/^(\d{4})-(\d{2})$/);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return `${MESI_LUNGHI[Number(m[2]) - 1]} ${m[1]}`;
  return t;
}
