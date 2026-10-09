/**
 * I conti di Investi. Niente voti da 0 a 10: tre scenari (fermo, su, giù) e un
 * giudizio a parole sullo scenario che l'utente si aspetta.
 *
 * Le cifre «in N anni» sono in euro di oggi: si toglie l'inflazione da tutto,
 * compreso il capitale di partenza. Il debito invece è in euro nominali, e
 * l'inflazione lo erode a favore di chi lo ha: per questo si sgonfia il
 * patrimonio netto (casa meno debito), non la casa intera.
 */
import { rataFrancese, tanDallaRata } from "./affare";
import type { RataPiano } from "./piano";

export type Cadenza = "mese" | "anno" | "una" | "periodo";

export const CADENZE: { id: Cadenza; label: string }[] = [
  { id: "mese", label: "Al mese" },
  { id: "anno", label: "All'anno" },
  { id: "una", label: "Una volta" },
  { id: "periodo", label: "Solo alcuni mesi" },
];

/** Luce o gas: dai consumi, oppure il totale della bolletta se non li sai. */
export type Utenza = {
  tipo: "luce" | "gas";
  /** kWh (luce) o Smc (gas) in un anno. */
  consumoAnno: number;
  /** € per kWh o per Smc. */
  prezzoUnita: number;
  /** Quota fissa in bolletta, € al mese. */
  quotaFissaMese: number;
  /** Trasporto, oneri di sistema e tasse, € all'anno (se li sai). */
  oneriAnno: number;
};

export type Costo = {
  id: string;
  nome: string;
  /** Per «periodo»: € al mese nei mesi attivi. */
  importo: number;
  cadenza: Cadenza;
  /** Per «periodo»: primo e ultimo mese (1–12), anche a cavallo d'anno (ott→apr). */
  dalMese?: number;
  alMese?: number;
  /** Se c'è, l'importo si calcola dai consumi. */
  utenza?: Utenza;
  /** «Ci abito»: la pagheresti anche in affitto (bollette, rifiuti, internet). */
  ancheInAffitto?: boolean;
};

export function mesiNelPeriodo(dal = 1, al = 12): number {
  const a = Math.min(12, Math.max(1, Math.round(dal)));
  const b = Math.min(12, Math.max(1, Math.round(al)));
  return b >= a ? b - a + 1 : 12 - a + 1 + b;
}

export function costoUtenzaAnno(u: Utenza): number {
  const pos = (n: number) => (Number.isFinite(n) ? Math.max(0, n) : 0);
  return pos(u.consumoAnno) * pos(u.prezzoUnita) + pos(u.quotaFissaMese) * 12 + pos(u.oneriAnno);
}

/** Quanto pesa un costo in un anno. Le spese «una volta» non sono annuali: vanno nel costo iniziale. */
export function costoAnno(c: Costo): number {
  if (c.utenza) return costoUtenzaAnno(c.utenza);
  const v = Number.isFinite(c.importo) ? Math.max(0, c.importo) : 0;
  if (c.cadenza === "mese") return v * 12;
  if (c.cadenza === "anno") return v;
  if (c.cadenza === "periodo") return v * mesiNelPeriodo(c.dalMese, c.alMese);
  return 0;
}

export function costoUnaTantum(c: Costo): number {
  return c.cadenza === "una" && !c.utenza && Number.isFinite(c.importo) ? Math.max(0, c.importo) : 0;
}

/** Le voci che si pagano anche in affitto: di solito bollette, rifiuti, internet. */
export function sembraAncheInAffitto(nome: string): boolean {
  return /\b(luce|gas|tari|rifiuti|internet|acqua|telefono|riscaldamento)\b/i.test(nome);
}

export type Ipotesi = {
  inflazione: number;
  /** Mesi vuoti in un anno, come frazione (0,08 ≈ un mese). Solo affitto ordinario. */
  sfitto: number;
  /** Rialzo annuo del valore (scenario «su»). */
  su: number;
  /** Calo annuo del valore (scenario «giù»), negativo. */
  giu: number;
  anni: number;
};

export const IPOTESI_BASE: Ipotesi = { inflazione: 0.02, sfitto: 0.08, su: 0.03, giu: -0.05, anni: 10 };

export type Debito = {
  residuo: number;
  tan: number;
  /** AAAA-MM dell'ultima rata. */
  fine: string;
  /** Rata scritta dall'utente; 0 = la calcolo dal tasso e dalla scadenza. */
  rata: number;
  /** Col piano della banca: le rate da questo mese in poi. */
  piano?: RataPiano[];
};

