/**
 * Un concetto, un nome. Home, «i», glossario e moduli leggono da qui:
 * se si rinomina qualcosa, si rinomina ovunque.
 *
 * Ogni voce: nome italiano, una riga (al massimo tre frasi), un esempio in euro.
 * L'inglese solo in `tecnico`, e compare dentro la «i» dopo la frase italiana.
 */
export type Voce = {
  nome: string;
  riga: string;
  esempio: string;
  tecnico?: string;
};

export const VOCI = {
  restaAlMese: {
    nome: "Resta al mese",
    riga: "È quanto ti avanzerebbe in un mese tipo, non il saldo in banca. Cedolini meno spese fisse meno la media di quello che esce dal conto.",
    esempio: "2.400 € di cedolini − 900 € di spese fisse − 600 € dal conto = 900 € al mese.",
    tecnico: "cash flow",
  },
  inConto: {
    nome: "In conto",
    riga: "Il saldo del conto corrente oggi, come lo vedi nell'app della tua banca. Lo scrivi tu: non è «Resta al mese».",
    esempio: "L'app della banca dice 2.340,50 €: scrivi 2.340,50 €.",
  },
  cedolini: {
    nome: "Cedolini",
    riga: "La media dei cedolini che hai caricato: stipendio e 13ª/14ª già nel netto. Il rimborso 730 scritto nella nota non conta.",
    esempio: "2.300 € + 2.400 € + 2.500 € in tre mesi = 2.400 € al mese.",
    tecnico: "net pay",
  },
  speseFisse: {
    nome: "Spese fisse",
    riga: "Quello che esce ogni mese per forza: mutuo, affitto, bollette, abbonamenti. Una spesa annuale conta per un dodicesimo al mese.",
    esempio: "TARI 240 € all'anno = 20 € al mese.",
  },
  dalConto: {
    nome: "Dal conto",
    riga: "Le spese di tutti i giorni prese dall'estratto conto di questo mese: la media al giorno dal 1° a oggi, portata a un mese intero. Senza spese caricate questo mese non si calcola.",
    esempio: "300 € in 10 giorni = 30 € al giorno × 30,44 = 913 € al mese.",
    tecnico: "run-rate",
  },
  quantoPuoiChiedere: {
    nome: "Quanto puoi chiedere in banca",
    riga: "La rata più alta di un prestito nuovo che reggi. È la più bassa fra quello che ti resta al mese e il limite della banca: il 33 % dei cedolini meno le rate che paghi già.",
    esempio: "Cedolini 2.400 €: il 33 % è 792 €, meno una rata di 250 € = 542 €. Se ti restano 400 € al mese, la stima è 400 €.",
    tecnico: "rapporto rata/reddito (DTI) al 33 %",
  },
  valoreCasa: {
    nome: "Valore della casa",
    riga: "Quanto vale oggi: il valore che scrivi tu, altrimenti metri quadri × prezzo della zona, altrimenti quanto l'hai pagata. Tolto il mutuo, resta la parte tua.",
    esempio: "60 m² × 2.500 € = 150.000 €. Con 70.000 € di mutuo, la parte tua è 80.000 €.",
    tecnico: "home equity (la parte tua)",
  },
  quantoHai: {
    nome: "Quanto hai",
    riga: "Tutto quello che possiedi meno tutti i debiti: conto, case, fondi e investimenti, meno mutui e prestiti. Non sono soldi da spendere.",
    esempio: "Conto 3.000 € + casa 150.000 € + fondo 15.000 € − mutuo 70.000 € = 98.000 €.",
    tecnico: "patrimonio netto (net worth)",
  },
  cuscinetto: {
    nome: "Cuscinetto",
    riga: "Sei mesi di spese fisse tenuti sul conto, per quando lo stipendio si ferma. Casa e fondi pensione non contano.",
    esempio: "Spese fisse 900 € × 6 = 5.400 € da tenere in conto.",
    tecnico: "fondo emergenza",
  },
  costoCasa: {
    nome: "Costo di stare in casa tua",
    riga: "Interessi del mutuo, spese della casa e manutenzione, meno quello che ti torna col 730. La quota capitale della rata non è un costo: abbassa il debito.",
    esempio: "Interessi 200 € + spese 180 € + manutenzione 125 € − 38 € dal 730 = 467 € al mese.",
  },
  creditoImposta: {
    nome: "Credito d'imposta",
    riga: "Quello che ti torna col 730: il 19 % degli interessi del mutuo della casa in cui abiti (fino a 4.000 € di interessi) e la quota annua dei bonus lavori.",
    esempio: "1.000 € di interessi → 190 €. Caldaia 4.000 € al 50 % in 10 anni → 200 € l'anno.",
    tecnico: "detrazioni IRPEF (tax credit)",
  },
  rendimento: {
    nome: "Rendimento",
    riga: "Quanto rende l'affitto di un anno rispetto a tutto quello che hai speso per la casa: prezzo, notaio, lavori.",
    esempio: "700 € × 12 = 8.400 € su 120.000 € spesi = 7 % all'anno.",
    tecnico: "yield on cost",
  },
  rendimentoNetto: {
    nome: "Rendimento netto",
    riga: "L'affitto di un anno meno le spese che restano a te, diviso il valore di oggi. È il numero più onesto.",
    esempio: "8.400 € − 2.800 € di spese = 5.600 € su 160.000 € = 3,5 %.",
    tecnico: "net yield · NOI / valore",
  },
  leva: {
    nome: "Leva del mutuo",
    riga: "Quanto sale la casa in un anno meno il tasso del mutuo. Se è positiva i soldi presi in prestito lavorano per te, se è negativa ti costano.",
    esempio: "Casa +3 % l'anno, mutuo al 2 %: su 100.000 € di debito la casa guadagna 3.000 € e gli interessi costano 2.000 €, la leva ti dà 1.000 € l'anno.",
    tecnico: "leverage spread",
  },
  tan: {
    nome: "Tasso del mutuo (TAN)",
    riga: "Il tasso d'interesse scritto nel contratto, spese escluse.",
    esempio: "100.000 € al 3 % → circa 3.000 € di interessi il primo anno.",
    tecnico: "tasso annuo nominale",
  },
  rivalutazione: {
    nome: "Rivalutazione",
    riga: "Di quanto pensi che il prezzo della casa salga ogni anno. È una tua ipotesi, non un dato, e la incassi solo se vendi.",
    esempio: "150.000 € al 2 % = 3.000 € in un anno, sulla carta.",
  },
  manutenzione: {
    nome: "Manutenzione",
    riga: "Una quota del valore della casa messa da parte ogni anno per caldaia, tetto, infissi.",
    esempio: "1 % di 150.000 € = 1.500 € l'anno, 125 € al mese.",
  },
  sfitto: {
    nome: "Sfitto",
    riga: "La parte dell'anno in cui la casa resta vuota, senza affitto.",
    esempio: "1 mese vuoto su 12 ≈ 8 %: su 8.400 € ne incassi circa 7.700 €.",
    tecnico: "vacancy",
  },
  inflazione: {
    nome: "Inflazione",
    riga: "Quanto salgono i prezzi in un anno. Un guadagno sotto l'inflazione ti fa perdere potere d'acquisto.",
    esempio: "10.000 € al 5 % = 500 €; con i prezzi su del 2 %, in potere d'acquisto ne guadagni circa 290 €.",
  },
  copiaSicurezza: {
    nome: "Copia di sicurezza",
    riga: "Un file con tutti i tuoi dati, da tenere fuori dal telefono. Con «Ripristina» rimetti tutto com'era.",
    esempio: "ledger-copia-2026-09-25.json, salvato nella tua email o in un archivio online.",
    tecnico: "backup",
  },
} satisfies Record<string, Voce>;

export type IdVoce = keyof typeof VOCI;

/** Frase fissa sotto «Quanto puoi chiedere in banca». */
export const STIMA_NON_DELIBERA = "Stima, non è una delibera";
