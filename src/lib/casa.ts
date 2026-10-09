import type { Fissa, Immobile, Patrimonio, VoceCasa } from "./quadra";
import { VOCI_ANCHE_IN_AFFITTO, VOCI_INQUILINO, competenzaMese, speseAcquistoDaCampi } from "./quadra";
import {
  erogatoPiano,
  fissaConPiano,
  interessiAnnoPiano,
  pianoDi,
  rataDi,
  residuoAl,
  ultimaPagataAl,
} from "./piano";

/** Local calendar date — never UTC (avoids month off-by-one near midnight in EU). */
function localTodayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Patrimonio visto da una casa: i campi della casa più il prezzo al m² della sua zona. */
export type PatrimonioCasa = Patrimonio & { eurMqZona: number };

/**
 * I conti della casa usano la forma del patrimonio. Le spese di acquisto sono
 * una lista: qui tornano i tre numeri che servono alle formule (atto, lavori con
 * bonus, lavori senza bonus), senza cambiare le formule.
 */
export function withImmobile(p: Patrimonio, i: Immobile): PatrimonioCasa {
  const spese = Array.isArray(i.speseAcquisto) ? i.speseAcquisto : speseAcquistoDaCampi(i);
  const somma = (f: (s: (typeof spese)[number]) => boolean) =>
    spese.filter(f).reduce((t, s) => t + (Number.isFinite(s.importo) ? s.importo : 0), 0);
  return {
    ...p,
    valoreCasa: i.valoreCasa,
    mq: i.mq,
    prezzoAcquisto: i.prezzoAcquisto,
    annoAcquisto: i.annoAcquisto,
    affittoEq: i.affittoEq,
    capitaleMutuo: i.capitaleMutuo,
    closingCosts: somma((s) => s.tipo === "atto"),
    capexTetto: somma((s) => s.tipo === "lavori" && s.detraibile),
    capexInfissi: 0,
    capexPorte: somma((s) => s.tipo === "lavori" && !s.detraibile),
    rivalutazionePct: i.rivalutazionePct,
    manutenzionePct: i.manutenzionePct,
    bonusAliquota: i.bonusAliquota,
    bonusQuoteTotali: i.bonusQuoteTotali,
    bonusQuoteGodute: i.bonusQuoteGodute,
    eurMqZona: Number.isFinite(i.eurMqZona) ? Math.max(0, i.eurMqZona ?? 0) : 0,
  };
}

type ConZona = Patrimonio & { eurMqZona?: number };

/** Valore: quello che scrivi tu → m² × prezzo al m² della zona → prezzo pagato. */
export function valoreEffettivo(p: ConZona): number {
  if (p.valoreCasa > 0) return p.valoreCasa;
  const zona = p.eurMqZona ?? 0;
  if (p.mq > 0 && zona > 0) return Math.round(p.mq * zona);
  if (p.prezzoAcquisto > 0) return p.prezzoAcquisto;
  return 0;
}

export function fonteValore(p: ConZona): "mercato" | "mq" | "prezzo" | "" {
  if (p.valoreCasa > 0) return "mercato";
  if (p.mq > 0 && (p.eurMqZona ?? 0) > 0) return "mq";
  if (p.prezzoAcquisto > 0) return "prezzo";
  return "";
}

/** La spesa fissa che è la rata del mutuo di questa casa (se c'è ancora). */
export function fissaMutuoDi(i: Immobile | undefined, fisse: Fissa[]): Fissa | undefined {
  if (!i?.fissaMutuoId) return undefined;
  return fisse.find((f) => f.id === i.fissaMutuoId);
}

/** Capitale già rimborsato: solo col piano della banca. Senza piano non invento. */
export function capitalePagato(mutuo: Fissa | undefined): number {
  const piano = pianoDi(mutuo);
  if (!piano) return 0;
  const last = ultimaPagataAl(piano);
  if (!last) return 0;
  return Math.max(0, Math.round((erogatoPiano(piano) - last.k) * 100) / 100);
}