export function mesiFino(yyyymm: string, oggi = new Date()): number {
  if (!/^\d{4}-\d{2}$/.test(yyyymm)) return 0;
  const [y, m] = yyyymm.split("-").map(Number);
  return Math.max(0, (y - oggi.getFullYear()) * 12 + (m - (oggi.getMonth() + 1)) + 1);
}

/** Da dove arriva la rata: scritta, dal piano, calcolata, solo interessi (manca la scadenza) o nessuna. */
export type OrigineRata = "piano" | "scritta" | "calcolata" | "solo-interessi" | "nessuna";

export function rataEffettiva(d: Debito, oggi = new Date()): { rata: number; origine: OrigineRata } {
  const residuo = Math.max(0, d.residuo || 0);
  const primaPiano = d.piano?.[0];
  if (primaPiano) return { rata: primaPiano.r, origine: "piano" };
  if (d.rata > 0) return { rata: d.rata, origine: "scritta" };
  if (!(residuo > 0)) return { rata: 0, origine: "nessuna" };
  const mesi = mesiFino(d.fine, oggi);
  if (mesi > 0) return { rata: rataFrancese(residuo, d.tan, mesi / 12), origine: "calcolata" };
  // Senza scadenza valida non si può calcolare la rata: resta almeno il costo degli interessi.
  if (d.tan > 0) return { rata: (residuo * d.tan) / 12, origine: "solo-interessi" };
  return { rata: 0, origine: "nessuna" };
}

/**
 * Il tasso con cui contare gli interessi. Chi sa la rata spesso non sa il tasso:
 * con la rata, il debito e l'ultima rata il tasso si ricava, e non vale zero.
 * Senza scadenza non si può: resta 0 e l'avviso lo dice.
 */
export function tanEffettivo(d: Debito, oggi = new Date()): { tan: number; stimato: boolean } {
  const tan = Number.isFinite(d.tan) ? Math.max(0, d.tan) : 0;
  if (tan > 0 || d.piano?.length || !(d.rata > 0)) return { tan, stimato: false };
  const stimato = tanDallaRata(Math.max(0, d.residuo || 0), d.rata, mesiFino(d.fine, oggi));
  return stimato > 0 ? { tan: stimato, stimato: true } : { tan: 0, stimato: false };
}

/** Cosa dire sotto il mutuo, quando i dati non bastano o vanno ricontrollati. */
export type AvvisoDebito = "tasso-stimato" | "tasso-mancante" | "rata-sotto-interessi";

export function avvisoDebito(d: Debito, oggi = new Date()): AvvisoDebito | null {
  const residuo = Math.max(0, d.residuo || 0);
  if (!(residuo > 0) || d.piano?.length || !(d.rata > 0)) return null;
  const { tan, stimato } = tanEffettivo(d, oggi);
  if (tan > 0 && d.rata < (residuo * tan) / 12 - 0.005) return "rata-sotto-interessi";
  if (stimato) return "tasso-stimato";
  // Rata che basta a chiudere il debito entro la scadenza a tasso zero: un prestito a tasso zero esiste.
  if (tan === 0 && !(mesiFino(d.fine, oggi) > 0)) return "tasso-mancante";
  return null;
}

/** @deprecated usa rataEffettiva */
export function rataDebito(d: Debito): number {
  return rataEffettiva(d).rata;
}

export type AnnoDebito = { interessi: number; capitale: number; pagato: number };

/**
 * Il debito anno per anno: col piano della banca se c'è, altrimenti alla
 * francese con la rata effettiva. Finito il debito, niente più interessi.
 */
export function debitoNegliAnni(d: Debito, anni: number, oggi = new Date()): { anni: AnnoDebito[]; residuoFinale: number } {
  const n = Math.max(1, Math.round(anni));
  const out: AnnoDebito[] = Array.from({ length: n }, () => ({ interessi: 0, capitale: 0, pagato: 0 }));
  if (d.piano && d.piano.length) {
    d.piano.slice(0, n * 12).forEach((r, idx) => {
      const a = out[Math.floor(idx / 12)];
      a.interessi += r.i;
      a.capitale += r.c;
      a.pagato += r.r;
    });
    const dopo = d.piano[n * 12 - 1] ?? d.piano[d.piano.length - 1];
    const residuoFinale = d.piano.length > n * 12 ? (dopo?.k ?? 0) : 0;
    return { anni: out, residuoFinale };
  }
  let b = Math.max(0, d.residuo || 0);
  const i = tanEffettivo(d, oggi).tan / 12;
  const { rata, origine } = rataEffettiva(d, oggi);
  for (let m = 0; m < n * 12 && b > 0.005; m++) {
    const int = b * i;
    const a = out[Math.floor(m / 12)];
    a.interessi += int;
    if (origine === "solo-interessi") {
      a.pagato += int;
      continue;
    }
    // Esce la rata, non di più: se non copre gli interessi, quelli che mancano si aggiungono al debito.
    const pagato = Math.min(b + int, rata);
    const cap = pagato - int;
    a.capitale += Math.max(0, cap);
    a.pagato += pagato;
    b -= cap;
  }
  return { anni: out, residuoFinale: Math.max(0, b) };
}

