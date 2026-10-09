/** Analisi generica di un affare. Non è la guida: sono le formule, usabili da chiunque. */

export const TARGET_GLOBALE = 0.07;
export const INFLAZIONE_DEFAULT = 0.02;
export const G_ATTESO_DEFAULT = 0.03;
export const G_BASSO_DEFAULT = -0.05;

export type UsoCasa = "vivere" | "ordinario" | "turistico";

export type AffareCasa = {
  nome: string;
  uso: UsoCasa;
  prezzo: number;
  lavori: number;
  closing: number;
  valoreOggi: number;
  /** Affitto ordinario, €/mese. */
  canoneMese: number;
  /** Turistico. */
  tariffaNotte: number;
  occupazionePct: number;
  gestionePct: number;
  sfittoPct: number;
  condoAnno: number;
  imuAnno: number;
  tariAnno: number;
  luceAnno: number;
  gasAnno: number;
  assicurazioneAnno: number;
  pulizieAnno: number;
  manutenzionePct: number;
  debito: number;
  tan: number;
  anniMutuo: number;
  gAtteso: number;
  gBasso: number;
  inflazione: number;
};

export type AffareCapitale = {
  nome: string;
  tipo: "azioni" | "crypto" | "fondo" | "altro";
  capitale: number;
  rendimentoAtteso: number;
  crolloPct: number;
  inflazione: number;
};

export type AffareDebito = {
  nome: string;
  capitale: number;
  tan: number;
  anni: number;
  /** Rendimento dell’uso del debito (immobile/ETF). 0 = solo costo. */
  rendimentoUso: number;
};

export const AFFARE_VUOTO: AffareCasa = {
  nome: "Nuovo immobile",
  uso: "ordinario",
  prezzo: 0,
  lavori: 0,
  closing: 0,
  valoreOggi: 0,
  canoneMese: 0,
  tariffaNotte: 0,
  occupazionePct: 0.55,
  gestionePct: 0.2,
  sfittoPct: 0.08,
  condoAnno: 0,
  imuAnno: 0,
  tariAnno: 0,
  luceAnno: 0,
  gasAnno: 0,
  assicurazioneAnno: 0,
  pulizieAnno: 0,
  manutenzionePct: 0.01,
  debito: 0,
  tan: 0.03,
  anniMutuo: 25,
  gAtteso: G_ATTESO_DEFAULT,
  gBasso: G_BASSO_DEFAULT,
  inflazione: INFLAZIONE_DEFAULT,
};

export function costoPienoAffare(a: AffareCasa): number {
  return a.prezzo + a.lavori + a.closing;
}

export function rataFrancese(capitale: number, tan: number, anni: number): number {
  if (capitale <= 0 || anni <= 0) return 0;
  const n = anni * 12;
  if (tan <= 0) return capitale / n;
  const i = tan / 12;
  const pow = (1 + i) ** n;
  return (capitale * i * pow) / (pow - 1);
}

/**
 * Il tasso che fa tornare la rata: debito, rata e numero di rate bastano, alla
 * francese il tasso è uno solo. 0 se la rata copre appena il debito (o meno).
 */