/** Interessi già pagati, dal piano. Senza piano → 0. */
export function interessiPagati(mutuo: Fissa | undefined): number {
  const piano = pianoDi(mutuo);
  if (!piano) return 0;
  const last = ultimaPagataAl(piano);
  if (!last) return 0;
  return piano.slice(0, piano.indexOf(last) + 1).reduce((s, r) => s + r.i, 0);
}

export function rateMutuoPagate(mutuo: Fissa | undefined): number {
  const piano = pianoDi(mutuo);
  return piano ? (ultimaPagataAl(piano)?.n ?? 0) : 0;
}

/** @deprecated il 20 % è una regola del pollice: usa anticipoVero. */
export function anticipo(p: Patrimonio): number {
  return Math.round(p.prezzoAcquisto * 0.2 * 100) / 100;
}

/**
 * Quanto del prezzo hai pagato di tasca tua. Senza mutuo: tutto. Col piano della
 * banca: prezzo meno quanto ti hanno prestato. Mutuo senza piano: non si sa, e
 * non si inventa un 20 %.
 */
export function anticipoVero(p: Patrimonio, mutuo?: Fissa): number | null {
  const piano = pianoDi(mutuo);
  if (piano) return Math.max(0, Math.round((p.prezzoAcquisto - erogatoPiano(piano)) * 100) / 100);
  if (!(p.capitaleMutuo > 0) && !mutuo) return p.prezzoAcquisto;
  return null;
}

/** Quanto devi ancora sulla casa: dal piano alla data di oggi, altrimenti il debito scritto. */
export function debitoCasa(i: Immobile | undefined, fisse: Fissa[]): number {
  if (!i) return 0;
  const piano = pianoDi(fissaMutuoDi(i, fisse));
  return piano ? residuoAl(piano) : Math.max(0, i.capitaleMutuo || 0);
}

/** Costo pieno: prezzo + notaio/agenzia/imposte + lavori. */
export function costoPieno(p: Patrimonio): number {
  return p.prezzoAcquisto + p.closingCosts + capexTotale(p);
}

/** Soldi tuoi messi finora: quello che hai pagato del prezzo + spese di atto + lavori + capitale del mutuo già restituito. */
export function cassaInvestita(p: Patrimonio, mutuo?: Fissa): number | null {
  const a = anticipoVero(p, mutuo);
  if (a === null) return null;
  return a + p.closingCosts + capexTotale(p) + capitalePagato(mutuo);
}

export function plusvalenza(p: ConZona): number {
  const v = valoreEffettivo(p);
  if (v <= 0) return 0;
  return v - costoPieno(p);
}

export const DETRAZIONE_INTERESSI = 0.19;
export const PLAFOND_INTERESSI = 4000;

export function capexTotale(p: Patrimonio): number {
  return p.capexTetto + p.capexInfissi + p.capexPorte;
}

/** Lavori con bonus fiscale (tetto, infissi sì; porte interne no). */
export function capexDetraibile(p: Patrimonio): number {
  return p.capexTetto + p.capexInfissi;
}

/** Clamp aliquota bonus lavori in [0, 1]. */
export function bonusAliquotaEffettiva(p: Patrimonio): number {
  const a = p.bonusAliquota;
  if (!Number.isFinite(a)) return 0;
  return Math.min(1, Math.max(0, a));
}

export function bonusLavoriTotale(p: Patrimonio): number {
  const capex = Math.max(0, capexDetraibile(p));
  return capex * bonusAliquotaEffettiva(p);
}

export function bonusLavoriResiduo(p: Patrimonio): number {
  if (!(p.bonusQuoteTotali > 0)) return 0;
  const godute = Number.isFinite(p.bonusQuoteGodute) ? Math.max(0, p.bonusQuoteGodute) : 0;
  const left = Math.max(0, p.bonusQuoteTotali - godute);
  return (bonusLavoriTotale(p) / p.bonusQuoteTotali) * left;
}

export function bonusLavoriAnno(p: Patrimonio): number {
  if (!(p.bonusQuoteTotali > 0)) return 0;
  const godute = Number.isFinite(p.bonusQuoteGodute) ? Math.max(0, p.bonusQuoteGodute) : 0;
  if (godute >= p.bonusQuoteTotali) return 0;
  return bonusLavoriTotale(p) / p.bonusQuoteTotali;
}