/** Compatibilità: interessi del primo anno. */
export function interessiDebitoAnno(d: Debito): number {
  return debitoNegliAnni(d, 1).anni[0].interessi;
}

export type Scenario = {
  id: "fermo" | "su" | "giu";
  label: string;
  g: number;
  /** Rendimento all'anno: affitto netto più variazione del valore. */
  anno: number;
  /** Lo stesso, tolta l'inflazione. */
  reale: number;
  /** Quanto ti trovi in più (o in meno) dopo gli anni di possesso, in euro di oggi. */
  dopoAnni: number;
};

export function reale(nominale: number, inflazione: number): number {
  const d = 1 + inflazione;
  if (!Number.isFinite(nominale) || Math.abs(d) < 1e-12) return Number.NaN;
  return (1 + nominale) / d - 1;
}

function deflatore(inflazione: number, t: number): number {
  const f = (1 + inflazione) ** t;
  return Number.isFinite(f) && f > 0 ? f : 1;
}

export type EsitoAffitto = {
  ricavi: number;
  gestione: number;
  costiAnno: number;
  unaTantum: number;
  noi: number;
  rataMese: number;
  origineRata: OrigineRata;
  interessiAnno: number;
  avanzo: number;
  valore: number;
  costoIniziale: number;
  /** Soldi tuoi dentro all'inizio: casa già tua = valore − debito; casa nuova = quello che spendi − debito. */
  capitaleTuo: number;
  netto: number;
  scenari: Scenario[];
  pronto: boolean;
};

export function analizzaAffitto(x: {
  turisti: boolean;
  canoneMese: number;
  tariffaNotte: number;
  occupazione: number;
  gestionePct: number;
  costi: Costo[];
  /** Spese annue che arrivano dalla scheda della casa. */
  costiCasaAnno: number;
  prezzo: number;
  valore: number;
  debito: Debito;
  ipotesi: Ipotesi;
  /** Casa già tua: il capitale tuo è valore − debito, non prezzo − debito. */
  esistente: boolean;
}): EsitoAffitto {
  const clamp01 = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));
  const ip = x.ipotesi;
  const n = Math.max(1, Math.round(ip.anni));
  const ricavi = x.turisti
    ? Math.max(0, x.tariffaNotte) * 365 * clamp01(x.occupazione)
    : Math.max(0, x.canoneMese) * 12 * (1 - clamp01(ip.sfitto));
  const gestione = x.turisti ? ricavi * clamp01(x.gestionePct) : 0;
  const costiAnno = x.costi.reduce((s, c) => s + costoAnno(c), 0) + Math.max(0, x.costiCasaAnno) + gestione;
  const unaTantum = x.costi.reduce((s, c) => s + costoUnaTantum(c), 0);
  const noi = ricavi - costiAnno;
  const { rata: rataMese, origine: origineRata } = rataEffettiva(x.debito);
  const residuo = Math.max(0, x.debito.residuo || 0);
  const piano = debitoNegliAnni(x.debito, n);
  const interessiAnno = piano.anni[0].interessi;
  const avanzo = noi - piano.anni[0].pagato;
  const prezzo = Math.max(0, x.prezzo);
  const costoIniziale = prezzo + unaTantum;
  // Il notaio non fa valere di più la casa: senza valore di mercato vale quanto l'hai pagata.
  const valore = x.valore > 0 ? x.valore : prezzo;
  const capitaleTuo = x.esistente ? Math.max(0, valore - residuo) + unaTantum : Math.max(0, costoIniziale - residuo);
  const netto = valore > 0 ? noi / valore : 0;
  const mk = (id: Scenario["id"], label: string, g: number): Scenario => {
    let cassa = 0;
    piano.anni.forEach((a, t) => {
      cassa += (noi - a.pagato) / deflatore(ip.inflazione, t + 1);
    });
    const finale = (valore * (1 + g) ** n - piano.residuoFinale) / deflatore(ip.inflazione, n);
    const anno = netto + g;
    return { id, label, g, anno, reale: reale(anno, ip.inflazione), dopoAnni: cassa + finale - capitaleTuo };
  };
  return {
    ricavi,
    gestione,
    costiAnno,
    unaTantum,
    noi,
    rataMese,
    origineRata,
    interessiAnno,
    avanzo,
    valore,
    costoIniziale,
    capitaleTuo,
    netto,
    scenari: [
      mk("fermo", "Il valore sta fermo", 0),
      mk("su", "Il valore sale", ip.su),
      mk("giu", "Il valore scende", ip.giu),
    ],
    pronto: valore > 0 && ricavi > 0,
  };
}

