import {
  buildClassified,
  monthStart,
  todayIso,
  variabiliNelPeriodo,
  vMensile,
  type Movimento,
  type MovimentoClassificato,
  type MovimentoManuale,
} from "./banca";
import type { Regola } from "./categorie";
import { fissaConPiano, isDebitoFissa, totaleFisseAl } from "./piano";
import { capacitaPrestito, competenzaMese, type Fissa } from "./quadra";

type Sorgente = {
  csvMovimenti: Movimento[];
  regole: Regola[];
  categorieNascoste: string[];
  movimentiManuali: MovimentoManuale[];
  overrideCat: Record<string, string>;
  movimentiArchiviati: string[];
  fisse: Fissa[];
  redditoMensile: number;
};

export function movimentiClassificati(s: Sorgente): MovimentoClassificato[] {
  return buildClassified(
    s.csvMovimenti,
    [],
    s.regole,
    s.categorieNascoste,
    s.movimentiManuali,
    s.overrideCat,
    s.movimentiArchiviati,
  );
}

/**
 * I numeri della Home, in un posto solo.
 * Resta al mese = Cedolini − Spese fisse − Dal conto.
 * Dal conto = media al giorno delle spese di questo mese (solo giorni caricati) × 30,44.
 * Senza spese caricate questo mese non si calcola niente: niente mesi vuoti.
 */
export function contiDelMese(s: Sorgente, classified = movimentiClassificati(s), oggi = todayIso()) {
  const dal = monthStart(oggi);
  const periodo = variabiliNelPeriodo(classified, dal, oggi);
  const haDalConto = periodo.n > 0;
  const dalConto = haDalConto ? vMensile(periodo.mediaGiorno) : 0;
  const isoMese = `${oggi.slice(0, 7)}-01`;
  const speseFisse = totaleFisseAl(s.fisse, isoMese);
  const cedolini = s.redditoMensile;
  const restaAlMese = cedolini - speseFisse - dalConto;
  const rateInCorso = s.fisse
    .filter(isDebitoFissa)
    .reduce((t, f) => t + competenzaMese(fissaConPiano(f, isoMese)), 0);
  const limiteBancaRaw = 0.33 * cedolini - rateInCorso;
  const limiteBanca = Number.isFinite(limiteBancaRaw) ? Math.max(0, limiteBancaRaw) : 0;
  const quantoPuoiChiedere = haDalConto ? capacitaPrestito(restaAlMese, limiteBanca) : 0;
  return {
    oggi,
    dal,
    periodo,
    haDalConto,
    cedolini,
    speseFisse,
    dalConto,
    restaAlMese,
    rateInCorso,
    limiteBanca,
    quantoPuoiChiedere,
    cuscinetto: speseFisse * 6,
  };
}

export type ContiDelMese = ReturnType<typeof contiDelMese>;