/** Quote rimanenti da mostrare in UI (mai negative). */
export function bonusQuoteRimanenti(p: Patrimonio): number {
  if (!(p.bonusQuoteTotali > 0)) return 0;
  const godute = Number.isFinite(p.bonusQuoteGodute) ? Math.max(0, p.bonusQuoteGodute) : 0;
  return Math.max(0, p.bonusQuoteTotali - godute);
}

/**
 * Interessi del mese. Col piano: quelli della rata. Senza piano, ma con debito e
 * TAN scritti dall'utente: debito × TAN / 12. Senza nessuno dei due: 0, non invento.
 */
export function interessiMese(i: Immobile | undefined, fisse: Fissa[], iso = localTodayIso()): number {
  if (!i) return 0;
  const mutuo = fissaMutuoDi(i, fisse);
  const r = rataDi(mutuo, iso);
  if (r) return r.i;
  if (pianoDi(mutuo)) return 0;
  const tan = i.mutuoTan ?? 0;
  if (i.capitaleMutuo > 0 && tan > 0) return (i.capitaleMutuo * tan) / 12;
  return 0;
}

/** Interessi dell'anno: dal piano, altrimenti dal mese × 12. */
export function interessiAnno(i: Immobile | undefined, fisse: Fissa[]): number {
  if (!i) return 0;
  const piano = pianoDi(fissaMutuoDi(i, fisse));
  if (piano) {
    const sum = interessiAnnoPiano(piano, new Date().getFullYear());
    if (sum > 0) return sum;
  }
  return interessiMese(i, fisse) * 12;
}

/** Il 19 % degli interessi rientra solo sulla casa in cui abiti. */
function detraeInteressi(i: Immobile | undefined): boolean {
  return !!i && i.uso !== "affitto";
}

/** 19% IRPEF, max 4.000 € di interessi (760 €). */
export function recuperoInteressiAnno(i: Immobile | undefined, fisse: Fissa[]): number {
  if (!detraeInteressi(i)) return 0;
  const base = Math.min(interessiAnno(i, fisse), PLAFOND_INTERESSI);
  return base * DETRAZIONE_INTERESSI;
}

export function recuperoInteressiStorico(i: Immobile | undefined, fisse: Fissa[]): number {
  if (!detraeInteressi(i)) return 0;
  return interessiPagati(fissaMutuoDi(i, fisse)) * DETRAZIONE_INTERESSI;
}

export function recupero730Anno(p: Patrimonio, i: Immobile | undefined, fisse: Fissa[]): number {
  return recuperoInteressiAnno(i, fisse) + bonusLavoriAnno(p);
}

export function recupero730Mese(p: Patrimonio, i: Immobile | undefined, fisse: Fissa[]): number {
  return recupero730Anno(p, i, fisse) / 12;
}

export function yieldOnCost(p: Patrimonio): number {
  const c = costoPieno(p);
  if (c <= 0) return 0;
  return (p.affittoEq * 12) / c;
}

export function yieldOnCostNetto(p: Patrimonio): number {
  const c = costoPienoNetto(p);
  if (c <= 0) return 0;
  return (p.affittoEq * 12) / c;
}

/** Costo pieno dopo 730: i lavori senza bonus restano interi, gli altri scendono dell'aliquota. */
export function costoPienoNetto(p: Patrimonio): number {
  const ali = bonusAliquotaEffettiva(p);
  return (
    p.prezzoAcquisto +
    p.closingCosts +
    Math.max(0, p.capexPorte) +
    Math.max(0, capexDetraibile(p)) * (1 - ali)
  );
}

export function equityCasa(p: ConZona): number {
  return valoreEffettivo(p) - p.capitaleMutuo;
}

export type RigaSpesaCasa = { id: string; nome: string; voce: VoceCasa; mese: number };

/**
 * Le spese ricorrenti di QUESTA casa: le spese fisse legate a lei.
 * La rata del mutuo non c'entra: è debito, non spesa di gestione.
 */