export type EsitoAbito = {
  interessiMese: number;
  costiMese: number;
  ancheInAffittoMese: number;
  unaTantum: number;
  recupero730Mese: number;
  costoMese: number;
  affittoMese: number;
  differenza: number;
  rataMese: number;
  origineRata: OrigineRata;
  /** Soldi tuoi dentro la casa: prezzo + spese una tantum − debito. */
  capitaleTuo: number;
  pronto: boolean;
};

/**
 * Ci abito: quanto costa stare lì (senza la quota capitale) contro l'affitto
 * altrove. Le spese che pagheresti anche in affitto (bollette, rifiuti) stanno
 * da tutte e due le parti, come in Casa.
 */
export function analizzaAbito(x: {
  costi: Costo[];
  debito: Debito;
  affittoAltrove: number;
  prezzo?: number;
}): EsitoAbito {
  const interessiAnno = debitoNegliAnni(x.debito, 1).anni[0].interessi;
  const interessiMese = interessiAnno / 12;
  const costiMese = x.costi.reduce((s, c) => s + costoAnno(c), 0) / 12;
  const ancheInAffittoMese = x.costi.filter((c) => c.ancheInAffitto).reduce((s, c) => s + costoAnno(c), 0) / 12;
  const unaTantum = x.costi.reduce((s, c) => s + costoUnaTantum(c), 0);
  const recupero730Mese = (Math.min(interessiAnno, 4000) * 0.19) / 12;
  const costoMese = interessiMese + costiMese - recupero730Mese;
  const affittoMese = Math.max(0, x.affittoAltrove) + ancheInAffittoMese;
  const { rata: rataMese, origine: origineRata } = rataEffettiva(x.debito);
  const capitaleTuo = Math.max(0, Math.max(0, x.prezzo ?? 0) + unaTantum - Math.max(0, x.debito.residuo || 0));
  return {
    interessiMese,
    costiMese,
    ancheInAffittoMese,
    unaTantum,
    recupero730Mese,
    costoMese,
    affittoMese,
    differenza: affittoMese - costoMese,
    rataMese,
    origineRata,
    capitaleTuo,
    pronto: x.affittoAltrove > 0 && (costiMese > 0 || interessiMese > 0),
  };
}

export type EsitoCapitale = {
  costiAnno: number;
  unaTantum: number;
  nettoAtteso: number;
  scenari: Scenario[];
  pronto: boolean;
};

/**
 * Un investimento che non è una casa. Tre scenari: fermo, rende come pensi,
 * e l'anno brutto che arriva proprio prima di vendere (il momento peggiore).
 */
export function analizzaCapitale(x: {
  capitale: number;
  rendimento: number;
  calo: number;
  costi: Costo[];
  ipotesi: Ipotesi;
}): EsitoCapitale {
  const cap = Math.max(0, x.capitale);
  const n = Math.max(1, Math.round(x.ipotesi.anni));
  const costiAnno = x.costi.reduce((s, c) => s + costoAnno(c), 0);
  const unaTantum = x.costi.reduce((s, c) => s + costoUnaTantum(c), 0);
  const pesoCosti = cap > 0 ? costiAnno / cap : 0;
  const nettoAtteso = x.rendimento - pesoCosti;
  const calo = Math.min(1, Math.abs(x.calo));
  const defl = deflatore(x.ipotesi.inflazione, n);
  // Un anno che si mangia tutto lascia zero, non un debito: una base negativa alla decima tornerebbe positiva.
  const resta = (fattoreAnno: number) => Math.max(0, fattoreAnno);
  const mk = (id: Scenario["id"], label: string, fattore: number): Scenario => {
    const f = Math.max(0, fattore);
    const anno = f ** (1 / n) - 1;
    return {
      id,
      label,
      g: anno,
      anno,
      reale: reale(anno, x.ipotesi.inflazione),
      dopoAnni: (cap * f) / defl - (cap + unaTantum),
    };
  };
  return {
    costiAnno,
    unaTantum,
    nettoAtteso,
    scenari: [
      mk("fermo", "Il valore sta fermo", resta(1 - pesoCosti) ** n),
      mk("su", "Rende come pensi", resta(1 + x.rendimento - pesoCosti) ** n),
      mk("giu", "Un anno brutto prima di vendere", resta(1 + x.rendimento - pesoCosti) ** (n - 1) * resta(1 - calo - pesoCosti)),
    ],
    pronto: cap > 0,
  };
}