export function tanDallaRata(capitale: number, rata: number, mesi: number): number {
  if (!(capitale > 0) || !(rata > 0) || !(mesi >= 1)) return 0;
  if (rata * mesi <= capitale * (1 + 1e-9)) return 0;
  let lo = 0;
  let hi = 1;
  while (rataFrancese(capitale, hi, mesi / 12) < rata && hi < 8) hi *= 2;
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    if (rataFrancese(capitale, mid, mesi / 12) < rata) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function interessiAnno1(capitale: number, tan: number, anni: number): number {
  const rata = rataFrancese(capitale, tan, anni);
  if (rata <= 0) return 0;
  let k = capitale;
  let tot = 0;
  const i = tan / 12;
  for (let m = 0; m < 12; m++) {
    const ii = k * i;
    tot += ii;
    k = Math.max(0, k - (rata - ii));
  }
  return tot;
}

export function ricaviAnno(a: AffareCasa): number {
  if (a.uso === "turistico") {
    // Occupazione stored as fraction 0–1; clamp nonsense UI leaks.
    const tariffa = Math.max(0, a.tariffaNotte);
    const occ = clamp(a.occupazionePct, 0, 1);
    return tariffa * 365 * occ;
  }
  const lordo = Math.max(0, a.canoneMese) * 12;
  if (a.uso === "ordinario") return lordo * (1 - clamp(a.sfittoPct, 0, 1));
  return lordo;
}

export function opexAnno(a: AffareCasa): number {
  const ricavi = ricaviAnno(a);
  const gestione =
    a.uso === "turistico" ? ricavi * clamp(a.gestionePct, 0, 1) : 0;
  const v = a.valoreOggi > 0 ? a.valoreOggi : costoPienoAffare(a);
  const manut = Math.max(0, v) * clamp(a.manutenzionePct, 0, 1);
  const utenzeOwner =
    a.uso === "ordinario"
      ? 0
      : Math.max(0, a.luceAnno) + Math.max(0, a.gasAnno);
  const pulizie = a.uso === "turistico" ? Math.max(0, a.pulizieAnno) : 0;
  return (
    Math.max(0, a.condoAnno) +
    Math.max(0, a.imuAnno) +
    Math.max(0, a.tariAnno) +
    Math.max(0, a.assicurazioneAnno) +
    utenzeOwner +
    pulizie +
    gestione +
    manut
  );
}

/** NOI: canone (o affitto evitato) − spese di gestione, prima della banca. */
export function noiAnno(a: AffareCasa): number {
  return ricaviAnno(a) - opexAnno(a);
}

export function reale(nominale: number, inflazione: number): number {
  if (!Number.isFinite(nominale) || !Number.isFinite(inflazione)) return Number.NaN;
  const denom = 1 + inflazione;
  // inflazione = −100 % → divisione per zero; UI mostra "—" via pct()
  if (Math.abs(denom) < 1e-12) return Number.NaN;
  const out = (1 + nominale) / denom - 1;
  return Number.isFinite(out) ? out : Number.NaN;
}

export type Scenario = {
  id: "base" | "fermo" | "calo" | "reale";
  label: string;
  g: number;
  totale: number;
  reale: number;
};

export type EsitoCasa = {
  costo: number;
  valore: number;
  ricavi: number;
  opex: number;
  noi: number;
  rataMese: number;
  rataAnno: number;
  interessi: number;
  avanzo: number;
  equity: number;
  cashIn: number;
  yoc: number;
  lordo: number;
  netto: number;
  coc: number;
  spread: number;
  totale: number;
  totaleReale: number;
  totaleCalo: number;
  voto: number;
  giudizio: string;
  scenari: Scenario[];
};

export function analizzaCasa(a: AffareCasa): EsitoCasa {
  const costo = costoPienoAffare(a);
  const valore = a.valoreOggi > 0 ? a.valoreOggi : costo;
  const ricavi = ricaviAnno(a);
  const opex = opexAnno(a);
  const noi = ricavi - opex;
  const rataMese = rataFrancese(a.debito, a.tan, a.anniMutuo);
  const rataAnno = rataMese * 12;
  const interessi = interessiAnno1(a.debito, a.tan, a.anniMutuo);
  const avanzo = noi - rataAnno;
  const equity = Math.max(0, valore - a.debito);
  const cashIn = Math.max(0, costo - a.debito);
  const denCoc = equity > 0 ? equity : cashIn;
  const yoc = costo > 0 ? ricavi / costo : 0;
  const lordo = valore > 0 ? ricavi / valore : 0;
  const netto = valore > 0 ? noi / valore : 0;
  const coc = denCoc > 0 ? avanzo / denCoc : 0;
  const spread = a.gAtteso - a.tan;
  const totale = netto + a.gAtteso;
  const totaleCalo = netto + a.gBasso;
  const totaleReale = reale(totale, a.inflazione);
  const scenari: Scenario[] = [
    { id: "base", label: "Se sale come previsto", g: a.gAtteso, totale, reale: totaleReale },
    {
      id: "fermo",
      label: "Se i prezzi stanno fermi",
      g: 0,
      totale: netto,
      reale: reale(netto, a.inflazione),
    },
    {
      id: "calo",
      label: "Se i prezzi scendono",
      g: a.gBasso,
      totale: totaleCalo,
      reale: reale(totaleCalo, a.inflazione),
    },
    {
      id: "reale",
      label: "Al netto dell’inflazione",
      g: a.gAtteso,
      totale: totaleReale,
      reale: totaleReale,
    },
  ];
  const voto = votoCasa({ yoc, netto, coc, spread, totale, totaleCalo, totaleReale, avanzo });
  return {
    costo,
    valore,
    ricavi,
    opex,
    noi,
    rataMese,
    rataAnno,
    interessi,
    avanzo,
    equity,
    cashIn,

    yoc,
    lordo,
    netto,
    coc,
    spread,
    totale,
    totaleReale,
    totaleCalo,
    voto,
    giudizio: giudizioVoto(voto),
    scenari,
  };
}

function votoCasa(x: {
  yoc: number;
  netto: number;
  coc: number;
  spread: number;
  totale: number;
  totaleCalo: number;
  totaleReale: number;
  avanzo: number;
}): number {
  let v = 6.8;
  v += clamp((x.totale - TARGET_GLOBALE) / 0.02, -1.6, 1.4);
  v += clamp((x.yoc - 0.07) / 0.04, -0.8, 0.8);
  v += clamp((x.netto - 0.04) / 0.02, -0.6, 0.6);
  v += clamp((x.coc - 0.03) / 0.03, -0.5, 0.5);
  v += clamp(x.spread / 0.03, -0.5, 0.6);
  if (x.avanzo < 0) v -= 1.2;
  if (x.totaleCalo < -0.05) v -= 0.6;
  else if (x.totaleCalo < 0) v -= 0.2;
  if (x.totaleReale < 0) v -= 0.5;
  return Math.round(clamp(v, 0, 10) * 10) / 10;
}

export type EsitoCapitale = {
  atteso: number;
  reale: number;
  down: number;
  voto: number;
  giudizio: string;
};

export function analizzaCapitale(a: AffareCapitale): EsitoCapitale {
  const atteso = a.rendimentoAtteso;
  const realeN = reale(atteso, a.inflazione);
  const down = atteso - a.crolloPct;
  let v = 7.2;
  v += clamp((atteso - TARGET_GLOBALE) / 0.03, -1.5, 1.5);
  v -= clamp(a.crolloPct / 0.4, 0, 2);
  if (down < -0.4) v -= 0.4;
  const voto = Math.round(clamp(v, 0, 10) * 10) / 10;
  return { atteso, reale: realeN, down, voto, giudizio: giudizioVoto(voto) };
}

export type EsitoDebito = {
  rataMese: number;
  rataAnno: number;
  interessi: number;
  spread: number;
  voto: number;
  giudizio: string;
};

export function analizzaDebito(a: AffareDebito): EsitoDebito {
  const rataMese = rataFrancese(a.capitale, a.tan, a.anni);
  const interessi = interessiAnno1(a.capitale, a.tan, a.anni);
  const spread = a.rendimentoUso - a.tan;
  let v = 5;
  if (a.tan <= 0.02) v += 1.5;
  else if (a.tan <= 0.035) v += 0.6;
  else if (a.tan >= 0.08) v -= 1.5;
  else if (a.tan >= 0.05) v -= 0.6;
  v += clamp(spread / 0.02, -1.5, 1.5);
  const voto = Math.round(clamp(v, 0, 10) * 10) / 10;
  return {
    rataMese,
    rataAnno: rataMese * 12,
    interessi,
    spread,
    voto,
    giudizio: giudizioVoto(voto),
  };
}

export function giudizioVoto(voto: number): string {
  if (voto >= 8) return "Buono";
  if (voto >= 7) return "Sopra la soglia";
  if (voto >= 5.5) return "In media";
  if (voto >= 4) return "Debole";
  return "Non conviene";
}


/** Scheda Immobile pronta: serve un denominatore (costo o valore di mercato) E dei ricavi. */
export function schedaCasaPronta(e: Pick<EsitoCasa, "valore" | "ricavi">): boolean {
  return e.valore > 0 && e.ricavi > 0;
}

export function votoGlobale(voti: number[]): number {
  if (!voti.length) return 0;
  const m = voti.reduce((s, n) => s + n, 0) / voti.length;
  return Math.round(m * 10) / 10;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