export function speseCasa(i: Immobile | undefined, fisse: Fissa[]): RigaSpesaCasa[] {
  if (!i) return [];
  return fisse
    .filter(
      (f) =>
        f.immobileId === i.id &&
        f.id !== i.fissaMutuoId &&
        f.voce !== "mutuo" &&
        f.categoria !== "debito",
    )
    .map((f) => ({ id: f.id, nome: f.nome, voce: f.voce ?? "altro", mese: competenzaMese(f) }));
}

function somma(righe: RigaSpesaCasa[], filtro: (v: VoceCasa) => boolean): number {
  return righe.filter((r) => filtro(r.voce)).reduce((s, r) => s + r.mese, 0);
}

/** Costo di stare in casa tua: interessi (non la quota capitale) + spese + manutenzione − 730. */
export function costoPossessoMese(
  p: ConZona,
  i: Immobile | undefined,
  fisse: Fissa[],
): {
  interessi: number;
  spese: number;
  righe: RigaSpesaCasa[];
  manutenzione: number;
  recupero: number;
  totale: number;
  netto: number;
} {
  const v = valoreEffettivo(p);
  const manutenzione = v > 0 ? (v * p.manutenzionePct) / 12 : 0;
  const righe = speseCasa(i, fisse);
  const spese = somma(righe, () => true);
  const interessi = interessiMese(i, fisse);
  const recupero = recupero730Mese(p, i, fisse);
  const totale = interessi + spese + manutenzione;
  return { interessi, spese, righe, manutenzione, recupero, totale, netto: totale - recupero };
}

/** Stare in affitto: canone più le spese che pagheresti comunque (rifiuti, luce, gas, internet). */
export function costoAffittoMese(
  p: Patrimonio,
  i: Immobile | undefined,
  fisse: Fissa[],
): { canone: number; spese: number; totale: number } {
  const spese = somma(speseCasa(i, fisse), (v) => VOCI_ANCHE_IN_AFFITTO.has(v));
  return { canone: p.affittoEq, spese, totale: p.affittoEq + spese };
}

export function yieldLordo(p: ConZona): number {
  const v = valoreEffettivo(p);
  if (v <= 0) return 0;
  return (p.affittoEq * 12) / v;
}

/** Netto da proprietario: canone − spese che restano a te (le utenze le paga l'inquilino) − manutenzione. */
export function yieldNetto(p: ConZona, i: Immobile | undefined, fisse: Fissa[]): number {
  const v = valoreEffettivo(p);
  if (v <= 0) return 0;
  const proprietario = somma(speseCasa(i, fisse), (x) => !VOCI_INQUILINO.has(x));
  const opex = (proprietario + (v * p.manutenzionePct) / 12) * 12;
  return (p.affittoEq * 12 - opex) / v;
}

/** Rendimento sul capitale tuo: quello che resta dopo la rata, diviso quanto della casa è tuo. */
export function cashOnCash(p: ConZona, i: Immobile | undefined, fisse: Fissa[]): number {
  const eq = equityCasa(p);
  if (eq <= 0) return 0;
  const v = valoreEffettivo(p);
  const nettoAnno = yieldNetto(p, i, fisse) * v;
  const mutuo = fissaMutuoDi(i, fisse);
  // Rata del piano o della spesa, sempre come competenza mensile.
  const rataMese = mutuo ? competenzaMese(fissaConPiano(mutuo, localTodayIso())) : 0;
  return (nettoAnno - rataMese * 12) / eq;
}

/**
 * Leva: la casa si rivaluta più di quanto costa il mutuo?
 * Senza TAN scritto dall'utente il costo del debito resta 0 (non invento un tasso).
 */
export function pascalLeva(
  p: ConZona,
  i: Immobile | undefined,
): {
  spread: number;
  tan: number;
  rivalutazioneAnno: number;
  costoDebitoAnno: number;
  va: number;
} {
  const v = valoreEffettivo(p);
  const rivalutazioneAnno = v * p.rivalutazionePct;
  const tan = p.capitaleMutuo > 0 ? Math.max(0, i?.mutuoTan ?? 0) : 0;
  const costoDebitoAnno = p.capitaleMutuo * tan;
  return {
    spread: p.rivalutazionePct - tan,
    tan,
    rivalutazioneAnno,
    costoDebitoAnno,
    va: rivalutazioneAnno - costoDebitoAnno,
  };
}
