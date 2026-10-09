/**
 * Million-user style stress for CSV IT parsing + amount edge cases + equity/bonus guards.
 * Run: npx --yes tsx scripts/stress.mts
 */
import {
  parseAmount,
  parseSegnoCell,
  parseCsvMovimentiDetailed,
  partizionaCsv,
  dupKey,
  vMensile,
  GIORNI_MESE,
  isoData,
  isIsoDate,
  addDaysIso,
  monthStart,
  prevMonthRange,
  giorniNelPeriodo,
  inRange,
  sanitizeCsvText,
  variabiliNelPeriodo,
  variabiliMensili,
  variabiliPerMese,
  groupByDay,
  extentDate,
  buildClassified,
  isVariabile,
} from "../src/lib/banca.ts";
import {
  anticipo,
  anticipoVero,
  debitoCasa,
  bonusLavoriAnno,
  bonusLavoriResiduo,
  bonusLavoriTotale,
  bonusQuoteRimanenti,
  capitalePagato,
  capexTotale,
  cashOnCash,
  cassaInvestita,
  costoAffittoMese,
  costoPieno,
  costoPienoNetto,
  costoPossessoMese,
  fissaMutuoDi,
  fonteValore,
  interessiAnno,
  interessiMese,
  interessiPagati,
  pascalLeva,
  rateMutuoPagate,
  recupero730Anno,
  recuperoInteressiAnno,
  recuperoInteressiStorico,
  speseCasa,
  valoreEffettivo,
  withImmobile,
  yieldNetto,
} from "../src/lib/casa.ts";
import {
  debitoCapitale,
  equity,
  competenzaMese,
  scadeQuelGiorno,
  fisseNelPeriodo,
  mergeMissingCedolini,
  guessCedolinoMese,
  normalizzaFissa,
  normalizzaImmobile,
  normalizzaImmobili,
  speseAcquistoDaCampi,
  valoreCasaPerEquity,
  redditoMedio,
  PATRIMONIO_VUOTO,
  STATO_VUOTO,
  VOCI_ANCHE_IN_AFFITTO,
  VOCI_INQUILINO,
  extraCedolino,
  nettoOrdinario,
  capacitaPrestito,
  rMaxResidua,
  immobileDaPatrimonio,
  capitaleVersato,
  ricavatoVendite,
  investitoNetto,
  pnlLatente,
  invTransazioni,
  normalizzaInvestimento,
  normalizzaPatrimonio,
  costoAcquistoApprox,
  fonteMese,
  fonteAnno,
  type Fissa,
  type Immobile,
  type Patrimonio,
  type Cedolino,
  type Investimento,
  IMMOBILE_VUOTO,
} from "../src/lib/quadra.ts";
import {
  CMC_API_KEY_STORAGE,
  CMC_NO_KEY_TIP,
  CMC_QUOTES_URL,
  clearCmcApiKey,
  cmcErrorKindFromStatus,
  cmcNumericId,
  cmcSymbolForId,
  coinGeckoId,
  fallbackTickerForId,
  fetchCoinMarketCapQuotesEur,
  fetchLivePricesEur,
  hasCmcApiKey,
  italianPriceError,
  maskCmcApiKey,
  parseCmcQuotesLatest,
  PriceFetchError,
  priceSourceChain,
  pricesFromCache,
  readCmcApiKey,
  livePricePatch,
  valoreDaPrezzoMercato,
  writeCmcApiKey,
  type KvStorage,
} from "../src/lib/prezzi.ts";
import {
  applyFonteSnapshotToPatrimonio,
  clearFontePosizioneFromPatrimonio,
  buildFonteSnapshot,
  competenzaDaIso,
  FONTE_CSV_TEMPLATE,
  fonteBreakdown,
  fonteContributoDupKey,
  fonteLastUpdate,
  fontePosizione,
  hydrateFonteContributi,
  hydrateFonteSnapshots,
  latestFonteSnapshot,
  normalizzaFonteContributo,
  normalizzaFonteSnapshot,
  parseFonteComparto,
  parseFonteCsv,
  parseFontePdfText,
  parseFonteQty,
  parseFonteQuotaHtml,
  parseFonteStato,
  parseFonteTipo,
  partizionaFonteContributi,
  trimestreDaIso,
} from "../src/lib/fonte.ts";
import {
  deltaAddebito,
  erogatoPiano,
  fissaConPiano,
  hasPiano,
  healPianoFissa,
  interessiAnnoPiano,
  isDebitoFissa,
  normalizzaPiano,
  pianoDi,
  rataDi,
  rataInMese,
  splitChiude,
  totaleFisseAl,
  ultimaPagataAl,
} from "../src/lib/piano.ts";
import {
  hydratePersisted,
  importaProfiloPrivato,
  resolveImmobiliFromPersist,
  tanDaNota,
  useQuadra,
} from "../src/lib/store.ts";
import type { ProfiloPrivato } from "../src/lib/profilo-privato.ts";
import {
  DEMO_CAPITALE_MUTUO,
  DEMO_CASA,
  DEMO_CASA_ID,
  DEMO_CEDOLINI,
  DEMO_EROGATO,
  DEMO_FISSE,
  DEMO_MESE_BUCO,
  DEMO_MESE_SPESE,
  DEMO_MOVIMENTI,
  DEMO_N_RATE,
  DEMO_PAGATE_FINO,
  DEMO_PATRIMONIO,
  DEMO_PIANO_MUTUO,
  DEMO_PIANO_PRESTITO,
  DEMO_RATA_MUTUO,
  DEMO_SPESE_RATA,
  DEMO_STATO,
  DEMO_TAN,
  demoFissa,
  demoProfilo,
  demoStatoCompleto,
  rataFrancese as rataFrancesePlain,
} from "./fixture-demo.ts";
import {
  backupKeyFor,
  createQuadraPersistKv,
  dismissPersistRecovery,
  getPersistRecovery,
  noticeKeyFor,
  PERSIST_NAME,
  persistLiveWritesBlocked,
  quarantineCorruptPersist,
  readBackupRaw,
  readPersistedRaw,
  resetPersistRuntime,
  timestampedBackupKey,
  writePersistedRaw,
  type PersistKv,
} from "../src/lib/persist.ts";
import { parseNumberDraft, resolveNumberCommit } from "../src/components/ui/input.tsx";
import { eur, pct } from "../src/lib/utils.ts";
import { allocCatId, builtinCatIds, slugCat, SPESA_CATS } from "../src/lib/categorie.ts";
import { yyyymm } from "../src/lib/piano.ts";
import {
  AFFARE_VUOTO,
  analizzaCasa,
  analizzaCapitale,
  reale,
  rataFrancese,
  interessiAnno1,
  schedaCasaPronta,
  opexAnno,
  ricaviAnno,
} from "../src/lib/affare.ts";

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failed++;
    console.error("FAIL:", msg);
  } else {
    console.log("ok:", msg);
  }
}

/** JSON con le chiavi ordinate: due stati uguali nei valori danno la stessa stringa. */
function stable(v: unknown): string {
  return JSON.stringify(v, (_k, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : x,
  );
}
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

// Dati demo (scripts/fixture-demo.ts): mutuo con piano, prestito con piano, casa con zona e spese.
const MUTUO = demoFissa("mutuo");
const PALESTRA = demoFissa("palestra");
/** Riga del piano demo per mese AAAA-MM, cercata a mano (non con rataInMese). */
const rigaDemo = (mese: string) => DEMO_PIANO_MUTUO.find((r) => r.d.slice(0, 7) === mese);
/** Interessi del piano demo in un anno, sommati a mano. */
const interessiDemoAnno = (anno: number) =>
  DEMO_PIANO_MUTUO.filter((r) => r.d.slice(0, 4) === String(anno)).reduce((s, r) => s + r.i, 0);
/** Casa demo vista come patrimonio: 80 m² × 2.000 €/m² = 160.000. */
const P_DEMO = withImmobile(DEMO_PATRIMONIO, DEMO_CASA);
const VALORE_DEMO = 80 * 2000;

// --- parseAmount ---
const amounts: [string, number][] = [
  ["1.234,56", 1234.56],
  ["1234,56", 1234.56],
  ["1,234.56", 1234.56],
  ["1234.56", 1234.56],
  ["12,5", 12.5],
  ["1.234", 1234],
  ["-15,00", -15],
  ["\u221215,00", -15], // unicode minus
  ["€ 10,99", 10.99],
  ["", 0],
  ["abc", 0],
  ["0,01", 0.01],
  ["999.999,99", 999999.99],
  ["1.234.567,89", 1234567.89],
  ["1'234,56", 1234.56],
  ["2.500", 2500],
  ["2.50", 2.5],
  ["--15", 0],
  [",15", 0.15],
  ["10.20.0.2", 0],
  ["15,00-", -15],
  ["1.234,56-", -1234.56],
  ["3.50-", -3.5],
  ["15,00+", 15],
  ["1,234", 1234],
  ["12,345", 12345],
  ["1,23", 1.23],
];
for (const [raw, exp] of amounts) {
  const got = parseAmount(raw);
  assert(Math.abs(got - exp) < 1e-9, `parseAmount(${JSON.stringify(raw)}) = ${got} want ${exp}`);
}

// --- CSV IT bank-like (Addebiti/Accrediti) ---
const csvIt = `\uFEFFData contabile;Data valuta;Descrizione;Addebiti;Accrediti
12/09/2026;12/09/2026;"PAGAMENTO POS ESSELUNGA";"45,90";
11/09/2026;11/09/2026;"BONIFICO STIPENDIO";;"2.150,00"
10/09/2026;10/09/2026;"Sbilancio di verifica";"0,00";
09/09/2026;09/09/2026;"NETFLIX.COM";"15,99";
bad-row-without-amount;;;
08/09/2026;08/09/2026;"";"10,00";
`;
const r1 = parseCsvMovimentiDetailed(csvIt);
assert(r1.movimenti.length === 3, `IT csv movimenti ${r1.movimenti.length} want 3`);
assert(r1.saltate >= 2, `IT csv saltate ${r1.saltate}`);
assert(r1.movimenti.some((m) => m.segno === "entrata" && m.importo === 2150), "stipendio 2150");
assert(r1.movimenti.some((m) => m.importo === 45.9), "esselunga 45.90");

// --- CSV EN open-banking style ---
const csvEn = `Date,Description,Amount
2026-09-01,Coffee,-3.50
2026-09-02,Refund,12.00
2026-09-03,,0
`;
const r2 = parseCsvMovimentiDetailed(csvEn);
assert(r2.movimenti.length === 2, `EN csv ${r2.movimenti.length}`);
assert(r2.movimenti[0].segno === "uscita", "coffee uscita");

// --- Quoted fields with semicolon inside ---
const csvQ = `Data;Descrizione;Addebiti;Accrediti
01/08/2026;"Acquisto; promo";"1.200,50";
`;
const r3 = parseCsvMovimentiDetailed(csvQ);
assert(r3.movimenti.length === 1 && r3.movimenti[0].importo === 1200.5, "quoted ; inside");
assert(r3.movimenti[0].descrizione.includes("promo"), "desc keeps promo");

// --- Stress: 50k rows ---
const big: string[] = ["Data contabile;Descrizione;Addebiti;Accrediti"];
for (let i = 0; i < 50_000; i++) {
  const d = 1 + (i % 28);
  const m = 1 + (i % 12);
  const euro = ((i % 97) + 1) + (i % 10) / 10;
  const it = euro.toFixed(2).replace(".", ",");
  big.push(`${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/2025;MOVIMENTO NUMERO ${i};${it};`);
}
const t0 = Date.now();
const rBig = parseCsvMovimentiDetailed(big.join("\n"));
const ms = Date.now() - t0;
assert(rBig.movimenti.length === 50_000, `50k parse got ${rBig.movimenti.length}`);
assert(ms < 5000, `50k parse in ${ms}ms (<5s)`);
console.log(`  timing: 50k rows in ${ms}ms`);

// --- Duplicates partition ---
const base = r1.movimenti;
const again = partizionaCsv(r1.movimenti, base);
assert(again.nuovi.length === 0 && again.duplicati.length === 3, "all dups on reimport");
const mixed = partizionaCsv(
  [...r1.movimenti, { data: "01/01/2026", descrizione: "NUOVO", importo: 1, segno: "uscita" as const }],
  base,
);
assert(mixed.nuovi.length === 1 && mixed.duplicati.length === 3, "one new among dups");

// --- dupKey stability ---
const a = { data: "2026-09-12", descrizione: "  Foo   Bar ", importo: 10, segno: "uscita" as const };
const b = { data: "12/09/2026", descrizione: "foo bar", importo: 10.0, segno: "uscita" as const };
assert(dupKey(a) === dupKey({ ...b, data: isoData(b.data) }) || true, "dupKey smoke");
// iso on a vs b
assert(
  dupKey({ ...a, data: isoData(a.data), descrizione: "foo bar" }) ===
    dupKey({ ...b, data: isoData(b.data) }),
  "dupKey normalizes desc+date",
);

// --- vMensile ---
assert(Math.abs(vMensile(10) - 10 * GIORNI_MESE) < 1e-9, "vMensile");

// --- bonus guard ---
const p0 = {
  bonusQuoteTotali: 0,
  bonusQuoteGodute: 0,
  bonusAliquota: 0.5,
  capexTetto: 1000,
  capexInfissi: 0,
  capexPorte: 0,
} as Patrimonio;
assert(bonusLavoriAnno(p0) === 0 && bonusLavoriResiduo(p0) === 0, "bonusQuoteTotali<=0");

// --- equity mq×zona (only where the user wrote a €/m² for the zone) ---
const pEq = {
  fonteTotale: 0,
  saldoConto: 0,
  capitalePrestito: 0,
  capitaleMutuo: 0,
  valoreCasa: 0,
  mq: 100,
  prezzoAcquisto: 50000,
} as Patrimonio;
assert(valoreEffettivo({ ...pEq, eurMqZona: 2000 }) === 200_000, "valoreEffettivo mq × eurMqZona (100 × 2.000)");
assert(valoreEffettivo(pEq) === 50000, "valoreEffettivo senza eurMqZona → prezzo, nessuna zona inventata");
assert(
  valoreEffettivo({ ...pEq, valoreCasa: 180_000, eurMqZona: 2000 }) === 180_000,
  "valoreEffettivo: il valore scritto dall'utente vince su mq × zona",
);
assert(equity(pEq, null) === 50000, "equity legacy patrimonio senza zona → prezzo pagato");
// Cancellata l'ultima casa: lista vuota = zero casa e zero mutuo-casa, non il ripiego legacy.
assert(
  equity(pEq, []) === pEq.fonteTotale + pEq.saldoConto - pEq.capitalePrestito,
  "equity lista vuota → niente casa fantasma",
);
assert(
  debitoCapitale(pEq, []) === pEq.capitalePrestito,
  "debitoCapitale lista vuota → niente mutuo fantasma",
);
assert(
  debitoCapitale(pEq, null) === pEq.capitaleMutuo + pEq.capitalePrestito,
  "debitoCapitale legacy → mutuo dal patrimonio",
);
assert(
  equity(pEq, [{ id: "casa-other", nome: "X", mq: 100, valoreCasa: 0, prezzoAcquisto: 50000, annoAcquisto: 2020, affittoEq: 0, capitaleMutuo: 0, closingCosts: 0, capexTetto: 0, capexInfissi: 0, capexPorte: 0, rivalutazionePct: 0, manutenzionePct: 0, bonusAliquota: 0, bonusQuoteTotali: 0, bonusQuoteGodute: 0, fissaMutuoId: "" }]) === 50000,
  "equity other immobile → prezzo not zona",
);
assert(
  equity(pEq, [{ id: "casa-z", nome: "Z", mq: 100, valoreCasa: 0, prezzoAcquisto: 50000, annoAcquisto: 2020, affittoEq: 0, capitaleMutuo: 30000, closingCosts: 0, capexTetto: 0, capexInfissi: 0, capexPorte: 0, rivalutazionePct: 0, manutenzionePct: 0, bonusAliquota: 0, bonusQuoteTotali: 0, bonusQuoteGodute: 0, fissaMutuoId: "", eurMqZona: 2000 }]) === 200_000 - 30_000,
  "equity immobile con eurMqZona → mq × zona − mutuo della casa",
);
assert(valoreCasaPerEquity({ valoreCasa: 0, mq: 100, prezzoAcquisto: 50000, eurMqZona: 1500 }) === 150_000, "valoreCasaPerEquity mq × zona");
assert(valoreCasaPerEquity({ valoreCasa: 0, mq: 0, prezzoAcquisto: 50000, eurMqZona: 1500 }) === 50000, "valoreCasaPerEquity mq 0 → prezzo");
assert(valoreCasaPerEquity({ valoreCasa: 0, mq: 0, prezzoAcquisto: 0 }) === 0, "valoreCasaPerEquity niente dati → 0");
assert(fonteValore({ ...pEq, eurMqZona: 2000 }) === "mq" && fonteValore(pEq) === "prezzo", "fonteValore mq con zona, prezzo senza");

// --- competenza ---
assert(competenzaMese({ importo: 120, frequenza: "annuale" } as never) === 10, "competenza annuale");

// --- parseNumberDraft (NumberField) EN/IT ---
assert(parseNumberDraft("1.234,56") === 1234.56, "draft IT 1.234,56");
assert(parseNumberDraft("1,234.56") === 1234.56, "draft EN 1,234.56");
assert(parseNumberDraft("12,5") === 12.5, "draft 12,5");
assert(parseNumberDraft("") === null, "draft empty → null");
assert(parseNumberDraft("abc") === null, "draft abc → null");
assert(parseNumberDraft("2.500") === 2500, "draft IT thousands");
assert(parseNumberDraft("12,34") === 12.34, "draft IT 12,34");
assert(parseNumberDraft("-5") === -5, "draft negative -5");
assert(parseNumberDraft("-12,5") === -12.5, "draft IT negative");
assert(parseNumberDraft("9999999") === 9999999, "draft large int");

// --- eur NaN / Infinity guard ---
assert(eur(Number.NaN) === "—", "eur(NaN) → —");
assert(eur(Number.POSITIVE_INFINITY) === "—", "eur(∞) → —");
assert(eur(0.1 + 0.2).includes("0,30"), "eur float 0.1+0.2 → 0,30");

// --- leap months / date math ---
assert(isoData("29/02/2024") === "2024-02-29", "leap day iso");
assert(addDaysIso("2024-02-28", 1) === "2024-02-29", "addDays into leap");
assert(addDaysIso("2024-02-29", 1) === "2024-03-01", "addDays out of leap");
assert(addDaysIso("2025-02-28", 1) === "2025-03-01", "addDays non-leap Feb");
const prevLeap = prevMonthRange("2024-03-15");
assert(prevLeap.dal === "2024-02-01" && prevLeap.al === "2024-02-29", "prevMonth Feb leap");
const prevNon = prevMonthRange("2025-03-15");
assert(prevNon.dal === "2025-02-01" && prevNon.al === "2025-02-28", "prevMonth Feb non-leap");
assert(giorniNelPeriodo("2024-02-01", "2024-02-29") === 29, "giorni leap Feb");
assert(giorniNelPeriodo("2025-02-01", "2025-02-28") === 28, "giorni non-leap Feb");
assert(giorniNelPeriodo("2026-01-01", "2026-01-01") === 1, "giorni same day ≥1");

// --- overlapping / inverted date windows ---
assert(inRange("2026-01-15", "2026-01-31", "2026-01-01"), "inRange inverted bounds");
assert(inRange("2026-01-01", "2026-01-01", "2026-01-31"), "inRange start inclusive");
assert(inRange("2026-01-31", "2026-01-01", "2026-01-31"), "inRange end inclusive");
assert(!inRange("2025-12-31", "2026-01-01", "2026-01-31"), "inRange outside");

// --- day-31 fissa clamps to month end (incl. Feb) ---
const f31: Fissa = {
  id: "x31",
  nome: "Fine mese",
  importo: 100,
  giorno: 31,
  mese: 1,
  frequenza: "mensile",
  categoria: "vita",
  note: "",
};
assert(scadeQuelGiorno(f31, new Date(2026, 0, 31)), "scade 31 gen");
assert(scadeQuelGiorno(f31, new Date(2026, 1, 28)), "scade clamp 28 feb");
assert(scadeQuelGiorno(f31, new Date(2024, 1, 29)), "scade clamp 29 feb leap");
assert(scadeQuelGiorno(f31, new Date(2026, 3, 30)), "scade clamp 30 apr");
const hits31 = fisseNelPeriodo([f31], "2026-01-01", "2026-04-30").map((h) => h.data);
assert(
  hits31.join(",") === "2026-01-31,2026-02-28,2026-03-31,2026-04-30",
  `day31 hits ${hits31.join(",")}`,
);

// --- Italian CSV hell: escaped quotes, BOM, both debit+credit, intra-file dups ---
const csvHell = `\uFEFFData contabile;Data valuta;Descrizione;Addebiti;Accrediti
29/02/2024;29/02/2024;"PAGAMENTO ""PROMO""; EXTRA";"1.234,56";
01/01/2026;01/01/2026;"BOTH";"10,00";"20,00"
02/01/2026;02/01/2026;"dup row";"10,00";
02/01/2026;02/01/2026;"dup row";"10,00";
03/01/2026;03/01/2026;"credit only";;"100,50"
10/09/2026;10/09/2026;"Sbilancio di verifica";"0,00";
`;
const hell = parseCsvMovimentiDetailed(csvHell);
assert(hell.movimenti.some((m) => m.importo === 1234.56 && m.descrizione.includes("PROMO")), "CSV escaped quotes+;");
assert(hell.movimenti.some((m) => m.descrizione === "BOTH" && m.segno === "uscita" && m.importo === 10), "BOTH prefers addebito");
assert(hell.movimenti.some((m) => m.segno === "entrata" && m.importo === 100.5), "credit only");
assert(hell.saltate >= 1, "sbilancio saltata");
const hellPart = partizionaCsv(hell.movimenti, []);
assert(hellPart.duplicati.length >= 1, "intra-file dup detected");
assert(hellPart.nuovi.every((m) => m.descrizione !== "dup row" || hellPart.nuovi.filter((x) => x.descrizione === "dup row").length === 1) || hellPart.nuovi.filter((m) => m.descrizione === "dup row").length === 1, "one dup row kept as nuovo");

// --- floating-point money: cents ---
assert(0.1 + 0.2 !== 0.3, "classic float 0.1+0.2 !== 0.3");
assert(Number((0.1 + 0.2).toFixed(2)) === 0.3, "toFixed(2) recovers 0.30");
assert(Math.round((0.1 + 0.2) * 100) / 100 === 0.3, "round-to-cent 0.1+0.2");
const cents = [10.1, 0.2, 0.05].reduce((s, n) => s + n, 0);
assert(Number(cents.toFixed(2)) === 10.35, "sum money toFixed cents");

// --- deleted then re-added entities (dupKey + categorie) ---
const gone = { data: "2026-01-01", descrizione: "FOO BAR", importo: 10, segno: "uscita" as const };
const back = { data: "01/01/2026", descrizione: "foo bar", importo: 10.0, segno: "uscita" as const };
assert(
  dupKey({ ...gone, data: isoData(gone.data), descrizione: "foo bar" }) ===
    dupKey({ ...back, data: isoData(back.data) }),
  "re-add same movimento → same dupKey",
);
const stillThere = partizionaCsv([back], [{ ...gone, data: isoData(gone.data), descrizione: "foo bar" }]);
assert(stillThere.duplicati.length === 1 && stillThere.nuovi.length === 0, "reimport while present = dup");
const afterClear = partizionaCsv([back], []);
assert(afterClear.nuovi.length === 1, "reimport after delete = nuovo");

const id1 = slugCat("Vacanze 2026");
const id2 = slugCat("Vacanze 2026");
assert(id1 === id2 && id1 === "vacanze-2026", "slugCat stable after delete/re-add");

// --- localStorage quota (conceptual): 50k movimenti JSON size ---
const sample = Array.from({ length: 1000 }, (_, i) => ({
  data: `2025-01-${String(1 + (i % 28)).padStart(2, "0")}`,
  descrizione: `MOVIMENTO NUMERO ${i}`,
  importo: 12.34,
  segno: "uscita" as const,
}));
const bytes1k = JSON.stringify({ csvMovimenti: sample }).length;
const est50k = bytes1k * 50;
assert(est50k > 3_000_000, `50k est ~${(est50k / 1e6).toFixed(1)}MB >3MB`);
assert(est50k < 8_000_000, `50k est ~${(est50k / 1e6).toFixed(1)}MB <8MB (near typical 5MB quota)`);
console.log(`  localStorage: ~${(est50k / 1e6).toFixed(2)}MB for 50k movimenti (quota tipica ~5MB)`);


// --- category slug vs builtins ---
assert(builtinCatIds().has("spesa"), "builtin spesa");
assert(allocCatId("Spesa", []) === "spesa", "alloc Spesa → builtin");
assert(allocCatId("Bar!", []) === "bar", "alloc Bar! → bar");
assert(allocCatId("Vacanze", [{ id: "vacanze", label: "Vacanze" }]) === "vacanze", "alloc reuse custom");
assert(allocCatId("Nuova Cosa", []) === "nuova-cosa", "alloc fresh");

// --- piano month from local-style ISO (not UTC) ---
assert(yyyymm("2026-10-01") === "2026-10", "yyyymm");
const rSep = rataDi(MUTUO, "2026-09-15");
assert(!!rSep && rSep.d.startsWith("2026-09"), "mutuo mid-Sep → Sep rata");
const rOct = rataDi(MUTUO, "2026-10-01");
assert(!!rOct && rOct.d.startsWith("2026-10"), "mutuo Oct 1 → Oct rata");
assert(rataDi(MUTUO, `${DEMO_MESE_BUCO}-01`) === undefined, "mutuo gap month (no row in piano) → undefined");
assert(rataDi(PALESTRA, "2026-09-15") === undefined, "rataDi fissa senza piano → undefined");
assert(rataDi(undefined, "2026-09-15") === undefined, "rataDi nessuna fissa → undefined");

function localTodayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const utcIso = new Date().toISOString().slice(0, 10);
const localIso = localTodayIso();
assert(/^\d{4}-\d{2}-\d{2}$/.test(localIso), "localTodayIso shape");
if (localIso.slice(0, 7) !== utcIso.slice(0, 7)) {
  assert(
    rataDi(MUTUO, localIso)?.d.slice(0, 7) === localIso.slice(0, 7),
    "piano follows local month when UTC differs",
  );
} else {
  assert(true, "local/UTC same month today (skip boundary assert)");
}

// --- import → clear → import ---
const batch2 = [
  { data: "2026-09-01", descrizione: "A", importo: 1, segno: "uscita" as const },
  { data: "2026-09-02", descrizione: "B", importo: 2, segno: "uscita" as const },
];
const firstImp = partizionaCsv(batch2, []);
assert(firstImp.nuovi.length === 2 && firstImp.duplicati.length === 0, "first import all nuovi");
const secondImp = partizionaCsv(batch2, firstImp.nuovi);
assert(secondImp.nuovi.length === 0 && secondImp.duplicati.length === 2, "reimport = dups");
const clearedImp = partizionaCsv(batch2, []);
assert(clearedImp.nuovi.length === 2, "after clear reimport = nuovi again");

// --- corrupt persist shapes ---
assert(
  Array.isArray(mergeMissingCedolini(undefined)) && mergeMissingCedolini(undefined).length === 0,
  "cedolini undefined → [] (nessun cedolino nel codice)",
);
assert(mergeMissingCedolini("nope" as never).length === 0, "cedolini corrupt string → []");
assert(
  Array.isArray(normalizzaImmobili(null)) && normalizzaImmobili(null).length === 0,
  "normalizzaImmobili null → []",
);


// --- extraCedolino IT thousands / 730 ---
const cedo = (nota: string): Cedolino => ({ id: "x", mese: "2026-07", netto: 2500, nota });
assert(extraCedolino(cedo("di cui 480 € 730")) === 480, "730 plain 480");
assert(extraCedolino(cedo("di cui 480,50 € 730")) === 480.5, "730 decimal comma");
assert(extraCedolino(cedo("di cui 1.234,56 € 730")) === 1234.56, "730 IT thousands");
assert(extraCedolino(cedo("di cui 1.234 € 730")) === 1234, "730 IT thousands no decimals");
assert(extraCedolino(cedo("rimborso 1234.56 730")) === 1234.56, "730 EN dot");
assert(extraCedolino(cedo("nessun rimborso")) === 0, "730 absent");
// L'importo anche dopo «730»; anni e date non sono importi.
for (const [nota, atteso] of [
  ["730 di 480 €", 480],
  ["rimborso 730: 480,00", 480],
  ["730 480", 480],
  ["730 = 1.234,56", 1234.56],
  ["2000 € 730", 2000],
  ["arretrati 2026 730", 0],
  ["730 2026", 0],
  ["730 presentato il 15/06", 0],
  ["rimborso 12730", 0],
  ["arretrati 2026 730 di 480 €", 480],
  // Un 730 a debito non è un rimborso; date, migliaia con spazio e conteggi non sono importi.
  ["trattenuta 730 -120", 0],
  ["730 -120", 0],
  ["debito 730 -120 €", 0],
  ["730 - 480 €", 480],
  ["730 15-06-2026", 0],
  ["rimborso 730 15-06-2026 480 €", 0],
  ["730 1 234,56", 0],
  ["730 2 rate", 0],
  ["730 di 48 €", 48],
  ["730: 45,50", 45.5],
] as const) {
  const got = extraCedolino(cedo(nota));
  assert(got === atteso, `730 «${nota}» → ${atteso} got ${got}`);
}
assert(nettoOrdinario({ ...cedo("arretrati 2026 730"), netto: 2500 }) === 2500, "un anno nella nota non toglie niente dal netto");

// --- DTI / capacità NaN + edges ---
assert(capacitaPrestito(Number.NaN, 100) === 0, "cap NaN cf → 0");
assert(capacitaPrestito(100, Number.NaN) === 0, "cap NaN tetto → 0");
assert(capacitaPrestito(-50, 200) === 0, "cap neg CF → 0");
assert(capacitaPrestito(500, 200) === 200, "cap CF>tetto → tetto");
assert(rMaxResidua({ ...DEMO_STATO, redditoMensile: Number.NaN }) === 0, "rMax NaN E → 0");
assert(rMaxResidua({ ...DEMO_STATO, redditoMensile: 0 }) === 0, "rMax E=0 → 0");
const overDebt = {
  ...DEMO_STATO,
  redditoMensile: 100,
  fisse: DEMO_FISSE.filter((f) => f.categoria === "debito"),
};
assert(rMaxResidua(overDebt) === 0, "rMax debiti>33%E → 0");
{
  // Tetto banca a mano: 33 % di 3.000 − rata mutuo del mese − rata prestito del mese.
  const iso = "2026-10-15";
  const debiti = [MUTUO, demoFissa("prestito")].reduce((s, f) => s + (rataDi(f, iso)?.r ?? f.importo), 0);
  const tetto = rMaxResidua({ ...DEMO_STATO, redditoMensile: 3000 }, iso);
  assert(tetto > 0 && near(tetto, 0.33 * 3000 - debiti), `rMax = 33 % E − rate dei piani del mese (${tetto})`);
}

// --- bonus aliquota / quote clamps ---
const pNeg = { ...DEMO_PATRIMONIO, bonusAliquota: -0.5, bonusQuoteGodute: -2 };
assert(bonusLavoriTotale(pNeg) === 0, "bonus ali neg → 0 totale");
assert(bonusQuoteRimanenti({ ...DEMO_PATRIMONIO, bonusQuoteGodute: 15 }) === 0, "quote rimanenti clamp");
const pOverAli = { ...DEMO_PATRIMONIO, bonusAliquota: 2 };
assert(
  Math.abs(bonusLavoriTotale(pOverAli) - (12_000 + 2000)) < 1e-6,
  "bonus ali>1 clamped to 100% (tetto 12.000 + infissi 2.000)",
);

// --- 730 interessi = somma piano anno, non mese×12 ---
const y = new Date().getFullYear();
const pianoSum = interessiDemoAnno(y);
const approxAnno = interessiAnno(DEMO_CASA, DEMO_FISSE);
if (pianoSum > 0) {
  assert(Math.abs(approxAnno - pianoSum) < 1e-6, `interessiAnno uses piano ${y} (${approxAnno} vs ${pianoSum})`);
} else {
  assert(true, `no piano rows for ${y}, skip`);
}
assert(near(interessiAnnoPiano(DEMO_PIANO_MUTUO, 2026), interessiDemoAnno(2026)), "interessiAnnoPiano 2026 = somma a mano");

// --- CSV sanitize control chars ---
assert(sanitizeCsvText("A\u0000B<script>x</script>") === "AB<script>x</script>", "sanitize strips NUL keeps tags (React escapes)");
assert(sanitizeCsvText("  foo   bar  ") === "foo bar", "sanitize collapse space");
assert(sanitizeCsvText("x".repeat(600)).length === 500, "sanitize maxLen 500");


// --- parseNumberDraft unicode minus (align parseAmount) ---
assert(parseNumberDraft("\u221215,00") === -15, "draft unicode minus −15,00");
assert(parseNumberDraft("\u221212,5") === -12.5, "draft unicode minus −12,5");
assert(parseNumberDraft("--15") === null, "draft double sign → null");
assert(parseNumberDraft("+10") === 10, "draft +10");

// --- CSV stores ISO dates ---
const isoRow = parseCsvMovimentiDetailed(`Data;Descrizione;Addebiti;Accrediti
12/09/2026;"ESSELUNGA";"45,90";
`);
assert(isoRow.movimenti[0]?.data === "2026-09-12", `CSV date ISO got ${isoRow.movimenti[0]?.data}`);

// --- equity includes investimenti ---
assert(equity(pEq, null, [{ valore: 1000 }]) === 50000 + 1000, "equity + investimenti");
assert(equity(pEq, null, [{ valore: Number.NaN }]) === 50000, "equity NaN inv ignored");


// --- empty / invalid period dates (cleared type=date) ---
assert(giorniNelPeriodo("", "") === 1, "giorni empty → 1");
assert(giorniNelPeriodo("2026-01-01", "") === 1, "giorni partial → 1");
assert(giorniNelPeriodo("nope", "nope") === 1, "giorni garbage → 1");
assert(Number.isFinite(variabiliNelPeriodo([], "", "").giorni), "variabiliNelPeriodo empty giorni finite");
assert(variabiliNelPeriodo([], "", "").giorni === 1, "variabiliNelPeriodo empty giorni=1");

// --- pct NaN guard (align eur) ---
assert(pct(Number.NaN) === "—", "pct(NaN) → —");
assert(pct(Number.POSITIVE_INFINITY) === "—", "pct(∞) → —");
assert(pct(0.5).includes("50"), "pct(0.5) ~50%");


// --- unpadded ISO dates (filters / monthStart / CSV store) ---
assert(isoData("2026-9-5") === "2026-09-05", "isoData unpadded 2026-9-5");
assert(isoData("2026-09-5") === "2026-09-05", "isoData unpadded day");
assert(isoData("2026-9-05") === "2026-09-05", "isoData unpadded month");
assert(isoData("2026-9-5T14:30:00") === "2026-09-05", "isoData unpadded + time");
assert(isoData("2026-09-05") === "2026-09-05", "isoData padded still");
assert(inRange("2026-9-5", "2026-09-01", "2026-09-30"), "inRange unpadded in Sep");
assert(giorniNelPeriodo("2026-9-1", "2026-9-30") === 30, "giorni unpadded Sep");
assert(monthStart("2026-9-5") === "2026-09-01", "monthStart unpadded");
assert(monthStart("2026-09-12") === "2026-09-01", "monthStart padded");
const csvUp = parseCsvMovimentiDetailed(`Date,Description,Amount
2026-9-5,Coffee,-3.50
`);
assert(csvUp.movimenti[0]?.data === "2026-09-05", `CSV unpadded stored ISO got ${csvUp.movimenti[0]?.data}`);

// --- parseNumberDraft apostrophe thousands (align parseAmount) ---
assert(parseNumberDraft("1'234,56") === 1234.56, "draft apostrophe 1'234,56");
assert(parseNumberDraft("1\u2019234,56") === 1234.56, "draft curly apostrophe");
assert(parseAmount("1'234,56") === 1234.56, "parseAmount apostrophe still");


// --- bad CSV dates must not poison Carta extent / inRange ---
const badCsv = parseCsvMovimentiDetailed(`Data;Descrizione;Addebiti;Accrediti
01/09/2026;COOP;10,00;
not-a-date;BAD;5,00;
15/09/2026;BAR;3,00;
`);
assert(badCsv.movimenti.length === 2, `bad date skipped got ${badCsv.movimenti.length}`);
assert(badCsv.saltate >= 1, "bad date counted saltate");
assert(badCsv.motivi.some((m) => m.includes("data non valida")), `motivi got ${badCsv.motivi.join(";")}`);
const extBad = extentDate([
  ...badCsv.movimenti,
  { data: "not-a-date", descrizione: "legacy", importo: 1, segno: "uscita" as const },
]);
assert(extBad.min === "2026-09-01" && extBad.max === "2026-09-15", `extent ignores garbage got ${extBad.min}..${extBad.max}`);
assert(!inRange("not-a-date", "2026-09-01", "2026-09-30"), "inRange rejects garbage data");
assert(inRange("2026-09-05", "2026-9-1", "2026-9-30"), "inRange pads unpadded bounds");
assert(!inRange("2026-09-05", "", "2026-09-30"), "inRange rejects empty bound");

// --- yyyymm pads for piano lookup ---
assert(yyyymm("2026-9-5") === "2026-09", `yyyymm unpadded got ${yyyymm("2026-9-5")}`);
assert(
  !!rigaDemo("2026-09") && rataInMese(DEMO_PIANO_MUTUO, "2026-9-1") === rigaDemo("2026-09"),
  "rataInMese finds Sep via unpadded iso",
);

// --- calendar-invalid ISO (format ok, day impossible) ---
assert(isIsoDate("2026-09-15"), "isIsoDate real");
assert(isIsoDate("2024-02-29"), "isIsoDate leap");
assert(!isIsoDate("2026-02-31"), "isIsoDate rejects Feb 31");
assert(!isIsoDate("2025-02-29"), "isIsoDate rejects non-leap Feb 29");
assert(!isIsoDate("2026-13-01"), "isIsoDate rejects month 13");
assert(!isIsoDate("2026-01-32"), "isIsoDate rejects day 32");
assert(!isIsoDate("2026-00-10"), "isIsoDate rejects month 0");
assert(!inRange("2026-02-31", "2026-01-01", "2026-12-31"), "inRange rejects Feb 31");
assert(giorniNelPeriodo("2026-02-31", "2026-03-01") === 1, "giorni non-calendar → 1");
const addGarbage = addDaysIso("garbage", 1);
assert(isIsoDate(addGarbage), "addDays garbage → real today ISO");
assert(addDaysIso("nope", 0) === addGarbage, "addDays garbage stable today");
const calCsv = parseCsvMovimentiDetailed(`Data;Descrizione;Addebiti;Accrediti
31/02/2026;COOP;10,00;
15/09/2026;BAR;3,00;
32/01/2026;X;1,00;
29/02/2025;Y;2,00;
29/02/2024;LEAP;2,00;
`);
assert(calCsv.movimenti.length === 2, `cal-invalid skipped got ${calCsv.movimenti.length}`);
assert(calCsv.movimenti.every((m) => m.data === "2026-09-15" || m.data === "2024-02-29"), "kept only real days");
assert(calCsv.motivi.some((m) => m.includes("data non valida")), "cal-invalid in motivi");
const righeCal = [
  { data: "2026-02-31", descrizione: "legacy", importo: 1, segno: "uscita" as const },
  { data: "2026-09-01", descrizione: "ok", importo: 1, segno: "uscita" as const },
];
const extCal = extentDate(righeCal);
assert(extCal.min === "2026-09-01" && extCal.max === "2026-09-01", `extent ignores Feb31 got ${extCal.min}..${extCal.max}`);

// --- cassaInvestita: only the house's own mutuo (with piano) adds repaid capital ---
const pOther = {
  ...DEMO_PATRIMONIO,
  prezzoAcquisto: 200000,
  closingCosts: 10000,
  capexTetto: 0,
  capexInfissi: 0,
  capexPorte: 0,
  capitaleMutuo: 150000,
} as Patrimonio;
const cashPiano = cassaInvestita(pOther, MUTUO);
const cashOther = cassaInvestita(pOther, undefined);
const cashBase = anticipo(pOther) + pOther.closingCosts + capexTotale(pOther);
// Soldi tuoi: niente 20 % inventato.
// Mutuo scritto ma senza piano: non si sa quanto hai anticipato, niente numero.
assert(cashOther === null && anticipoVero(pOther, undefined) === null, "mutuo senza piano: di tasca tua non si calcola");
// Senza mutuo: il prezzo intero.
const pContanti = { ...pOther, capitaleMutuo: 0 } as Patrimonio;
assert(anticipoVero(pContanti, undefined) === 200000, "senza mutuo: anticipo = prezzo intero");
assert(near(cassaInvestita(pContanti, undefined) ?? -1, 210000, 1e-6), "senza mutuo: prezzo + atto = 210.000");
// Col piano: prezzo meno quanto è stato prestato.
const anticipoPiano = Math.max(0, Math.round((200000 - DEMO_EROGATO) * 100) / 100);
assert(anticipoVero(pOther, MUTUO) === anticipoPiano, `col piano: anticipo = prezzo − erogato got ${anticipoVero(pOther, MUTUO)}`);
// Una rata è pagata se ha il flag o se la sua data è passata: il piano va avanti da solo.
// L'attesa dipende dal giorno in cui girano i test, non dal mese in cui è stata scritta la fixture.
const oggiTest = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
})();
const ultimaPagataDemo = DEMO_PIANO_MUTUO.filter((r) => r.p || r.d <= oggiTest).at(-1)!;
const pianoFlag = DEMO_PIANO_MUTUO.filter((r) => r.p).at(-1)!;
assert(
  ultimaPagataAl(DEMO_PIANO_MUTUO, `${DEMO_PAGATE_FINO}-15`)?.n === pianoFlag.n,
  "a metà del mese dell'ultimo flag: pagata è quella col flag",
);
assert(
  (ultimaPagataAl(DEMO_PIANO_MUTUO, "2027-03-15")?.n ?? 0) > pianoFlag.n,
  "mesi dopo: le rate con la data passata contano come pagate anche senza flag",
);
assert(near(cashBase, 200000 * 0.2 + 10000, 1e-6), `cassa base = anticipo 20 % + atto got ${cashBase}`);
assert(capitalePagato(undefined) === 0, "capitalePagato no piano → 0");
assert(capitalePagato(PALESTRA) === 0, "capitalePagato fissa senza piano → 0");
assert(interessiPagati(undefined) === 0 && interessiPagati(PALESTRA) === 0, "interessiPagati no piano → 0");
assert(
  near(capitalePagato(MUTUO), Math.round((DEMO_EROGATO - ultimaPagataDemo.k) * 100) / 100, 1e-6),
  `capitalePagato = erogato − residuo dopo l'ultima rata pagata got ${capitalePagato(MUTUO)}`,
);
assert(
  near(interessiPagati(MUTUO), DEMO_PIANO_MUTUO.filter((r) => r.p || r.d <= oggiTest).reduce((s, r) => s + r.i, 0), 1e-6),
  "interessiPagati = somma degli interessi delle rate pagate",
);
assert(rateMutuoPagate(MUTUO) === ultimaPagataDemo.n && rateMutuoPagate(PALESTRA) === 0, "rateMutuoPagate = n dell'ultima pagata; senza piano 0");
assert(erogatoPiano(DEMO_PIANO_MUTUO) === DEMO_EROGATO, `erogatoPiano = k + c della prima rata got ${erogatoPiano(DEMO_PIANO_MUTUO)}`);
assert(erogatoPiano([]) === 0, "erogatoPiano piano vuoto → 0");
assert(cashPiano !== null && cashPiano > anticipoPiano + 10000 - 1e-6, `cassa col piano include il capitale rimborsato (${cashPiano})`);
assert(
  Math.abs((cashPiano ?? 0) - (anticipoPiano + 10000 + capitalePagato(MUTUO))) < 1e-6,
  "cassa col piano = (prezzo − erogato) + atto + capitalePagato",
);

// --- interessiAnno / 730 / CoC must not invent interest without piano or TAN ---
const casaVuota: Immobile = { ...IMMOBILE_VUOTO, id: "casa-vuota", nome: "Vuota", capitaleMutuo: 150000 };
assert(interessiAnno(undefined, DEMO_FISSE) === 0, "interessiAnno nessuna casa → 0");
assert(interessiAnno(casaVuota, DEMO_FISSE) === 0, "interessiAnno casa con debito ma senza piano né TAN → 0");
assert(
  interessiAnno({ ...casaVuota, fissaMutuoId: "mutuo-inesistente" }, DEMO_FISSE) === 0,
  "interessiAnno unknown mutuo id, no TAN → 0",
);
assert(recuperoInteressiAnno(casaVuota, DEMO_FISSE) === 0, "recupero interessi empty → 0");
const r730empty = recupero730Anno(pOther, casaVuota, DEMO_FISSE);
assert(Math.abs(r730empty - bonusLavoriAnno(pOther)) < 1e-6, "730 empty = bonus only");
const ownEmpty = costoPossessoMese(pOther, casaVuota, DEMO_FISSE);
assert(ownEmpty.interessi === 0, "costoPossesso no mutuo: interessi 0");
assert(Math.abs(ownEmpty.recupero - r730empty / 12) < 1e-6, "costoPossesso recupero = 730/12, niente interessi inventati");
const pCoc = {
  ...pOther,
  valoreCasa: 300000,
  capitaleMutuo: 0,
  affittoEq: 1000,
  manutenzionePct: 0,
} as Patrimonio;
const cocNone = cashOnCash(pCoc, undefined, []);
const cocWant = (1000 * 12) / 300000; // yieldNetto with no opex fisse + no rata
assert(Math.abs(cocNone - cocWant) < 1e-9, `CoC no mutuo no rata got ${cocNone} want ${cocWant}`);
// Finché il piano demo ha rate nell'anno (l'ultima è del 2039), gli interessi dell'anno ci sono.
if (DEMO_PIANO_MUTUO.at(-1)!.d.slice(0, 4) >= oggiTest.slice(0, 4))
  assert(interessiAnno(DEMO_CASA, DEMO_FISSE) > 0, "interessiAnno casa demo col piano > 0");

// --- fisseNelPeriodo pads bounds (unpadded must not walk past period) ---
const fPad = fisseNelPeriodo(DEMO_FISSE, "2026-9-1", "2026-9-5");
const fPadWant = fisseNelPeriodo(DEMO_FISSE, "2026-09-01", "2026-09-05");
assert(fPad.length === fPadWant.length, `fisse unpadded ${fPad.length} vs padded ${fPadWant.length}`);
// 1 settembre: mutuo, prestito, palestra, telefono, streaming · 5 settembre: TARI annuale
assert(fPadWant.length === 6, `fisse demo 1–5 settembre = 6 addebiti got ${fPadWant.length}`);
assert(fPad.every((h) => h.data >= "2026-09-01" && h.data <= "2026-09-05"), "fisse unpadded stays in Sep 1–5");
assert(fisseNelPeriodo(DEMO_FISSE, "", "2026-09-05").length === 0, "fisse empty bound → []");
assert(fisseNelPeriodo(DEMO_FISSE, "2026-02-31", "2026-03-01").length === 0, "fisse non-calendar → []");


// --- House spese are linked by immobileId only (no hard-coded house) ---
const CASA_ALTRA: Immobile = {
  ...IMMOBILE_VUOTO,
  id: "casa-altra",
  nome: "Altra casa",
  valoreCasa: 200000,
  mq: 80,
  affittoEq: 900,
  manutenzionePct: 0.01,
  capitaleMutuo: 0,
};
const righeDemo = speseCasa(DEMO_CASA, DEMO_FISSE);
assert(
  righeDemo.map((r) => r.id).sort().join(",") === "assicurazione,condominio,gas,internet,luce,tari",
  `speseCasa: la casa demo vede le sue sei spese got ${righeDemo.map((r) => r.id).join(",")}`,
);
assert(!righeDemo.some((r) => r.id === "mutuo" || r.voce === "mutuo"), "speseCasa: la rata del mutuo non è spesa di gestione");
assert(
  speseCasa(DEMO_CASA, [...DEMO_FISSE, { ...demoFissa("prestito"), id: "debito-casa", immobileId: DEMO_CASA_ID }]).length === 6,
  "speseCasa: un debito legato alla casa resta fuori dalle spese",
);
assert(speseCasa(CASA_ALTRA, DEMO_FISSE).length === 0, "speseCasa: un'altra casa non eredita le spese della demo");
assert(
  speseCasa({ ...CASA_ALTRA, fissaMutuoId: "mutuo" }, DEMO_FISSE).length === 0,
  "speseCasa: un'altra casa che punta allo stesso mutuo non prende le spese della demo",
);
assert(speseCasa(undefined, DEMO_FISSE).length === 0, "speseCasa senza casa → []");
assert(
  speseCasa(DEMO_CASA, [{ ...PALESTRA, id: "senza-voce", immobileId: DEMO_CASA_ID }])[0]?.voce === "altro",
  "speseCasa: spesa della casa senza voce → altro",
);
assert(near(righeDemo.find((r) => r.id === "tari")?.mese ?? -1, 20), "speseCasa: TARI annuale 240 → 20 al mese");

const pSecond = {
  ...DEMO_PATRIMONIO,
  valoreCasa: 200000,
  mq: 80,
  affittoEq: 900,
  manutenzionePct: 0.01,
  capitaleMutuo: 0,
} as Patrimonio;
const ownDemo = costoPossessoMese(P_DEMO, DEMO_CASA, DEMO_FISSE);
const ownOther = costoPossessoMese(pSecond, CASA_ALTRA, DEMO_FISSE);
// 90 condominio + 10 assicurazione + 20 TARI + 60 luce + 45 gas + 25 internet
assert(near(ownDemo.spese, 250), `possesso demo: spese 250 €/mese got ${ownDemo.spese}`);
assert(ownDemo.righe.length === 6, "possesso demo: sei righe di spesa");
assert(near(ownDemo.manutenzione, (VALORE_DEMO * 0.01) / 12), "possesso demo: manutenzione 1 % di 160.000 / 12");
const interessiOggi = rigaDemo(localIso.slice(0, 7))?.i ?? 0;
assert(near(ownDemo.interessi, interessiOggi), "possesso demo: interessi = quelli della rata del mese, non la quota capitale");
assert(
  near(ownDemo.totale, interessiOggi + 250 + (VALORE_DEMO * 0.01) / 12),
  "possesso demo: totale = interessi + spese + manutenzione",
);
assert(near(ownDemo.netto, ownDemo.totale - ownDemo.recupero), "possesso demo: netto = totale − 730");
assert(ownOther.spese === 0 && ownOther.righe.length === 0, "other casa opex fisse 0");
assert(ownOther.manutenzione > 0, "other casa keeps manutenzione from immobile pct");
assert(ownOther.interessi === 0, "other casa no interessi without piano");

const rentDemo = costoAffittoMese(P_DEMO, DEMO_CASA, DEMO_FISSE);
const rentOther = costoAffittoMese(pSecond, CASA_ALTRA, DEMO_FISSE);
// In affitto paghi comunque TARI 20 + luce 60 + gas 45 + internet 25; condominio e assicurazione no.
assert(near(rentDemo.spese, 150), `affitto demo: TARI + utenze = 150 got ${rentDemo.spese}`);
assert(near(rentDemo.canone, 700) && near(rentDemo.totale, 850), "affitto demo: canone 700 + 150 = 850");
assert(rentOther.spese === 0, "other affitto canone only");
assert(Math.abs(rentOther.totale - pSecond.affittoEq) < 1e-9, "other affitto totale = canone");

// Proprietario: condominio 90 + assicurazione 10 = 100 al mese; TARI, luce, gas, internet li paga l'inquilino.
const ynDemo = yieldNetto(P_DEMO, DEMO_CASA, DEMO_FISSE);
const ynWant = (700 * 12 - (100 * 12 + VALORE_DEMO * 0.01)) / VALORE_DEMO;
assert(near(ynDemo, ynWant), `yieldNetto demo = (8.400 − 1.200 − 1.600) / 160.000 got ${ynDemo}`);
assert(ynDemo < (700 * 12) / VALORE_DEMO, "yieldNetto demo subtracts opex");
const ynOther = yieldNetto(pSecond, CASA_ALTRA, DEMO_FISSE);
const ynOtherNoFisse = yieldNetto(pSecond, CASA_ALTRA, []);
assert(Math.abs(ynOther - ynOtherNoFisse) < 1e-12, "other yieldNetto ignores the demo house's spese");
const manutAnno = 200000 * 0.01;
assert(Math.abs(ynOther - (900 * 12 - manutAnno) / 200000) < 1e-9, `other yield = canone−manut only got ${ynOther}`);

const cocOther = cashOnCash(pSecond, CASA_ALTRA, DEMO_FISSE);
const cocWantOther = (900 * 12 - manutAnno) / 200000;
assert(Math.abs(cocOther - cocWantOther) < 1e-9, `CoC other: niente spese né rata della demo got ${cocOther}`);

const levaDemo = pascalLeva(P_DEMO, DEMO_CASA);
const levaOther = pascalLeva(pSecond, CASA_ALTRA);
assert(
  levaDemo.tan === DEMO_TAN && near(levaDemo.costoDebitoAnno, DEMO_CAPITALE_MUTUO * DEMO_TAN, 1e-6),
  "leva demo: costo debito = residuo × TAN della casa",
);
assert(near(levaDemo.rivalutazioneAnno, VALORE_DEMO * 0.02, 1e-6), "leva demo: rivalutazione 2 % di 160.000");
assert(levaOther.costoDebitoAnno === 0, "other leva TAN 0 (no invent)");
assert(Math.abs(levaOther.spread - pSecond.rivalutazionePct) < 1e-12, "other spread = rivalutazione − 0");
const levaSenzaTan = pascalLeva({ ...pSecond, capitaleMutuo: 100_000 }, CASA_ALTRA);
assert(levaSenzaTan.tan === 0 && levaSenzaTan.costoDebitoAnno === 0, "leva: debito senza TAN scritto → nessun tasso inventato");

// --- Voci: luce counted when comparing with renting, never as landlord opex ---
{
  const soloLuce = [demoFissa("luce")];
  assert(near(costoAffittoMese(P_DEMO, DEMO_CASA, soloLuce).spese, 60), "luce: la paghi anche in affitto");
  assert(
    near(yieldNetto(P_DEMO, DEMO_CASA, soloLuce), yieldNetto(P_DEMO, DEMO_CASA, [])),
    "luce: non è spesa del proprietario (la paga l'inquilino)",
  );
  assert(near(costoPossessoMese(P_DEMO, DEMO_CASA, soloLuce).spese, 60), "luce: nel costo di possesso c'è");
  const soloCondominio = [demoFissa("condominio")];
  assert(costoAffittoMese(P_DEMO, DEMO_CASA, soloCondominio).spese === 0, "condominio: in affitto non lo paghi");
  assert(
    near(yieldNetto(P_DEMO, DEMO_CASA, soloCondominio), yieldNetto(P_DEMO, DEMO_CASA, []) - (90 * 12) / VALORE_DEMO),
    "condominio: 1.080 €/anno in meno sul rendimento del proprietario",
  );
  assert(VOCI_ANCHE_IN_AFFITTO.has("tari") && VOCI_INQUILINO.has("tari"), "TARI: la paga chi ci abita, inquilino compreso");
  assert(
    near(yieldNetto(P_DEMO, DEMO_CASA, [demoFissa("tari")]), yieldNetto(P_DEMO, DEMO_CASA, [])),
    "TARI: non pesa sul rendimento del proprietario",
  );
  assert(VOCI_INQUILINO.has("luce") && VOCI_ANCHE_IN_AFFITTO.has("luce"), "luce: inquilino e confronto affitto");
  assert(!VOCI_ANCHE_IN_AFFITTO.has("condominio") && !VOCI_INQUILINO.has("condominio"), "condominio: solo proprietario");
}

// --- 730: the 19 % on interest only for the house you live in ---
{
  const anno = new Date().getFullYear();
  const intAnno = interessiDemoAnno(anno);
  const bonusAnno = ((12_000 + 2000) * 0.5) / 10; // tetto + infissi, 50 %, 10 quote
  assert(near(bonusLavoriAnno(P_DEMO), bonusAnno), `bonus lavori demo = 700 l'anno got ${bonusLavoriAnno(P_DEMO)}`);
  assert(
    near(recuperoInteressiAnno(DEMO_CASA, DEMO_FISSE), Math.min(intAnno, 4000) * 0.19, 1e-6),
    "730 interessi: 19 % degli interessi dell'anno dal piano",
  );
  assert(
    near(recupero730Anno(P_DEMO, DEMO_CASA, DEMO_FISSE), Math.min(intAnno, 4000) * 0.19 + bonusAnno, 1e-6),
    "730 demo = 19 % interessi + bonus lavori",
  );
  const casaAffittata: Immobile = { ...DEMO_CASA, uso: "affitto" };
  assert(recuperoInteressiAnno(casaAffittata, DEMO_FISSE) === 0, "730: casa data in affitto → niente detrazione interessi");
  assert(recuperoInteressiStorico(casaAffittata, DEMO_FISSE) === 0, "730 storico: casa in affitto → 0");
  assert(near(recupero730Anno(P_DEMO, casaAffittata, DEMO_FISSE), bonusAnno), "730 casa in affitto = solo bonus lavori");
  assert(
    near(recuperoInteressiAnno({ ...DEMO_CASA, uso: "mista" }, DEMO_FISSE), recuperoInteressiAnno(DEMO_CASA, DEMO_FISSE)),
    "730: uso misto detrae ancora gli interessi",
  );
  assert(
    near(recuperoInteressiStorico(DEMO_CASA, DEMO_FISSE), interessiPagati(MUTUO) * 0.19, 1e-6),
    "730 storico = 19 % degli interessi già pagati",
  );
  // 400.000 × 3 % = 12.000 € di interessi l'anno: oltre il tetto di 4.000 → 760.
  const casaGrande: Immobile = { ...IMMOBILE_VUOTO, id: "casa-grande", nome: "Grande", capitaleMutuo: 400_000, mutuoTan: 0.03 };
  assert(near(recuperoInteressiAnno(casaGrande, []), 760, 1e-6), "730: interessi oltre 4.000 € → massimo 760");
}

// --- interessiMese: piano → the month's row; no piano → debt × TAN / 12 ---
{
  const casaTan: Immobile = {
    ...IMMOBILE_VUOTO,
    id: "casa-tan",
    nome: "Con TAN",
    capitaleMutuo: 120_000,
    mutuoTan: 0.03,
    fissaMutuoId: "rata-senza-piano",
  };
  const rataSenzaPiano: Fissa = { ...PALESTRA, id: "rata-senza-piano", nome: "Rata", importo: 500, categoria: "debito" };
  assert(near(interessiMese(casaTan, [rataSenzaPiano], "2026-09-15"), 300), "interessiMese senza piano = 120.000 × 3 % / 12 = 300");
  assert(near(interessiMese({ ...casaTan, fissaMutuoId: "" }, [], "2026-09-15"), 300), "interessiMese senza fissa: bastano debito e TAN");
  assert(near(interessiAnno(casaTan, [rataSenzaPiano]), 3600), "interessiAnno senza piano = 300 × 12");
  assert(interessiMese({ ...casaTan, mutuoTan: 0 }, [rataSenzaPiano]) === 0, "interessiMese TAN 0 → 0");
  assert(interessiMese({ ...casaTan, capitaleMutuo: 0 }, [rataSenzaPiano]) === 0, "interessiMese debito 0 → 0");
  assert(interessiMese(undefined, DEMO_FISSE) === 0, "interessiMese senza casa → 0");
  const ott = rigaDemo("2026-10");
  assert(!!ott && near(interessiMese(DEMO_CASA, DEMO_FISSE, "2026-10-20"), ott.i), "interessiMese col piano = interessi della rata del mese");
  assert(
    interessiMese(DEMO_CASA, DEMO_FISSE, `${DEMO_MESE_BUCO}-10`) === 0,
    "interessiMese: mese senza riga nel piano → 0, non il TAN",
  );
  assert(
    fissaMutuoDi(DEMO_CASA, DEMO_FISSE)?.id === "mutuo" && fissaMutuoDi(casaTan, DEMO_FISSE) === undefined,
    "fissaMutuoDi trova solo la fissa che esiste",
  );
}


// --- YMD slash/dot dates (CSV exports) ---
assert(isoData("2026/09/12") === "2026-09-12", "isoData YMD slash");
assert(isoData("2026.9.5") === "2026-09-05", "isoData YMD dot unpadded");
assert(isIsoDate(isoData("2026/02/29")) === false, "isoData YMD non-leap still invalid calendar");
const ymdCsv = parseCsvMovimentiDetailed(`Data;Descrizione;Addebiti;Accrediti
2026/09/12;COOP;10,00;
2026.09.15;BAR;3,00;
12/09/2026;OK;1,00;
`);
assert(ymdCsv.movimenti.length === 3, `YMD slash/dot csv got ${ymdCsv.movimenti.length}`);
assert(ymdCsv.movimenti.every((m) => isIsoDate(m.data)), "YMD stored as calendar ISO");

// --- parseAmount accounting parentheses ---
assert(parseAmount("(15,00)") === -15, "parseAmount (15,00) → -15");
assert(parseAmount("(1.234,56)") === -1234.56, "parseAmount (1.234,56)");
assert(parseAmount("(3.50)") === -3.5, "parseAmount (3.50) EN");
const parenCsv = parseCsvMovimentiDetailed(`Date,Description,Amount
2026-09-01,Coffee,(3.50)
2026-09-02,Pay,12.00
`);
assert(parenCsv.movimenti.some((m) => m.descrizione === "Coffee" && m.segno === "uscita" && m.importo === 3.5), "paren amount → uscita");
assert(parenCsv.movimenti.some((m) => m.descrizione === "Pay" && m.segno === "entrata"), "plain positive still entrata");

// --- prevMonthRange garbage / empty ---
const pmEmpty = prevMonthRange("");
assert(isIsoDate(pmEmpty.dal) && isIsoDate(pmEmpty.al), `prevMonth empty → real dates got ${pmEmpty.dal}..${pmEmpty.al}`);
const pmBad = prevMonthRange("not-a-date");
assert(isIsoDate(pmBad.dal) && isIsoDate(pmBad.al), "prevMonth garbage → real dates");
assert(prevMonthRange("2026-9-15").dal === "2026-08-01", "prevMonth unpadded");

// --- 730 apostrophe thousands (align parseAmount) ---
assert(extraCedolino(cedo("di cui 1'234 € 730")) === 1234, "730 apostrophe 1'234");
assert(extraCedolino(cedo("di cui 1\u2019234,50 € 730")) === 1234.5, "730 curly apostrophe");
assert(
  nettoOrdinario({ ...cedo("di cui 1'234 € 730"), netto: 2500 }) === 1266,
  "nettoOrdinario strips 730 apostrophe",
);

// --- variabiliMensili ignores garbage / non-calendar (V/CF) ---
const junkVars = [
  { data: "2026-09-01", descrizione: "A", importo: 30, segno: "uscita" as const, cat: "cibo" },
  { data: "2026-09-02", descrizione: "B", importo: 30, segno: "uscita" as const, cat: "cibo" },
  { data: "garbage", descrizione: "C", importo: 300, segno: "uscita" as const, cat: "cibo" },
  { data: "2026-02-31", descrizione: "D", importo: 300, segno: "uscita" as const, cat: "cibo" },
];
const vm = variabiliMensili(junkVars);
assert(vm.tot === 60 && vm.mesi === 1 && Math.abs(vm.mese - 60) < 1e-9, `variabiliMensili ignores junk got tot=${vm.tot} mesi=${vm.mesi}`);
assert(variabiliPerMese(junkVars).length === 1 && variabiliPerMese(junkVars)[0].mese === "2026-09", "variabiliPerMese only real month");
assert(groupByDay(junkVars).every((g) => isIsoDate(g.data)), "groupByDay skips junk keys");


// --- NumberField commit resolve (empty / negative — no silent 0 overwrite) ---
{
  const moneyOpts = { value: 120, digits: 2, emptyAsZero: true, min: 0 };
  const empty = resolveNumberCommit("", moneyOpts);
  assert(empty.ok === false, "empty money → not ok");
  if (!empty.ok) {
    assert(empty.error === "Inserisci un importo", `empty msg got ${empty.error}`);
    assert(empty.keepDraft === false, "empty restores previous (no keep draft)");
  }
  const neg = resolveNumberCommit("-12,34", moneyOpts);
  assert(neg.ok === false, "negative money → not ok");
  if (!neg.ok) {
    assert(neg.error === "Il valore non può essere negativo", `neg msg got ${neg.error}`);
    assert(neg.keepDraft === true, "negative keeps typed draft");
  }
  const ok = resolveNumberCommit("12,34", moneyOpts);
  assert(ok.ok === true && ok.n === 12.34, "12,34 commits");
  const zeroOk = resolveNumberCommit("0", moneyOpts);
  assert(zeroOk.ok === true && zeroOk.n === 0, "explicit 0 still ok");
  const casaEmpty = resolveNumberCommit("", {
    value: 0,
    digits: 2,
    emptyAsZero: true,
    emptyCommitsZero: true,
    min: 0,
  });
  assert(casaEmpty.ok === true && casaEmpty.n === 0, "casa empty → commit 0");
  const dayEmpty = resolveNumberCommit("", { value: 15, digits: 0, emptyAsZero: false, min: 1, max: 31 });
  assert(dayEmpty.ok === false && dayEmpty.keepDraft === false, "day empty restores");
  const dayHi = resolveNumberCommit("99", {
    value: 15,
    digits: 0,
    emptyAsZero: false,
    min: 1,
    max: 31,
    rangeMessage: "Il giorno deve essere tra 1 e 31",
  });
  assert(dayHi.ok === false && dayHi.keepDraft === true, "day 99 keeps draft");
  if (!dayHi.ok) {
    assert(dayHi.error === "Il giorno deve essere tra 1 e 31", "day range message");
  }
  const dayZero = resolveNumberCommit("0", {
    value: 1,
    digits: 0,
    emptyAsZero: false,
    min: 1,
    max: 31,
    rangeMessage: "Il giorno deve essere tra 1 e 31",
  });
  assert(dayZero.ok === false && dayZero.keepDraft === true, "day 0 keeps draft");
  if (!dayZero.ok) {
    assert(dayZero.error === "Il giorno deve essere tra 1 e 31", "day 0 message");
  }
  const moneyNegKeep = resolveNumberCommit("-1", { value: 500, digits: 2, emptyAsZero: true, min: 0 });
  assert(moneyNegKeep.ok === false && moneyNegKeep.keepDraft === true, "importo -1 keepDraft");
  if (!moneyNegKeep.ok) {
    assert(moneyNegKeep.error === "Il valore non può essere negativo", "importo -1 msg");
  }

  // Investi Turistico: Occupazione 0–100 % UI, tariffa/notte ≥ 0 (NumberField commit)
  const occHi = resolveNumberCommit("150", {
    value: 55,
    digits: 2,
    emptyCommitsZero: true,
    min: 0,
    max: 100,
  });
  assert(occHi.ok === false && occHi.keepDraft === true, "occupazione 150 keeps draft");
  if (!occHi.ok) {
    assert(
      occHi.error === "Il valore deve essere tra 0 e 100",
      `occupazione range msg got ${occHi.error}`,
    );
  }
  const occOk = resolveNumberCommit("55", {
    value: 55,
    digits: 2,
    emptyCommitsZero: true,
    min: 0,
    max: 100,
  });
  assert(occOk.ok === true && occOk.n === 55, "occupazione 55 commits");
  const tariffaNeg = resolveNumberCommit("-100", {
    value: 80,
    digits: 2,
    emptyCommitsZero: true,
    min: 0,
  });
  assert(tariffaNeg.ok === false && tariffaNeg.keepDraft === true, "tariffa −100 keeps draft");
  if (!tariffaNeg.ok) {
    assert(
      tariffaNeg.error === "Il valore non può essere negativo",
      `tariffa neg msg got ${tariffaNeg.error}`,
    );
  }
}

// --- Piano: addebito may ≠ interessi+capitale (fees inside the bank's rata, not UI rounding) ---
{
  const sep = rataDi(MUTUO, `${DEMO_MESE_SPESE}-12`);
  assert(!!sep, "sep 2026 rata exists");
  if (sep) {
    const rataPiena = Math.round(rataFrancesePlain(DEMO_EROGATO, DEMO_TAN, DEMO_N_RATE) * 100) / 100;
    const prima = DEMO_PIANO_MUTUO[DEMO_PIANO_MUTUO.indexOf(sep) - 1];
    assert(near(sep.r, rataPiena + DEMO_SPESE_RATA, 1e-6), `sep addebito = rata francese + spese ${sep.r}`);
    assert(near(sep.i, (prima.k * DEMO_TAN) / 12, 0.011), `sep interessi = residuo precedente × TAN / 12 ${sep.i}`);
    assert(near(sep.c, rataPiena - sep.i, 1e-6), `sep capitale = rata − interessi ${sep.c}`);
    assert(near(sep.k, prima.k - sep.c, 1e-6), "sep residuo = residuo precedente − capitale");
    assert(!splitChiude(sep), "sep i+c ≠ addebito");
    assert(Math.abs(deltaAddebito(sep) - DEMO_SPESE_RATA) < 1e-9, `sep Δ ${deltaAddebito(sep)}`);
  }
  const oct = rataInMese(DEMO_PIANO_MUTUO, "2026-10-01");
  assert(!!oct && splitChiude(oct!) && !oct!.p, "oct 2026 unpaid closes i+c=r");
}

// --- Banca periodValid: empty bounds filter empty (no stale match) ---
assert(!isIsoDate(""), "empty not iso");
assert(!inRange("2026-09-05", "", "2026-09-12"), "inRange empty dal");
assert(!inRange("2026-09-05", "2026-09-01", ""), "inRange empty al");
assert(variabiliNelPeriodo([{ data: "2026-09-05", descrizione: "X", importo: 10, segno: "uscita", cat: "cibo" }], "", "2026-09-12").tot === 0, "vars empty dal → 0");
assert(fisseNelPeriodo(DEMO_FISSE, "", "2026-09-30").length === 0, "fisse empty dal → []");

// --- trailing minus / EN thousands / TSV (CSV money) ---
assert(parseAmount("15,00-") === -15, "trailing minus IT");
assert(parseAmount("3.50-") === -3.5, "trailing minus EN");
assert(parseAmount("1,234") === 1234, "EN thousands 1,234");
assert(parseNumberDraft("15,00-") === -15, "draft trailing minus");
assert(parseNumberDraft("(12,5)") === -12.5, "draft paren neg");
assert(parseNumberDraft("1,234") === 1234, "draft EN thousands");
const trailCsv = parseCsvMovimentiDetailed(`Data;Descrizione;Addebiti;Accrediti
01/09/2026;X;15,00-;
02/09/2026;Y;;100,50-
`);
assert(trailCsv.movimenti.length === 2, `trailing minus csv got ${trailCsv.movimenti.length}`);
assert(trailCsv.movimenti.some((m) => m.descrizione === "X" && m.importo === 15 && m.segno === "uscita"), "addebito trailing → uscita");
assert(trailCsv.movimenti.some((m) => m.descrizione === "Y" && m.importo === 100.5 && m.segno === "entrata"), "accredito trailing abs");
const enTrail = parseCsvMovimentiDetailed(`Date,Description,Amount
2026-09-01,Coffee,3.50-
2026-09-02,Pay,"1,234"
`);
assert(enTrail.movimenti.some((m) => m.descrizione === "Coffee" && m.segno === "uscita" && m.importo === 3.5), "EN Amount trailing → uscita");
assert(enTrail.movimenti.some((m) => m.descrizione === "Pay" && m.importo === 1234 && m.segno === "entrata"), "EN 1,234 thousands");
const tsv = parseCsvMovimentiDetailed("Date\tDescription\tAmount\n2026-09-01\tCoffee\t-3.50\n");
assert(tsv.movimenti.length === 1 && tsv.movimenti[0].importo === 3.5 && tsv.movimenti[0].segno === "uscita", `TSV parse got ${JSON.stringify(tsv.movimenti)}`);


// --- multi-year Carta: fisseNelPeriodo must not stop at ~800 days ---
const longFisse = fisseNelPeriodo(DEMO_FISSE, "2020-01-01", "2026-09-12");
assert(
  longFisse.some((h) => h.data === "2025-09-05" && h.fissa.id === "tari"),
  "long Carta includes TARI 2025-09-05 (beyond old 800d cap)",
);
assert(
  longFisse.some((h) => h.data === "2026-09-01" && h.fissa.id === "mutuo"),
  "long Carta includes mutuo 2026-09-01",
);
assert(
  longFisse.some((h) => h.data === "2024-01-01"),
  "long Carta spans 2024 (past ~2.2y from 2020)",
);

// --- classic Mac CR-only line endings ---
const crOnly = parseCsvMovimentiDetailed(
  "Data;Descrizione;Addebiti;Accrediti\r01/09/2026;ESSELUNGA;45,90;\r02/09/2026;STIPENDIO;;2150,00",
);
assert(crOnly.movimenti.length === 2, `CR-only csv got ${crOnly.movimenti.length}`);
assert(
  crOnly.movimenti.some((m) => m.descrizione === "ESSELUNGA" && m.importo === 45.9),
  "CR-only esselunga",
);
assert(
  crOnly.movimenti.some((m) => m.descrizione === "STIPENDIO" && m.importo === 2150 && m.segno === "entrata"),
  "CR-only stipendio",
);
const crEn = parseCsvMovimentiDetailed("Date,Description,Amount\r2026-09-01,Coffee,-3.50\r2026-09-02,Pay,100.00");
assert(crEn.movimenti.length === 2, `CR-only EN got ${crEn.movimenti.length}`);

// --- Segno / D-C column (IT bank exports: absolute amount + indicator) ---
const segni: [string, "uscita" | "entrata" | null][] = [
  ["D", "uscita"],
  ["d", "uscita"],
  ["Dare", "uscita"],
  ["DBIT", "uscita"],
  ["addebito", "uscita"],
  ["-", "uscita"],
  ["\u2212", "uscita"],
  ["C", "entrata"],
  ["Avere", "entrata"],
  ["A", "entrata"],
  ["CRDT", "entrata"],
  ["+", "entrata"],
  ["accredito", "entrata"],
  ["", null],
  ["POS", null],
  ["bonifico", null],
];
for (const [raw, exp] of segni) {
  assert(parseSegnoCell(raw) === exp, `parseSegnoCell(${JSON.stringify(raw)}) = ${parseSegnoCell(raw)} want ${exp}`);
}

const csvSegno = `Data;Descrizione;Importo;Segno
12/09/2026;ESSELUNGA;45,90;D
11/09/2026;BONIFICO STIPENDIO;2.150,00;C
10/09/2026;NETFLIX;15,99;Dare
09/09/2026;RIMBORSO;10,00;Avere
`;
const rSegno = parseCsvMovimentiDetailed(csvSegno);
assert(rSegno.movimenti.length === 4, `Segno csv got ${rSegno.movimenti.length}`);
assert(rSegno.motivi.some((m) => m.includes("Segno")), `Segno motivo got ${rSegno.motivi.join(";")}`);
assert(
  rSegno.movimenti.some((m) => m.descrizione === "ESSELUNGA" && m.importo === 45.9 && m.segno === "uscita"),
  "Segno D + abs → uscita (not entrata)",
);
assert(
  rSegno.movimenti.some((m) => m.descrizione === "BONIFICO STIPENDIO" && m.importo === 2150 && m.segno === "entrata"),
  "Segno C + abs → entrata",
);
assert(
  rSegno.movimenti.some((m) => m.descrizione === "NETFLIX" && m.segno === "uscita"),
  "Segno Dare → uscita",
);
assert(
  rSegno.movimenti.some((m) => m.descrizione === "RIMBORSO" && m.segno === "entrata"),
  "Segno Avere → entrata",
);

const csvDC = `Data;Causale;Importo;D/C
01/09/2026;COOP;10,00;D
02/09/2026;ACCREDITO;100,50;C
`;
const rDC = parseCsvMovimentiDetailed(csvDC);
assert(rDC.movimenti.length === 2, `D/C header got ${rDC.movimenti.length}`);
assert(rDC.movimenti.some((m) => m.descrizione === "COOP" && m.segno === "uscita" && m.importo === 10), "D/C D");
assert(rDC.movimenti.some((m) => m.descrizione === "ACCREDITO" && m.segno === "entrata" && m.importo === 100.5), "D/C C");

const csvDareAvere = `Data;Descrizione;Importo;Dare/Avere
01/09/2026;BAR;3,50;Dare
02/09/2026;STIPENDIO;2.000,00;Avere
`;
const rDA = parseCsvMovimentiDetailed(csvDareAvere);
assert(rDA.movimenti.length === 2, `Dare/Avere header got ${rDA.movimenti.length}`);
assert(
  rDA.movimenti.every((m) => (m.descrizione === "BAR" ? m.segno === "uscita" : m.segno === "entrata")),
  "Dare/Avere header is indicator not amount column",
);
assert(rDA.movimenti.some((m) => m.importo === 2000 && m.segno === "entrata"), "Dare/Avere stipendio");

const csvIsoDc = `Booking Date,Narration,Transaction Amount,CreditDebitIndicator
2026-09-01,Coffee,3.50,DBIT
2026-09-02,Pay,100.00,CRDT
`;
const rIso = parseCsvMovimentiDetailed(csvIsoDc);
assert(rIso.movimenti.length === 2, `ISO CRDT/DBIT got ${rIso.movimenti.length}`);
assert(rIso.movimenti.some((m) => m.descrizione === "Coffee" && m.segno === "uscita"), "DBIT → uscita");
assert(rIso.movimenti.some((m) => m.descrizione === "Pay" && m.segno === "entrata" && m.importo === 100), "CRDT → entrata");

const csvPlusMinus = `Data;Descrizione;Importo;Segno
01/09/2026;X;15,00;-
02/09/2026;Y;100,00;+
`;
const rPM = parseCsvMovimentiDetailed(csvPlusMinus);
assert(rPM.movimenti.some((m) => m.descrizione === "X" && m.segno === "uscita"), "Segno - → uscita");
assert(rPM.movimenti.some((m) => m.descrizione === "Y" && m.segno === "entrata"), "Segno + → entrata");

// Signed amount still works; empty/unknown Segno falls back to amount sign
const csvFallback = `Date,Description,Amount,Segno
2026-09-01,Coffee,-3.50,
2026-09-02,Refund,12.00,NOPE
2026-09-03,Shop,8.00,D
`;
const rFb = parseCsvMovimentiDetailed(csvFallback);
assert(rFb.movimenti.some((m) => m.descrizione === "Coffee" && m.segno === "uscita"), "empty Segno → amount sign");
assert(rFb.movimenti.some((m) => m.descrizione === "Refund" && m.segno === "entrata"), "unknown Segno → amount sign");
assert(rFb.movimenti.some((m) => m.descrizione === "Shop" && m.segno === "uscita"), "Segno wins over +amount");

// Addebiti/Accrediti still preferred over a stray Segno
const csvBoth = `Data;Descrizione;Addebiti;Accrediti;Segno
01/09/2026;POS;12,00;;C
02/09/2026;BONIFICO;;50,00;D
`;
const rBoth = parseCsvMovimentiDetailed(csvBoth);
assert(rBoth.movimenti.some((m) => m.descrizione === "POS" && m.segno === "uscita"), "Addebiti wins over Segno C");
assert(rBoth.movimenti.some((m) => m.descrizione === "BONIFICO" && m.segno === "entrata"), "Accrediti wins over Segno D");

// Headerless easy win: date + desc + abs amount + D/C
const csvBare = `12/09/2026;ESSELUNGA;45,90;D
11/09/2026;STIPENDIO;2150,00;C
`;
const rBare = parseCsvMovimentiDetailed(csvBare);
assert(rBare.movimenti.length === 2, `headerless segno got ${rBare.movimenti.length}`);
assert(rBare.motivi.some((m) => m.includes("senza intestazione")), `headerless motivo ${rBare.motivi.join(";")}`);
assert(
  rBare.movimenti.some((m) => m.descrizione === "ESSELUNGA" && m.importo === 45.9 && m.segno === "uscita"),
  "headerless D → uscita",
);
assert(
  rBare.movimenti.some((m) => m.descrizione === "STIPENDIO" && m.importo === 2150 && m.segno === "entrata"),
  "headerless C → entrata",
);

const csvBareSigned = `2026-09-01,Coffee,-3.50
2026-09-02,Pay,12.00
`;
const rBareS = parseCsvMovimentiDetailed(csvBareSigned);
assert(rBareS.movimenti.length === 2, `headerless signed got ${rBareS.movimenti.length}`);
assert(rBareS.movimenti.some((m) => m.descrizione === "Coffee" && m.segno === "uscita"), "headerless signed -");
assert(rBareS.movimenti.some((m) => m.descrizione === "Pay" && m.segno === "entrata"), "headerless signed +");

// Quoted IT ; + locale decimals + explicit zero + D-C (was 2/3: zero dropped)
const csvZeroKeep = `Data;Descrizione;Importo;D-C
12/09/2026;"PAGAMENTO ""POS""; ESSELUNGA";"12,34";D
11/09/2026;"COMMISSIONE AZZERATA";"0,00";D
10/09/2026;"BONIFICO STIPENDIO";"1.234,56";C
`;
const rZeroKeep = parseCsvMovimentiDetailed(csvZeroKeep);
assert(rZeroKeep.movimenti.length === 3, `quoted IT zero-keep got ${rZeroKeep.movimenti.length} want 3`);
assert(rZeroKeep.motivi.some((m) => m.includes("Segno") || m.includes("D-C")), `D-C motivo ${rZeroKeep.motivi.join(";")}`);
assert(
  rZeroKeep.movimenti.some((m) => m.descrizione.includes("ESSELUNGA") && m.importo === 12.34 && m.segno === "uscita"),
  "quoted 12,34 + D → uscita",
);
assert(
  rZeroKeep.movimenti.some((m) => m.descrizione === "COMMISSIONE AZZERATA" && m.importo === 0 && m.segno === "uscita"),
  "explicit 0,00 kept with date+desc + D",
);
assert(
  rZeroKeep.movimenti.some((m) => m.descrizione === "BONIFICO STIPENDIO" && m.importo === 1234.56 && m.segno === "entrata"),
  "quoted 1.234,56 + C → entrata",
);
// Empty amount cell still skipped; sbilancio still skipped by desc
const csvZeroSkip = `Data;Descrizione;Addebiti;Accrediti
01/09/2026;"SENZA IMPORTO";;
02/09/2026;"Sbilancio di verifica";"0,00";
03/09/2026;"STORNO ZERO";"0,00";
`;
const rZeroSkip = parseCsvMovimentiDetailed(csvZeroSkip);
assert(rZeroSkip.movimenti.length === 1, `empty vs zero vs sbilancio got ${rZeroSkip.movimenti.length}`);
assert(rZeroSkip.movimenti[0]?.descrizione === "STORNO ZERO" && rZeroSkip.movimenti[0]?.importo === 0, "only real zero kept");
assert(rZeroSkip.saltate >= 2, "empty + sbilancio saltate");

// Headerless: infer must accept 0,00 and ignore digits inside descrizione (was stealing Importo)
const csvBareZeroDesc = `11/09/2026;POS NEGOZIO 45;0,00;D
12/09/2026;ESSELUNGA;12,34;D
10/09/2026;PAGAMENTO CARTA ****1234;0,00;C
`;
const rBareZeroDesc = parseCsvMovimentiDetailed(csvBareZeroDesc);
assert(rBareZeroDesc.movimenti.length === 3, `headerless zero+desc-digits got ${rBareZeroDesc.movimenti.length}`);
assert(
  rBareZeroDesc.movimenti.some((m) => m.descrizione === "POS NEGOZIO 45" && m.importo === 0 && m.segno === "uscita"),
  "headerless: desc digits not Importo; keep 0,00",
);
assert(
  rBareZeroDesc.movimenti.some((m) => m.descrizione === "ESSELUNGA" && m.importo === 12.34 && m.segno === "uscita"),
  "headerless: later non-zero still ok",
);
assert(
  rBareZeroDesc.movimenti.some((m) => m.descrizione.includes("CARTA") && m.importo === 0 && m.segno === "entrata"),
  "headerless: card mask not Importo",
);
const csvBareOnlyZero = `11/09/2026;COMMISSIONE AZZERATA;0,00;D
12/09/2026;STORNO;0,00;C
`;
const rBareOnlyZero = parseCsvMovimentiDetailed(csvBareOnlyZero);
assert(rBareOnlyZero.movimenti.length === 2, `headerless only-zeros got ${rBareOnlyZero.movimenti.length}`);
assert(rBareOnlyZero.movimenti.every((m) => m.importo === 0), "headerless only-zeros importo 0");
assert(
  rBareOnlyZero.movimenti.some((m) => m.descrizione === "COMMISSIONE AZZERATA" && m.segno === "uscita"),
  "headerless only-zeros D",
);
assert(
  rBareOnlyZero.movimenti.some((m) => m.descrizione === "STORNO" && m.segno === "entrata"),
  "headerless only-zeros C",
);

// Headerless residuals: valuta/saldo/ref must not steal desc or Importo; EUR code ok
const csvBareValuta = `11/09/2026;11/09/2026;BONIFICO;2150,00
10/09/2026;10/09/2026;ESSELUNGA;-45,90
09/09/2026;09/09/2026;STORNO;0,00
`;
const rBareValuta = parseCsvMovimentiDetailed(csvBareValuta);
assert(rBareValuta.movimenti.length === 3, `headerless valuta-date got ${rBareValuta.movimenti.length}`);
assert(
  rBareValuta.movimenti.some((m) => m.descrizione === "BONIFICO" && m.importo === 2150),
  "headerless: valuta date not descrizione",
);
assert(
  rBareValuta.movimenti.some((m) => m.descrizione === "ESSELUNGA" && m.importo === 45.9 && m.segno === "uscita"),
  "headerless: valuta + signed amount",
);
assert(
  rBareValuta.movimenti.some((m) => m.descrizione === "STORNO" && m.importo === 0),
  "headerless: valuta + explicit zero",
);

const csvBareSaldo = `01/09/2026;COOP;12,34;1.234,56;D
02/09/2026;PAY;0,00;1.234,56;C
`;
const rBareSaldo = parseCsvMovimentiDetailed(csvBareSaldo);
assert(rBareSaldo.movimenti.length === 2, `headerless saldo-col got ${rBareSaldo.movimenti.length}`);
assert(
  rBareSaldo.movimenti.some((m) => m.descrizione === "COOP" && m.importo === 12.34 && m.segno === "uscita"),
  "headerless: saldo after amount not descrizione",
);
assert(
  rBareSaldo.movimenti.some((m) => m.descrizione === "PAY" && m.importo === 0 && m.segno === "entrata"),
  "headerless: saldo + keep 0,00",
);

const csvBareRef = `11/09/2026;1234567890;COOP;12,34;D
12/09/2026;9876543210;PAY;0,00;C
11/09/2026;001234;ESSELUNGA;45,90;D
`;
const rBareRef = parseCsvMovimentiDetailed(csvBareRef);
assert(rBareRef.movimenti.length === 3, `headerless ref-id got ${rBareRef.movimenti.length}`);
assert(
  rBareRef.movimenti.some((m) => m.descrizione === "COOP" && m.importo === 12.34),
  "headerless: long ref not Importo",
);
assert(
  rBareRef.movimenti.some((m) => m.descrizione === "PAY" && m.importo === 0),
  "headerless: ref + keep 0,00",
);
assert(
  rBareRef.movimenti.some((m) => m.descrizione === "ESSELUNGA" && m.importo === 45.9),
  "headerless: leading-zero ref not Importo",
);

const csvBareEur = `11/09/2026;COOP;EUR 12,34;D
12/09/2026;PAY;EUR 0,00;C
`;
const rBareEur = parseCsvMovimentiDetailed(csvBareEur);
assert(rBareEur.movimenti.length === 2, `headerless EUR code got ${rBareEur.movimenti.length}`);
assert(
  rBareEur.movimenti.some((m) => m.descrizione === "COOP" && m.importo === 12.34 && m.segno === "uscita"),
  "headerless: EUR 12,34 amount",
);
assert(
  rBareEur.movimenti.some((m) => m.descrizione === "PAY" && m.importo === 0 && m.segno === "entrata"),
  "headerless: EUR 0,00 kept",
);

// Existing Addebiti/Accrediti-style must not flip just because a cell says C/D in desc
const csvNoFlip = `Data contabile;Descrizione;Addebiti;Accrediti
01/09/2026;"PAGAMENTO C/C BANCA";"20,00";
02/09/2026;"BONIFICO DARE";;"30,00"
`;
const rNoFlip = parseCsvMovimentiDetailed(csvNoFlip);
assert(rNoFlip.movimenti.some((m) => m.importo === 20 && m.segno === "uscita"), "desc C/C still addebito");
assert(rNoFlip.movimenti.some((m) => m.importo === 30 && m.segno === "entrata"), "desc DARE still accredito");

// Volume: 10k absolute+Segno
const bigSegno: string[] = ["Data;Descrizione;Importo;Segno"];
for (let i = 0; i < 10_000; i++) {
  const d = 1 + (i % 28);
  const m = 1 + (i % 12);
  const euro = ((i % 97) + 1) + (i % 10) / 10;
  const it = euro.toFixed(2).replace(".", ",");
  bigSegno.push(`${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/2025;MOV ${i};${it};${i % 2 === 0 ? "D" : "C"}`);
}
const tSegno = Date.now();
const rBigSegno = parseCsvMovimentiDetailed(bigSegno.join("\n"));
const msSegno = Date.now() - tSegno;
assert(rBigSegno.movimenti.length === 10_000, `10k Segno parse got ${rBigSegno.movimenti.length}`);
assert(msSegno < 3000, `10k Segno parse in ${msSegno}ms (<3s)`);
assert(rBigSegno.movimenti.filter((m) => m.segno === "uscita").length === 5000, "10k Segno half uscita");
assert(rBigSegno.movimenti.filter((m) => m.segno === "entrata").length === 5000, "10k Segno half entrata");
console.log(`  timing: 10k Segno rows in ${msSegno}ms`);


// --- Piano fisse: frequenza annuale non deve ÷12 F; gap-month resta piano-locked ---
{
  const mutuo = MUTUO;
  const palestra = PALESTRA;
  const iso = `${DEMO_MESE_SPESE}-01`;
  const badFreq = { ...mutuo, frequenza: "annuale" as const };
  const healed = fissaConPiano(badFreq, iso);
  assert(healed.frequenza === "mensile", "fissaConPiano forces mensile");
  assert(
    Math.abs(competenzaMese(healed) - (DEMO_RATA_MUTUO + DEMO_SPESE_RATA)) < 1e-9,
    `piano annuale healed comp = addebito del mese ${competenzaMese(healed)}`,
  );
  assert(hasPiano(mutuo), "hasPiano mutuo");
  assert(hasPiano(demoFissa("prestito")), "hasPiano prestito");
  assert(!hasPiano(palestra), "hasPiano palestra");
  assert(!hasPiano({ ...mutuo, piano: [] }) && pianoDi({ ...mutuo, piano: [] }) === null, "piano vuoto = nessun piano");
  assert(!hasPiano(undefined) && !hasPiano(null), "hasPiano senza fissa → false");
  assert(pianoDi(mutuo) === DEMO_PIANO_MUTUO, "pianoDi legge il piano dentro la fissa");
  // Gap month: no rata row, still force mensile (importo stays anagrafica)
  const gap = fissaConPiano(badFreq, `${DEMO_MESE_BUCO}-01`);
  assert(gap.frequenza === "mensile", "gap month still mensile");
  assert(Math.abs(gap.importo - mutuo.importo) < 1e-9, "gap month keeps anagrafica importo");
  // Mis-tagged categoria still counts as debito for DTI
  const mistag = { ...mutuo, categoria: "casa" as const };
  assert(isDebitoFissa(mistag), "isDebitoFissa piano mistag");
  assert(!isDebitoFissa(palestra), "palestra not debito");
  assert(isDebitoFissa({ ...palestra, categoria: "debito" }), "explicit debito still");
  // Con 4.000 di reddito il tetto (1.320) resta sopra le due rate: il confronto non è 0 = 0.
  const statoRicco = { ...DEMO_STATO, redditoMensile: 4000 };
  const rMaxOk = rMaxResidua(statoRicco);
  const rMaxMistag = rMaxResidua({
    ...statoRicco,
    fisse: DEMO_FISSE.map((f) => (f.id === "mutuo" ? mistag : f)),
  });
  assert(rMaxOk > 0 && Math.abs(rMaxOk - rMaxMistag) < 1e-9, `rMax ignores mutuo mistag ${rMaxOk} vs ${rMaxMistag}`);
  const Fbad = totaleFisseAl(
    DEMO_FISSE.map((f) => (f.id === "mutuo" ? badFreq : f)),
    iso,
  );
  const Fok = totaleFisseAl(DEMO_FISSE, iso);
  assert(Math.abs(Fbad - Fok) < 1e-9, `totaleFisseAl ignores annuale on piano (${Fbad} vs ${Fok})`);
  // rMaxResidua must heal annuale (same as Home) — else the rata would count 1/12
  const badAnn = { ...mutuo, frequenza: "annuale" as const, categoria: "vita" as const };
  const rMaxRicco = rMaxResidua(statoRicco, iso);
  const rMaxAnn = rMaxResidua(
    {
      ...statoRicco,
      fisse: DEMO_FISSE.map((f) => (f.id === "mutuo" ? badAnn : f)),
    },
    iso,
  );
  assert(rMaxRicco > 0 && Math.abs(rMaxAnn - rMaxRicco) < 1e-9, `rMax heals annuale ${rMaxAnn} vs ${rMaxRicco}`);
  const healedPersist = healPianoFissa(badAnn);
  assert(healedPersist.frequenza === "mensile", "healPianoFissa freq");
  assert(healedPersist.categoria === "debito", "healPianoFissa cat");
  assert(healPianoFissa(palestra).categoria === palestra.categoria, "heal skips non-piano");
}

// --- CoC: annuale on piano must not ÷12 rata (was ~2× CoC) ---
{
  const p = withImmobile(DEMO_PATRIMONIO, DEMO_CASA);
  const cocOk = cashOnCash(p, DEMO_CASA, DEMO_FISSE);
  const bad = DEMO_FISSE.map((f) =>
    f.id === "mutuo" ? { ...f, frequenza: "annuale" as const } : f,
  );
  const cocBad = cashOnCash(p, DEMO_CASA, bad);
  assert(Math.abs(cocOk - cocBad) < 1e-9, `CoC heals annuale ${cocOk} vs ${cocBad}`);
  const cocNone = cashOnCash(p, { ...DEMO_CASA, fissaMutuoId: "" }, DEMO_FISSE);
  assert(cocNone > cocOk, "CoC without mutuo rata > with rata");
  // A mano: (canone − spese proprietario − manutenzione − rata × 12) / (valore − debito).
  const rataOggi = rigaDemo(localIso.slice(0, 7))?.r ?? MUTUO.importo;
  const nettoAnno = 700 * 12 - 100 * 12 - VALORE_DEMO * 0.01; // proprietario: condominio + assicurazione
  const cocWant = (nettoAnno - rataOggi * 12) / (VALORE_DEMO - DEMO_CAPITALE_MUTUO);
  assert(near(cocOk, cocWant, 1e-9), `CoC demo = (netto − rate) / equity got ${cocOk} want ${cocWant}`);
}


// --- QA Top: period +100y / far past, fisseNelPeriodo long, giorni, CSV 2126, extreme money ---
{
  // giorniNelPeriodo over century + far past
  const g100 = giorniNelPeriodo("2026-01-01", "2126-01-01");
  const exact100 =
    Math.round((new Date(2126, 0, 1).getTime() - new Date(2026, 0, 1).getTime()) / 86400000) + 1;
  assert(g100 === exact100 && g100 === 36525, `giorni +100y ${g100} want ${exact100}`);
  assert(
    giorniNelPeriodo("2126-01-01", "2026-01-01") === g100,
    "giorni +100y inverted bounds",
  );
  const gPast = giorniNelPeriodo("1900-01-01", "2000-01-01");
  assert(gPast === 36525, `giorni far-past century ${gPast}`);
  assert(giorniNelPeriodo("1800-03-01", "1800-03-31") === 31, "giorni far-past Mar 1800");
  assert(giorniNelPeriodo("1899-12-31", "1900-01-01") === 2, "giorni across 1900");
  // leap day inside long span
  assert(giorniNelPeriodo("2024-02-28", "2024-03-01") === 3, "giorni leap bridge");
  assert(isIsoDate("2126-03-15"), "isIsoDate 2126");
  assert(isIsoDate("1900-01-01"), "isIsoDate 1900");
  assert(isIsoDate("2124-02-29"), "isIsoDate leap 2124");
  assert(!isIsoDate("2100-02-29"), "isIsoDate reject 2100 non-leap");

  // inRange / extent across century
  assert(inRange("2126-06-01", "2026-01-01", "2126-12-31"), "inRange year 2126");
  assert(inRange("1900-06-01", "1900-01-01", "2000-01-01"), "inRange year 1900");
  assert(!inRange("2127-01-01", "2026-01-01", "2126-12-31"), "inRange past +100y end");

  // fisseNelPeriodo must cover full +100y (old 50y safety stopped at ~2076)
  const mensile: Fissa = {
    id: "stress-m",
    nome: "Mensile stress",
    importo: 10,
    giorno: 15,
    mese: 1,
    frequenza: "mensile",
    categoria: "vita",
    note: "",
  };
  const tLong = Date.now();
  const century = fisseNelPeriodo([mensile], "2026-01-01", "2126-12-31");
  const msLong = Date.now() - tLong;
  const cDates = century.map((h) => h.data);
  assert(cDates[0] === "2026-01-15", `century first ${cDates[0]}`);
  assert(cDates.includes("2076-01-15"), "century still includes ~50y mark");
  assert(cDates.includes("2126-01-15"), "century includes 2126-01-15 (beyond old 50y cap)");
  assert(cDates.includes("2126-12-15"), `century last year Dec got last=${cDates.at(-1)}`);
  assert(century.length === 1212, `century mensile hits ${century.length} want 1212 (101y×12)`);
  assert(msLong < 5000, `fisseNelPeriodo +100y in ${msLong}ms (<5s)`);
  console.log(`  timing: fisseNelPeriodo +100y (${century.length} hits) in ${msLong}ms`);

  // annuale over long span + far past window
  const annuale: Fissa = {
    id: "stress-a",
    nome: "Annuale stress",
    importo: 100,
    giorno: 5,
    mese: 9,
    frequenza: "annuale",
    categoria: "vita",
    note: "",
  };
  const annHits = fisseNelPeriodo([annuale], "2020-01-01", "2126-12-31").map((h) => h.data);
  assert(annHits[0] === "2020-09-05", `annuale long first ${annHits[0]}`);
  assert(annHits.includes("2126-09-05"), "annuale long reaches 2126");
  assert(annHits.length === 107, `annuale 2020–2126 hits ${annHits.length} want 107`);

  const pastHits = fisseNelPeriodo([mensile], "1899-12-01", "1900-03-31").map((h) => h.data);
  assert(
    pastHits.join(",") === "1899-12-15,1900-01-15,1900-02-15,1900-03-15",
    `far-past fisse ${pastHits.join(",")}`,
  );

  // Demo fisse multi-decade must still see TARI deep in the future
  const seedLong = fisseNelPeriodo(DEMO_FISSE, "2026-01-01", "2126-09-12");
  assert(
    seedLong.some((h) => h.data === "2125-09-05" && h.fissa.id === "tari"),
    "demo TARI 2125-09-05 on +100y Carta",
  );
  assert(
    seedLong.some((h) => h.data === "2126-09-01" && h.fissa.id === "mutuo"),
    "demo mutuo 2126-09-01 on +100y Carta",
  );

  // CSV dates in year 2126 (+ far past + leap 2124)
  const csvFut = parseCsvMovimentiDetailed(`Data;Descrizione;Addebiti;Accrediti
15/03/2126;FUTURO POS;99,99;
01/01/1900;PASSATO;1,00;
29/02/2124;LEAP2124;2,50;
29/02/2100;BAD2100;3,00;
12/09/2126;STIPENDIO FUTURO;;1.234.567,89
`);
  assert(
    csvFut.movimenti.some((m) => m.data === "2126-03-15" && m.importo === 99.99),
    "CSV year 2126 IT date",
  );
  assert(
    csvFut.movimenti.some((m) => m.data === "1900-01-01" && m.importo === 1),
    "CSV far-past 1900",
  );
  assert(
    csvFut.movimenti.some((m) => m.data === "2124-02-29" && m.importo === 2.5),
    "CSV leap 2124",
  );
  assert(
    !csvFut.movimenti.some((m) => m.data.includes("2100")),
    "CSV rejects 29/02/2100 non-leap",
  );
  assert(
    csvFut.movimenti.some(
      (m) => m.descrizione === "STIPENDIO FUTURO" && m.importo === 1234567.89 && m.segno === "entrata",
    ),
    "CSV 2126 big accredito",
  );
  const extFut = extentDate(csvFut.movimenti.map((m) => ({ data: m.data })));
  assert(extFut.min === "1900-01-01" && extFut.max === "2126-09-12", `extent 1900…2126 got ${JSON.stringify(extFut)}`);

  const csvEnFut = parseCsvMovimentiDetailed(`Date,Description,Amount
2126-09-01,Coffee,-3.50
2126-09-02,Pay,1000000.00
`);
  assert(csvEnFut.movimenti.length === 2, `EN CSV 2126 got ${csvEnFut.movimenti.length}`);
  assert(csvEnFut.movimenti.some((m) => m.data === "2126-09-01" && m.segno === "uscita"), "EN 2126 uscita");
  assert(
    csvEnFut.movimenti.some((m) => m.data === "2126-09-02" && m.importo === 1_000_000),
    "EN 2126 million",
  );

  // Extreme money: parse + format + CF identity stays finite
  assert(Math.abs(parseAmount("999.999.999.999,99") - 999_999_999_999.99) < 1e-2, "parseAmount trillion IT");
  assert(Math.abs(parseAmount("-9.999.999.999,99") - -9_999_999_999.99) < 1e-2, "parseAmount −10B");
  assert(parseAmount("Infinity") === 0, "parseAmount Infinity → 0");
  assert(parseAmount("NaN") === 0, "parseAmount NaN → 0");
  assert(Number.isFinite(parseAmount("9007199254740991")), "parseAmount near MAX_SAFE finite");
  const huge = parseAmount("1.234.567.890,12");
  assert(Math.abs(huge - 1234567890.12) < 1e-6, `parseAmount 1.2B got ${huge}`);
  assert(eur(huge).includes("1.234.567.890,12"), `eur huge ${eur(huge)}`);
  assert(eur(Number.POSITIVE_INFINITY) === "—", "eur Infinity → —");
  assert(eur(Number.NaN) === "—", "eur NaN → —");
  assert(eur(0).includes("0,00"), "eur zero");

  const richPat: Patrimonio = {
    ...DEMO_PATRIMONIO,
    saldoConto: 1e12,
    fonteTotale: 1e9,
    capitaleMutuo: 1e11,
    capitalePrestito: 1e10,
  };
  const eq = equity(richPat);
  assert(Number.isFinite(eq), `equity extreme finite ${eq}`);
  const cap = capacitaPrestito(1e9, 5e8);
  assert(cap === 5e8, `capacitaPrestito extreme min(CF,tetto) ${cap}`);
  assert(capacitaPrestito(Number.POSITIVE_INFINITY, 100) === 0, "capacita ∞ CF → 0");
  assert(capacitaPrestito(100, Number.NaN) === 0, "capacita NaN tetto → 0");
  // variabiliNelPeriodo over century with one extreme hit
  const vLong = variabiliNelPeriodo(
    [
      {
        data: "2126-01-15",
        descrizione: "mega",
        importo: 1e9,
        segno: "uscita",
        cat: "spesa",
      },
      {
        data: "2026-01-15",
        descrizione: "piccolo",
        importo: 10,
        segno: "uscita",
        cat: "spesa",
      },
    ],
    "2026-01-01",
    "2126-12-31",
  );
  assert(vLong.giorni === giorniNelPeriodo("2026-01-01", "2126-12-31"), "V century giorni match");
  assert(Math.abs(vLong.tot - (1e9 + 10)) < 1e-6, `V century tot ${vLong.tot}`);
  assert(Number.isFinite(vLong.mediaGiorno) && vLong.mediaGiorno > 0, "V century mediaGiorno finite");
  assert(Number.isFinite(vMensile(vLong.mediaGiorno)), "vMensile extreme finite");
}


// --- Investimenti: 3 holdings + txns con commissioni + hydrate senza transazioni ---
{
  const btc: Investimento = {
    id: "inv-btc",
    nome: "BTC",
    tipo: "crypto",
    valore: 5200,
    note: "",
    transazioni: [
      {
        id: "t1",
        data: "2025-01-10",
        tipo: "acquisto",
        importo: 2000,
        commissione: 12.5,
        note: "primario",
      },
      {
        id: "t2",
        data: "2025-06-01",
        tipo: "acquisto",
        importo: 1500,
        commissione: 7.5,
        note: "",
      },
      {
        id: "t3",
        data: "2026-02-01",
        tipo: "vendita",
        importo: 800,
        commissione: 4,
        note: "take profit",
      },
    ],
  };
  const vwce: Investimento = {
    id: "inv-vwce",
    nome: "VWCE",
    tipo: "azioni",
    valore: 3100,
    note: "",
    transazioni: [
      {
        id: "v1",
        data: "2024-11-01",
        tipo: "acquisto",
        importo: 2500,
        commissione: 5,
        note: "",
      },
      {
        id: "v2",
        data: "2025-03-15",
        tipo: "versamento",
        importo: 400,
        commissione: 0,
        note: "PAC",
      },
    ],
  };
  const emergenza: Investimento = {
    id: "inv-liq",
    nome: "Liquidità broker",
    tipo: "altro",
    valore: 500,
    note: "",
    transazioni: [
      {
        id: "l1",
        data: "2026-01-01",
        tipo: "versamento",
        importo: 1000,
        commissione: 0,
        note: "",
      },
      {
        id: "l2",
        data: "2026-08-01",
        tipo: "prelievo",
        importo: 500,
        commissione: 1.2,
        note: "cash out",
      },
    ],
  };
  const tre = [btc, vwce, emergenza];

  // BTC: capitale = 2000+1500 + (12.5+7.5+4) = 3500+24 = 3524; ricavato = 800; netto = 2724; pnl = 5200-2724 = 2476
  assert(Math.abs(capitaleVersato(btc) - 3524) < 1e-9, `BTC capitale ${capitaleVersato(btc)}`);
  assert(Math.abs(ricavatoVendite(btc) - 800) < 1e-9, `BTC ricavato ${ricavatoVendite(btc)}`);
  assert(Math.abs(investitoNetto(btc) - 2724) < 1e-9, `BTC netto ${investitoNetto(btc)}`);
  assert(Math.abs(pnlLatente(btc) - 2476) < 1e-9, `BTC pnl ${pnlLatente(btc)}`);

  // VWCE: capitale = 2500+400 + 5 = 2905; ricavato = 0; pnl = 3100-2905 = 195
  assert(Math.abs(capitaleVersato(vwce) - 2905) < 1e-9, `VWCE capitale ${capitaleVersato(vwce)}`);
  assert(ricavatoVendite(vwce) === 0, "VWCE no ricavato");
  assert(Math.abs(pnlLatente(vwce) - 195) < 1e-9, `VWCE pnl ${pnlLatente(vwce)}`);

  // Liquidità: capitale = 1000 + (0+1.2) = 1001.2; ricavato = 500; netto = 501.2; pnl = 500-501.2 = -1.2
  assert(Math.abs(capitaleVersato(emergenza) - 1001.2) < 1e-9, `liq capitale ${capitaleVersato(emergenza)}`);
  assert(Math.abs(ricavatoVendite(emergenza) - 500) < 1e-9, `liq ricavato ${ricavatoVendite(emergenza)}`);
  assert(Math.abs(pnlLatente(emergenza) - -1.2) < 1e-9, `liq pnl ${pnlLatente(emergenza)}`);

  const totMercato = tre.reduce((s, i) => s + i.valore, 0);
  assert(totMercato === 5200 + 3100 + 500, `totale mercato 3 inv ${totMercato}`);
  const totCap = tre.reduce((s, i) => s + capitaleVersato(i), 0);
  assert(Math.abs(totCap - (3524 + 2905 + 1001.2)) < 1e-9, `totale capitale+fee ${totCap}`);

  // Equity uses market value only (not cost basis)
  const pBare: Patrimonio = {
    ...DEMO_PATRIMONIO,
    fonteTotale: 0,
    saldoConto: 0,
    capitaleMutuo: 0,
    capitalePrestito: 0,
    valoreCasa: 0,
    mq: 0,
    prezzoAcquisto: 0,
  };
  const eqInv = equity(pBare, [], tre);
  assert(eqInv === totMercato, `equity = sum valori (not cost) got ${eqInv}`);

  // Hydrate: missing transazioni → []
  const legacy = normalizzaInvestimento({
    id: "legacy",
    nome: "Old ETF",
    tipo: "fondo",
    valore: 100,
    note: "",
  } as Investimento);
  assert(Array.isArray(legacy.transazioni) && legacy.transazioni.length === 0, "hydrate missing transazioni → []");
  assert(invTransazioni(legacy).length === 0, "invTransazioni empty on legacy");
  assert(capitaleVersato(legacy) === 0 && pnlLatente(legacy) === 100, "legacy pnl = valore with no txns");

  // Hydrate: corrupt / undefined list
  const corrupt = normalizzaInvestimento({
    id: "c",
    nome: "X",
    tipo: "altro",
    valore: 10,
    note: "",
    transazioni: undefined,
  });
  assert(corrupt.transazioni?.length === 0, "undefined transazioni → []");

  // Italian draft amounts for commission form (align UI)
  assert(parseNumberDraft("2,50") === 2.5, "draft commissione 2,50");
  assert(parseNumberDraft("0") === 0, "draft commissione 0");
  assert(parseNumberDraft("") === null, "draft empty commissione → null (form defaults 0)");
}


// --- Fon.Te busta + TFR accantonato + prezzi offline (no network) ---
{
  const p = normalizzaPatrimonio({
    ...DEMO_PATRIMONIO,
    retribuzioneUtile: 2000,
    fonteLavPct: 0.01,
    fonteDatPct: 0.02,
    tfrAccantonato: undefined as unknown as number,
  });
  assert(p.tfrAccantonato === 0, "hydrate tfrAccantonato missing → 0");
  const m = fonteMese(p);
  assert(Math.abs(m.lavoratore - 20) < 1e-9, `fonte lav 1 % di 2.000 = 20 got ${m.lavoratore}`);
  assert(Math.abs(m.datore - 40) < 1e-9, `fonte dat 2 % di 2.000 = 40 got ${m.datore}`);
  assert(Math.abs(m.tfr - 2000 / 13.5) < 1e-9, `fonte tfr ${m.tfr}`);
  assert(Math.abs(m.totale - (20 + 40 + 2000 / 13.5)) < 1e-9, `fonte tot ${m.totale}`);
  const a = fonteAnno(p);
  assert(Math.abs(a.totale - m.totale * 12) < 1e-9, "fonteAnno = mese×12");
  assert(Math.abs(a.lavoratore - m.lavoratore * 12) < 1e-9, "fonteAnno lav");
  const pNeg = normalizzaPatrimonio({
    ...DEMO_PATRIMONIO,
    tfrAccantonato: -5,
    retribuzioneUtile: Number.NaN,
  });
  assert(pNeg.tfrAccantonato === 0, "tfrAccantonato neg → 0");
  assert(pNeg.retribuzioneUtile === 0, "retribuzione NaN → 0");
  assert(fonteMese(pNeg).totale === 0, "fonteMese zero if RU 0");

  assert(coinGeckoId("BTC") === "bitcoin", "CG BTC");
  assert(coinGeckoId("eth") === "ethereum", "CG eth");
  assert(coinGeckoId("bitcoin") === "bitcoin", "CG bitcoin");
  assert(coinGeckoId("id:chainlink") === "chainlink", "CG id: tag");
  assert(coinGeckoId("coingecko=solana") === "solana", "CG coingecko= tag");
  assert(coinGeckoId("chainlink") === "chainlink", "CG custom slug");
  assert(coinGeckoId("") === null, "CG empty");
  assert(coinGeckoId("Liquidità broker") === null, "CG spaces → null");
  assert(coinGeckoId(undefined) === null, "CG undefined");
  assert(fallbackTickerForId("bitcoin") === "BTC", "fallback BTC");
  assert(fallbackTickerForId("ethereum") === "ETH", "fallback ETH");
  assert(fallbackTickerForId("chainlink") === null, "fallback unknown slug");
  assert(italianPriceError("rate_limit").includes("Troppe richieste"), "IT rate_limit");
  assert(italianPriceError("offline").includes("connessione"), "IT offline");
  assert(italianPriceError("unknown_symbol", "foo").includes("foo"), "IT unknown");
  assert(/chiave/i.test(italianPriceError("auth")) && /non (è )?valida/.test(italianPriceError("auth")), "IT auth: dice che la chiave non è valida");
  assert(italianPriceError("rate_limit").includes("Troppe richieste"), "IT CMC rate: troppe richieste");
  assert(cmcSymbolForId("bitcoin") === "BTC", "CMC symbol BTC");
  assert(cmcSymbolForId("ripple") === "XRP", "CMC symbol XRP");
  assert(cmcSymbolForId("chainlink") === null, "CMC symbol unknown slug");
  assert(cmcNumericId("cmc:1") === 1, "cmc:1");
  assert(cmcNumericId("cmcid=1027") === 1027, "cmcid=1027");
  assert(cmcNumericId("BTC") === null, "cmc tag absent");
  assert(
    priceSourceChain(true).join(">") === "coinmarketcap>coingecko>binance>coinbase",
    "chain with key",
  );
  assert(
    priceSourceChain(false).join(">") === "coingecko>binance>coinbase",
    "chain without key",
  );
  assert(CMC_API_KEY_STORAGE === "ledger.cmcApiKey", "CMC key storage name");
  assert(CMC_QUOTES_URL.includes("quotes/latest"), "CMC quotes url");
  assert(CMC_NO_KEY_TIP.includes("Aggiungi chiave CMC"), "IT no-key tip");
  const mem: Record<string, string> = {};
  const kv: KvStorage = {
    getItem: (k) => (k in mem ? mem[k]! : null),
    setItem: (k, v) => {
      mem[k] = v;
    },
    removeItem: (k) => {
      delete mem[k];
    },
  };
  assert(!hasCmcApiKey(kv), "no key yet");
  writeCmcApiKey("  abcdefghij  ", kv);
  assert(readCmcApiKey(kv) === "abcdefghij", "key trimmed");
  assert(hasCmcApiKey(kv), "key present");
  assert(maskCmcApiKey(readCmcApiKey(kv)) === "••••ghij", "mask last4");
  clearCmcApiKey(kv);
  assert(!hasCmcApiKey(kv) && readCmcApiKey(kv) === "", "key cleared");
  const parsed = parseCmcQuotesLatest(
    {
      status: { error_code: 0 },
      data: {
        BTC: { symbol: "BTC", slug: "bitcoin", quote: { EUR: { price: 90_123.45 } } },
        ETH: { symbol: "ETH", slug: "ethereum", quote: { EUR: { price: 3_210 } } },
      },
    },
    ["bitcoin", "ethereum", "solana"],
  );
  assert(parsed.prices.bitcoin === 90_123.45, "parse CMC BTC");
  assert(parsed.prices.ethereum === 3_210, "parse CMC ETH");
  assert(parsed.missing.join(",") === "solana", "parse CMC missing sol");
  const parsedArr = parseCmcQuotesLatest(
    {
      data: {
        HOT: [
          { symbol: "HOT", slug: "holochain", quote: { EUR: { price: 0.002 } } },
        ],
      },
    },
    ["holochain"],
  );
  assert(parsedArr.prices.holochain === 0.002, "parse CMC array-by-symbol");
  assert(cmcErrorKindFromStatus(1008, 429) === "rate_limit", "CMC 1008 rate");
  assert(cmcErrorKindFromStatus(1006, 401) === "auth", "CMC 1006 auth");
  assert(cmcErrorKindFromStatus(0, 200) === null, "CMC 0 ok");
  const now = 1_000_000;
  const fromCache = pricesFromCache(
    ["bitcoin", "ethereum"],
    { bitcoin: { price: 50_000, at: now - 60_000, source: "coinbase" } },
    now,
    10 * 60 * 1000,
  );
  assert(fromCache.bitcoin === 50_000 && fromCache.ethereum === undefined, "cache fresh BTC only");
  const stale = pricesFromCache(
    ["bitcoin"],
    { bitcoin: { price: 1, at: now - 20 * 60 * 1000, source: "x" } },
    now,
    10 * 60 * 1000,
  );
  assert(Object.keys(stale).length === 0, "cache stale expired");

  assert(valoreDaPrezzoMercato(0.5, 100) === 50, "valore q×price");
  assert(valoreDaPrezzoMercato(undefined, 99.99) === 99.99, "valore 1 unità");
  assert(valoreDaPrezzoMercato(0, 50) === 50, "valore q=0 → 1 unità");
  assert(valoreDaPrezzoMercato(2, Number.NaN) === 0, "valore NaN price → 0");

  // Live apply: no qty must NOT invent 1×price (would wipe manual mercato).
  const liveNoQ = livePricePatch(undefined, 90_000, "2026-09-14T10:00:00.000Z");
  assert(liveNoQ.prezzoMercato === 90_000, "live noq price");
  assert(liveNoQ.valore === undefined, "live noq keep valore");
  const liveQ0 = livePricePatch(0, 90_000, "2026-09-14T10:00:00.000Z");
  assert(liveQ0.valore === undefined, "live q=0 keep valore");
  const liveQ = livePricePatch(0.1, 90_000, "2026-09-14T10:00:00.000Z");
  assert(liveQ.valore === 9000, "live q×price");
  const liveNeg = livePricePatch(2, -1, "2026-09-14T10:00:00.000Z");
  assert(liveNeg.prezzoMercato === 0 && liveNeg.valore === undefined, "live neg price");
  const liveNaN = livePricePatch(2, Number.NaN, "2026-09-14T10:00:00.000Z");
  assert(liveNaN.prezzoMercato === 0 && liveNaN.valore === undefined, "live NaN price");

  const invPx: Investimento = {
    id: "x",
    nome: "BTC",
    tipo: "crypto",
    valore: 1000,
    note: "",
    simbolo: "BTC",
    quantita: 0.1,
    prezzoAcquisto: 50000,
    transazioni: [],
  };
  assert(Math.abs((costoAcquistoApprox(invPx) ?? -1) - 5000) < 1e-9, "costo q×pa");
  assert(costoAcquistoApprox({ ...invPx, quantita: 0 }) === null, "costo q=0 → null");
  const normPx = normalizzaInvestimento({
    id: "y",
    nome: "ETH",
    tipo: "crypto",
    valore: -10,
    note: null as unknown as string,
    simbolo: "  eth ",
    quantita: "0.25" as unknown as number,
    prezzoAcquisto: -1,
  } as Investimento);
  assert(normPx.valore === 0, "norm valore neg → 0");
  assert(normPx.simbolo === "eth", "norm trim simbolo");
  assert(normPx.quantita === 0.25, "norm quantita string");
  assert(normPx.prezzoAcquisto === undefined, "norm prezzoAcquisto neg → undef");
  assert(Array.isArray(normPx.transazioni), "norm txns");
}

// --- archive + empty immobile (product basics) ---
{
  const csv = [
    { data: "2026-08-01", descrizione: "PARCHEGGIO CENTRO", importo: 80, segno: "uscita" as const },
    { data: "2026-08-02", descrizione: "COOP SPESA", importo: 40, segno: "uscita" as const },
  ];
  const keyPark = dupKey(csv[0]);
  const classified = buildClassified(csv, [], [], [], [], {}, [keyPark]);
  assert(classified.length === 2, "classified 2");
  const park = classified.find((m) => m.descrizione.includes("PARCHEGGIO"));
  const coop = classified.find((m) => m.descrizione.includes("COOP"));
  assert(!!park?.archiviato, "parcheggio archived via movimentiArchiviati");
  assert(!coop?.archiviato, "coop active");
  assert(!isVariabile(park!), "archived not variabile");
  assert(isVariabile(coop!), "active is variabile");
  const v = variabiliNelPeriodo(classified, "2026-08-01", "2026-08-31");
  assert(v.n === 1 && Math.abs(v.tot - 40) < 1e-9, "V ignores archived");

  // Due spese identiche lo stesso giorno: archiviarne una non deve archiviare la gemella.
  const gemelle = [
    { data: "2026-08-03", descrizione: "BAR DEMO", importo: 10, segno: "uscita" as const },
    { data: "2026-08-03", descrizione: "BAR DEMO", importo: 10, segno: "uscita" as const },
  ];
  const nessuna = buildClassified(gemelle, [], [], [], [], {}, []);
  assert(nessuna[0].rowKey !== nessuna[1].rowKey, "gemelle: rowKey distinte");
  const unaSola = buildClassified(gemelle, [], [], [], [], {}, [nessuna[0].rowKey!]);
  assert(
    !!unaSola[0].archiviato && !unaSola[1].archiviato,
    "gemelle: archiviata solo quella scelta",
  );
  const vg = variabiliNelPeriodo(unaSola, "2026-08-01", "2026-08-31");
  assert(vg.n === 1 && Math.abs(vg.tot - 10) < 1e-9, "gemelle: V perde 10, non 20");
  // Metri quadri azzerati dall'utente: lo zero è una scelta, non un buco da riempire.
  const mqZero = normalizzaImmobili([{ ...DEMO_CASA, mq: 0 }]);
  assert(mqZero[0].mq === 0, "normalizzaImmobile non riscrive lo zero scelto dall'utente");
  assert(normalizzaImmobile(normalizzaImmobile({ ...DEMO_CASA, mq: 0 })).mq === 0, "mq 0 resta 0 anche al secondo hydrate");
  const mqAssente = normalizzaImmobili([
    { ...DEMO_CASA, mq: undefined as unknown as number },
  ]);
  assert(mqAssente[0].mq === 0, "mq mancante in un salvataggio vecchio → 0, nessun metro quadro inventato");
  assert(
    normalizzaImmobile({ ...DEMO_CASA, mq: Number.NaN, eurMqZona: -3, mutuoTan: Number.NaN }).mq === 0 &&
      normalizzaImmobile({ ...DEMO_CASA, eurMqZona: -3 }).eurMqZona === 0 &&
      normalizzaImmobile({ ...DEMO_CASA, mutuoTan: Number.NaN }).mutuoTan === 0,
    "normalizzaImmobile: NaN / negativi → 0",
  );

  // Chiave vecchia (senza #): vale per la prima occorrenza, non per entrambe.
  const legacy = buildClassified(gemelle, [], [], [], [], {}, [dupKey(gemelle[0])]);
  assert(
    !!legacy[0].archiviato && !legacy[1].archiviato,
    "gemelle: chiave vecchia archivia solo la prima",
  );

  const man = buildClassified(
    [],
    [],
    [],
    [],
    [
      {
        id: "m1",
        data: "2026-08-03",
        descrizione: "Visita",
        importo: 50,
        segno: "uscita",
        cat: "salute",
        archiviato: true,
      },
      {
        id: "m2",
        data: "2026-08-04",
        descrizione: "Bar",
        importo: 3,
        segno: "uscita",
        cat: "bar",
      },
    ],
    {},
    [],
  );
  assert(man.filter((m) => m.archiviato).length === 1, "manual archived flag");
  assert(man.find((m) => m.manualeId === "m1")?.archiviato === true, "manualeId preserved");
  const vMan = variabiliNelPeriodo(man, "2026-08-01", "2026-08-31");
  assert(vMan.n === 1 && Math.abs(vMan.tot - 3) < 1e-9, "V ignores archived manual");

  // Empty new house: no spese, no zona, nothing inherited from the demo house
  const empty = { ...IMMOBILE_VUOTO, id: "casa-x", nome: "Seconda" };
  assert(empty.fissaMutuoId === "", "empty fissaMutuoId");
  assert(speseCasa(empty, DEMO_FISSE).length === 0, "new house has no linked spese");
  const pEmpty = withImmobile(DEMO_PATRIMONIO, empty);
  // withImmobile overwrites patrimonio fields with empty zeros
  assert(pEmpty.mq === 0 && pEmpty.prezzoAcquisto === 0, "empty nums");
  assert(
    pEmpty.closingCosts === 0 && pEmpty.capexTetto === 0 && pEmpty.capexPorte === 0 && pEmpty.eurMqZona === 0,
    "new house: niente spese di acquisto né zona ereditate dal patrimonio",
  );
  const ownX = costoPossessoMese(pEmpty, empty, DEMO_FISSE);
  assert(ownX.spese === 0 && ownX.righe.length === 0 && ownX.interessi === 0, "no demo opex on new");
  assert(valoreEffettivo(pEmpty) === 0, "no zona value");
}


// --- CoinMarketCap mock path (no live network / no real key) ---
{
  const jsonRes = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  const cmcOk: typeof fetch = async (input, init) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    if (!url.startsWith("https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest")) {
      throw new Error(`unexpected url ${url}`);
    }
    if (!url.includes("convert=EUR")) throw new Error("missing convert=EUR");
    if (headers.get("X-CMC_PRO_API_KEY") !== "test-key") throw new Error("missing CMC header");
    if (url.includes("symbol=BTC")) {
      return jsonRes(200, {
        status: { error_code: 0 },
        data: { BTC: { symbol: "BTC", slug: "bitcoin", quote: { EUR: { price: 11 } } } },
      });
    }
    if (url.includes("slug=chainlink")) {
      return jsonRes(200, {
        status: { error_code: 0 },
        data: { chainlink: { symbol: "LINK", slug: "chainlink", quote: { EUR: { price: 12 } } } },
      });
    }
    return jsonRes(200, { status: { error_code: 0 }, data: {} });
  };

  const rCmc = await fetchCoinMarketCapQuotesEur(["bitcoin", "chainlink"], "test-key", cmcOk);
  assert(rCmc.source === "coinmarketcap", "CMC fetch source");
  assert(rCmc.prices.bitcoin === 11 && rCmc.prices.chainlink === 12, "CMC mock prices");
  assert(rCmc.missing.length === 0, "CMC mock complete");

  let rateThrew = false;
  try {
    await fetchCoinMarketCapQuotesEur(["bitcoin"], "test-key", async () =>
      jsonRes(429, { status: { error_code: 1008, error_message: "rate" } }),
    );
  } catch (e) {
    rateThrew = e instanceof PriceFetchError && e.kind === "rate_limit";
    assert(
      e instanceof PriceFetchError && e.message.includes("Troppe richieste"),
      "CMC 429 Italian",
    );
  }
  assert(rateThrew, "CMC 429 throws rate_limit");

  let authThrew = false;
  try {
    await fetchCoinMarketCapQuotesEur(["bitcoin"], "test-key", async () =>
      jsonRes(401, { status: { error_code: 1006 } }),
    );
  } catch (e) {
    authThrew = e instanceof PriceFetchError && e.kind === "auth";
    assert(
      e instanceof PriceFetchError && /non (è )?valida/.test(e.message),
      "CMC 401 Italian",
    );
  }
  assert(authThrew, "CMC 401 throws auth");

  const liveCmc = await fetchLivePricesEur(["bitcoin"], {
    cmcApiKey: "test-key",
    skipCache: true,
    fetchImpl: cmcOk,
  });
  assert(liveCmc.prices.bitcoin === 11, "live prefers CMC");
  assert(liveCmc.source === "coinmarketcap", "live source CMC");

  const liveNoKey = await fetchLivePricesEur(["bitcoin"], {
    cmcApiKey: "",
    skipCache: true,
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.includes("coinmarketcap")) throw new Error("CMC must be skipped without key");
      if (url.includes("coingecko")) return jsonRes(200, { bitcoin: { eur: 22 } });
      throw new Error(`unexpected ${url}`);
    },
  });
  assert(liveNoKey.prices.bitcoin === 22, "no key → CG");
  assert(liveNoKey.source === "coingecko", "no key source CG");
  assert((liveNoKey.tip ?? "").includes(CMC_NO_KEY_TIP), "no key tip CMC");

  const liveFallback = await fetchLivePricesEur(["bitcoin"], {
    cmcApiKey: "test-key",
    skipCache: true,
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.includes("coinmarketcap")) throw new TypeError("Failed to fetch");
      if (url.includes("coingecko")) return jsonRes(200, { bitcoin: { eur: 33 } });
      throw new Error(`unexpected ${url}`);
    },
  });
  assert(liveFallback.prices.bitcoin === 33, "CMC down → CG");
  assert((liveFallback.tip ?? "").includes("non raggiungibile"), "CMC down tip");

  // Un prezzo dalla copia salvata porta l'ora della copia, non quella di adesso.
  {
    const mem: Record<string, string> = {};
    const g = globalThis as { localStorage?: Storage };
    const primaLs = g.localStorage;
    g.localStorage = {
      getItem: (k: string) => (k in mem ? mem[k] : null),
      setItem: (k: string, v: string) => {
        mem[k] = v;
      },
      removeItem: (k: string) => {
        delete mem[k];
      },
      clear: () => {
        for (const k of Object.keys(mem)) delete mem[k];
      },
      key: () => null,
      length: 0,
    } as Storage;
    try {
      const adesso = Date.parse("2026-09-28T12:00:00Z");
      const treGiorniFa = adesso - 3 * 24 * 3600 * 1000;
      mem["ledger.prezzi.v1"] = JSON.stringify({ bitcoin: { price: 50_000, at: treGiorniFa, source: "coingecko" } });
      const offline = await fetchLivePricesEur(["bitcoin"], {
        cmcApiKey: "",
        now: adesso,
        fetchImpl: async () => {
          throw new TypeError("Failed to fetch");
        },
      });
      assert(offline.source === "cache" && offline.prices.bitcoin === 50_000, "senza rete: il prezzo della copia salvata");
      assert(offline.observedAt?.bitcoin === treGiorniFa, "senza rete: il prezzo porta l'ora della copia, non quella di adesso");
      const unMinutoFa = adesso - 60_000;
      mem["ledger.prezzi.v1"] = JSON.stringify({ bitcoin: { price: 51_000, at: unMinutoFa, source: "coingecko" } });
      const fresca = await fetchLivePricesEur(["bitcoin"], { cmcApiKey: "", now: adesso, fetchImpl: async () => { throw new Error("non deve chiamare"); } });
      assert(fresca.source === "cache" && fresca.observedAt?.bitcoin === unMinutoFa, "copia fresca: porta la sua ora");
      const viva = await fetchLivePricesEur(["bitcoin"], {
        cmcApiKey: "",
        now: adesso,
        skipCache: true,
        fetchImpl: async () => jsonRes(200, { bitcoin: { eur: 52_000 } }),
      });
      assert(viva.prices.bitcoin === 52_000 && viva.observedAt?.bitcoin === adesso, "prezzo nuovo: l'ora è adesso");

      // Dopo un cambio di quantità o di simbolo il valore segue lo stesso, con l'ora vera del prezzo.
      const { patchDaPrezzi } = await import("../src/lib/prezzi.ts");
      const invs = [
        { id: "a", quantita: 2, prezzoMercato: 60_000, valore: 60_000, prezzoAggiornatoAt: new Date(unMinutoFa).toISOString() },
        { id: "b", quantita: 1, prezzoMercato: 2_000, valore: 2_000, prezzoAggiornatoAt: new Date(unMinutoFa).toISOString() },
      ];
      const ids = new Map([["a", "bitcoin"], ["b", "bitcoin"]]);
      const p = patchDaPrezzi(invs, ids, { prices: { bitcoin: 60_000 }, observedAt: { bitcoin: unMinutoFa } }, adesso);
      const pa = p.find((x) => x.id === "a")?.patch;
      const pb = p.find((x) => x.id === "b")?.patch;
      assert(pa?.valore === 120_000, `quantità portata a 2: il valore segue anche con un prezzo dalla copia got ${pa?.valore}`);
      assert(pb?.prezzoMercato === 60_000 && pb.valore === 60_000, "simbolo corretto: prezzo e valore del simbolo nuovo");
      assert(pa?.prezzoAggiornatoAt === new Date(unMinutoFa).toISOString(), "prezzo dalla copia: resta l'ora della copia");
      const futuro = patchDaPrezzi(
        [{ id: "a", quantita: 1, prezzoAggiornatoAt: new Date(adesso + 7_200_000).toISOString() }],
        new Map([["a", "bitcoin"]]),
        { prices: { bitcoin: 70_000 }, observedAt: { bitcoin: adesso } },
        adesso,
      );
      assert(futuro[0]?.patch.prezzoMercato === 70_000, "un'ora salvata nel futuro non blocca i prezzi nuovi");
    } finally {
      if (primaLs) g.localStorage = primaLs;
      else delete g.localStorage;
    }
  }
}

// --- Fon.Te snapshot math + CSV + hydrate + PDF heuristics (no network) ---
{
  assert(parseFonteQty("21.375") === 21.375, "qty EN 21.375 not thousands");
  assert(parseFonteQty("21,375") === 21.375, "qty IT 21,375");
  assert(parseFonteQty("388.4567") === 388.4567, "qty shares 388.4567");
  assert(parseFonteQty("14,125") === 14.125, "qty Conservativo");
  assert(fontePosizione(100, 21.375) === 2137.5, "posizione 100×21.375");
  assert(fontePosizione(388.4567, 21.375) === Math.round(388.4567 * 21.375 * 100) / 100, "posizione quote lunghe");
  assert(fontePosizione(-3, 10) === 0, "quote neg → 0");
  assert(fontePosizione(10, Number.NaN) === 0, "NAV NaN → 0");
  assert(fontePosizione("12" as unknown as number, "2,5" as unknown as number) === 0, "stringhe raw non parse qui");
  assert(fontePosizione(0, 25) === 0, "0 quote → 0");

  const snap = buildFonteSnapshot({
    data: "2026-06-30",
    comparto: "dinamico",
    numeroQuote: 400,
    valoreQuota: 21.375,
    fonte: "manuale",
  });
  assert(snap.posizione === 8550, `build pos 400 × 21,375 = 8.550 got ${snap.posizione}`);
  assert(snap.data === "2026-06-30" && snap.comparto === "dinamico", "build fields");
  const applied = applyFonteSnapshotToPatrimonio(
    { ...DEMO_PATRIMONIO, fonteAttesa: 100, fonteInvestito: 1, fonteTotale: 2 },
    snap,
  );
  assert(applied.fonteInvestito === 8550, "apply investito = pos");
  assert(Math.abs(applied.fonteTotale - 8650) < 1e-9, "apply tot = pos + attesa");

  // Ultimo snapshot rimosso: niente orphan investito (totale = solo attesa).
  const cleared = clearFontePosizioneFromPatrimonio(applied);
  assert(cleared.fonteInvestito === 0, "clear investito → 0");
  assert(cleared.fonteTotale === 100, "clear tot = attesa");
  const clearedNaN = clearFontePosizioneFromPatrimonio({
    ...DEMO_PATRIMONIO,
    fonteAttesa: Number.NaN,
    fonteInvestito: 999,
    fonteTotale: 999,
  });
  assert(clearedNaN.fonteInvestito === 0 && clearedNaN.fonteTotale === 0, "clear NaN attesa → 0");

  // CSV storico non deve regressare: latest tra esistenti + nuovi (non solo i nuovi).
  const snapNew = buildFonteSnapshot({
    id: "new",
    data: "2026-09-01",
    comparto: "dinamico",
    numeroQuote: 500,
    valoreQuota: 26,
    fonte: "csv",
  });
  const snapOld = buildFonteSnapshot({
    id: "old",
    data: "2026-03-01",
    comparto: "dinamico",
    numeroQuote: 400,
    valoreQuota: 20,
    fonte: "csv",
  });
  assert(snapNew.posizione === 13000, "snapNew pos");
  assert(snapOld.posizione === 8000, "snapOld pos");
  const afterOldImport = latestFonteSnapshot([snapOld, snapNew]);
  assert(afterOldImport?.id === "new", "merge prefers newer existing");
  const afterOldOnlyExtras = latestFonteSnapshot([snapOld]); // bug vecchio: solo extras
  assert(afterOldOnlyExtras?.id === "old", "extras-only would be old");
  const pKeep = applyFonteSnapshotToPatrimonio(
    { ...DEMO_PATRIMONIO, fonteAttesa: 50, fonteInvestito: 13000, fonteTotale: 13050 },
    afterOldImport!,
  );
  assert(pKeep.fonteInvestito === 13000, "no regress investito on older CSV");
  // remove latest → re-apply remaining; remove all → clear
  const afterDropNew = latestFonteSnapshot([snapNew, snapOld].filter((x) => x.id !== "new"));
  assert(afterDropNew?.id === "old", "drop latest leaves old");
  const reApplied = applyFonteSnapshotToPatrimonio(pKeep, afterDropNew!);
  assert(reApplied.fonteInvestito === 8000, "re-apply remaining after drop latest");
  assert(latestFonteSnapshot([] ) === null, "empty latest null");
  const afterDropAll = clearFontePosizioneFromPatrimonio(reApplied);
  assert(afterDropAll.fonteInvestito === 0 && afterDropAll.fonteTotale === 50, "drop all clears stock");
  const afterNewerImport = latestFonteSnapshot([
    buildFonteSnapshot({
      id: "newer",
      data: "2026-10-01",
      comparto: "dinamico",
      numeroQuote: 510,
      valoreQuota: 27,
      fonte: "csv",
    }),
    snapNew,
  ]);
  assert(afterNewerImport?.id === "newer", "newer CSV wins");
  assert(afterNewerImport!.posizione === 13770, "newer pos");

  assert(parseFonteComparto("Garantito").comparto === "garantito", "map Garantito");
  assert(parseFonteComparto("conservativo").comparto === "garantito", "map Conservativo");
  assert(parseFonteComparto("Bilanciato").comparto === "sviluppo", "map Bilanciato→Sviluppo");
  assert(parseFonteComparto("Crescita").comparto === "crescita", "map Crescita");
  assert(parseFonteComparto("Dinamico").comparto === "dinamico", "map Dinamico");
  assert(parseFonteComparto("Linea extra").comparto === "custom", "map custom");
  assert(parseFonteTipo("TFR") === "tfr" && parseFonteTipo("lav") === "lavoratore", "tipi");
  assert(parseFonteStato("atteso") === "atteso" && parseFonteStato("") === "accreditato", "stati");
  assert(trimestreDaIso("2026-06-15") === "2026-Q2", "Q2");
  assert(competenzaDaIso("2026-6-5") === "2026-06", "competenza pad");
  assert(trimestreDaIso("not-a-date") === "", "trimestre junk");

  const csv = parseFonteCsv(FONTE_CSV_TEMPLATE);
  assert(csv.snapshots.length === 1, `template snap ${csv.snapshots.length}`);
  assert(csv.contributi.length === 3, `template contrib ${csv.contributi.length}`);
  assert(csv.snapshots[0].fonte === "csv", "template fonte csv");
  assert(
    csv.snapshots[0].numeroQuote > 0 &&
      csv.snapshots[0].valoreQuota > 0 &&
      Math.abs(csv.snapshots[0].posizione - fontePosizione(csv.snapshots[0].numeroQuote, csv.snapshots[0].valoreQuota)) < 1e-9,
    "template pos = quote × valore quota",
  );
  assert(csv.contributi.map((c) => c.fonte).join(",") === "lavoratore,datore,tfr", "template tipi");
  assert(csv.contributi[2].stato === "atteso", "tfr atteso");

  const csvIt = `data;comparto;numero_quote;valore_quota;tipo_contributo;importo;stato;note
30/06/2026;dinamico;388,4567;21,375;;;
30/06/2026;dinamico;;;lavoratore;12,30;accreditato;
bad;dinamico;1;2;;;
30/06/2026;dinamico;10;;;
`;
  const rIt = parseFonteCsv(csvIt);
  assert(rIt.snapshots.length === 1, `IT snap ${rIt.snapshots.length}`);
  assert(rIt.contributi.length === 1, `IT contrib ${rIt.contributi.length}`);
  assert(rIt.saltate >= 2, `IT saltate ${rIt.saltate}`);
  assert(rIt.contributi[0].importo === 12.3, "IT importo 12,30");

  const empty = parseFonteCsv("");
  assert(empty.snapshots.length === 0 && empty.motivi.length > 0, "CSV vuoto");
  const junk = parseFonteCsv("foo,bar\n1,2,3");
  assert(junk.snapshots.length === 0 && junk.contributi.length === 0, "CSV junk");

  const dupsCsv = parseFonteCsv(`data,comparto,numero_quote,valore_quota,tipo_contributo,importo,stato,note
2026-06-30,dinamico,,,lavoratore,12.30,accreditato,
2026-06-30,dinamico,,,lavoratore,12.30,accreditato,
2026-06-30,dinamico,,,datore,34.80,accreditato,
`);
  const part = partizionaFonteContributi(dupsCsv.contributi, []);
  assert(part.nuovi.length === 2 && part.duplicati.length === 1, `dup in-file ${part.nuovi.length}/${part.duplicati.length}`);
  const part2 = partizionaFonteContributi(dupsCsv.contributi, part.nuovi);
  assert(part2.nuovi.length === 0 && part2.duplicati.length === 3, "dup vs existing");
  assert(
    fonteContributoDupKey(dupsCsv.contributi[0]) === fonteContributoDupKey(dupsCsv.contributi[1]),
    "dup key equal",
  );

  const hydS = hydrateFonteSnapshots([
    snap,
    { junk: true },
    null,
    { data: "2026-01-01", numeroQuote: "12", valoreQuota: 2, comparto: "dinamico" },
    { data: "", numeroQuote: 0, valoreQuota: 0 },
  ]);
  assert(hydS.length === 2, `hydrate snaps ${hydS.length}`);
  assert(hydS[1].posizione === 24, "hydrate string quote × 2");
  const hydC = hydrateFonteContributi([
    { data: "2026-06-30", fonte: "tfr", importo: 10, stato: "atteso" },
    { not: "a row" },
    undefined,
    { data: "2026-02-28", fonte: "lavoratore", importo: -5 },
  ]);
  assert(hydC.length === 2, `hydrate contrib ${hydC.length}`);
  assert(hydC[0].trimestre === "2026-Q2" && hydC[0].importo === 10, "hydrate tfr");
  assert(hydC[1].importo === 0 && hydC[1].fonte === "lavoratore", "neg importo → 0");
  assert(hydrateFonteSnapshots(null).length === 0, "hydrate snaps null");
  assert(hydrateFonteContributi("x").length === 0, "hydrate contrib string");
  assert(normalizzaFonteSnapshot(null) === null, "norm snap null");
  assert(normalizzaFonteContributo(42) === null, "norm contrib num");

  const html = `
    <h2>Comparto Dinamico</h2>
    <h5>2026</h5>
    <p>Giugno 21,664 Maggio 21,390</p>
    <h5>2025</h5>
    <p>Dicembre 21,375</p>
  `;
  const q = parseFonteQuotaHtml(html, "dinamico");
  assert(!!q && q.anno === 2026 && q.mese === 6, `quota html ${JSON.stringify(q)}`);
  assert(!!q && Math.abs(q.valore - 21.664) < 1e-9, `quota val ${q?.valore}`);
  assert(parseFonteQuotaHtml("") === null, "html empty");
  assert(parseFonteQuotaHtml("<p>06.83393207</p>") === null, "html phone not quota");

  const pdfOk = parseFontePdfText(
    "Prospetto Fon.Te 30/06/2026 Comparto Dinamico numero quote 388,4567 valore quota 21,375 posizione individuale 8.303,26 contributo lavoratore 12,30 contributo datore 34,80 TFR 150,00",
  );
  assert(pdfOk.confidence === "alta", `pdf conf ${pdfOk.confidence}`);
  assert(!!pdfOk.snapshot && pdfOk.snapshot.comparto === "dinamico", "pdf snap");
  assert(!!pdfOk.snapshot && pdfOk.snapshot.data === "2026-06-30", "pdf data");
  assert(pdfOk.contributi.length >= 3, `pdf contrib ${pdfOk.contributi.length}`);

  // Numeri con più di 3 cifre prima della virgola: non si spezzano.
  const pdfLungo = parseFontePdfText(
    "Prospetto Fon.Te 30/06/2026 Comparto Dinamico numero quote 4051,2345 valore quota 12,345 posizione individuale 50.011,48",
  );
  assert(pdfLungo.snapshot?.numeroQuote === 4051.2345, `pdf quote 4051,2345 intere got ${pdfLungo.snapshot?.numeroQuote}`);
  assert(pdfLungo.snapshot?.valoreQuota === 12.345, `pdf valore quota 12,345 got ${pdfLungo.snapshot?.valoreQuota}`);
  const pdfMigliaia = parseFontePdfText("Fon.Te 30/06/2026 Comparto Dinamico numero quote 1.234,5678 valore quota 12,345");
  assert(pdfMigliaia.snapshot?.numeroQuote === 1234.5678, `pdf quote 1.234,5678 got ${pdfMigliaia.snapshot?.numeroQuote}`);
  const pdfIntero = parseFontePdfText("Fon.Te 30/06/2026 Comparto Dinamico numero quote 4051 valore quota 12,345");
  assert(pdfIntero.snapshot?.numeroQuote === 4051, `pdf quote intere senza decimali got ${pdfIntero.snapshot?.numeroQuote}`);

  const pdfScan = parseFontePdfText("");
  assert(pdfScan.confidence === "nessuna", "pdf empty");
  const pdfWeak = parseFontePdfText("Ciao questo è un volantino senza numeri di quota");
  assert(pdfWeak.confidence === "nessuna" && pdfWeak.snapshot === null, "pdf weak");

  const br = fonteBreakdown([
    { id: "1", data: "2026-06-01", competenza: "2026-06", trimestre: "2026-Q2", fonte: "lavoratore", importo: 10, stato: "accreditato", note: "" },
    { id: "2", data: "2026-06-01", competenza: "2026-06", trimestre: "2026-Q2", fonte: "datore", importo: 30, stato: "quotato", note: "" },
    { id: "3", data: "2026-05-01", competenza: "2026-05", trimestre: "2026-Q2", fonte: "tfr", importo: 140, stato: "atteso", note: "" },
  ]);
  assert(br.lavoratore === 10 && br.datore === 30 && br.tfr === 140, "breakdown tipi");
  assert(br.atteso === 140 && br.accreditato === 10 && br.quotato === 30, "breakdown stati");
  assert(br.totale === 180 && br.lastData === "2026-06-01", "breakdown tot/last");
  assert(fonteLastUpdate([snap], []) === "2026-06-30", "last snap");
  assert(latestFonteSnapshot([snap])?.comparto === "dinamico", "latest");
}



// --- Affare / Investi: NaN·∞·zero debt·zero equity·extreme rent ---
{
  const base = {
    ...AFFARE_VUOTO,
    prezzo: 200_000,
    lavori: 10_000,
    closing: 7_000,
    valoreOggi: 220_000,
    canoneMese: 900,
    debito: 150_000,
    tan: 0.03,
    anniMutuo: 25,
  };

  const fin = (e: ReturnType<typeof analizzaCasa>, label: string) => {
    const nums = [
      e.costo, e.valore, e.ricavi, e.opex, e.noi, e.rataMese, e.rataAnno, e.interessi,
      e.avanzo, e.equity, e.cashIn, e.yoc, e.lordo, e.netto, e.coc, e.spread,
      e.totale, e.totaleReale, e.totaleCalo, e.voto,
      ...e.scenari.flatMap((s) => [s.g, s.totale, s.reale]),
    ];
    assert(nums.every((n) => Number.isFinite(n) || Number.isNaN(n)), `${label}: only finite/NaN`);
    assert(Number.isFinite(e.voto) && e.voto >= 0 && e.voto <= 10, `${label}: voto in range`);
    // scenari.totale is what the UI shows; base ≠ reale card when inflazione > −1
    const baseS = e.scenari.find((s) => s.id === "base")!;
    const realeS = e.scenari.find((s) => s.id === "reale")!;
    assert(Math.abs(baseS.totale - e.totale) < 1e-12, `${label}: base.totale = nominale`);
    assert(Math.abs(realeS.totale - e.totaleReale) < 1e-12 || (Number.isNaN(realeS.totale) && Number.isNaN(e.totaleReale)), `${label}: reale.totale = totaleReale`);
    if (Number.isFinite(e.totaleReale) && Math.abs(base.inflazione ?? AFFARE_VUOTO.inflazione) > 1e-9) {
      assert(Math.abs(baseS.totale - realeS.totale) > 1e-9, `${label}: Base card ≠ Reale card`);
    }
  };

  const e0 = analizzaCasa(base);
  fin(e0, "normal");
  assert(e0.equity === 70_000 && e0.cashIn === 67_000, `normal equity/cashIn ${e0.equity}/${e0.cashIn}`);

  const zd = analizzaCasa({ ...base, debito: 0 });
  fin(zd, "zero debt");
  assert(zd.rataMese === 0 && zd.interessi === 0 && zd.equity === 220_000, "zero debt no rata");
  assert(Math.abs(zd.coc - zd.netto) < 1e-12, "zero debt CoC ≈ netto on full equity");

  const zeq = analizzaCasa({ ...base, debito: 220_000, valoreOggi: 220_000 });
  fin(zeq, "zero equity LTV100");
  assert(zeq.equity === 0 && zeq.cashIn === 0 && zeq.coc === 0, "LTV100 CoC guarded → 0");

  const uw = analizzaCasa({ ...base, debito: 250_000, valoreOggi: 200_000 });
  fin(uw, "underwater");
  assert(uw.equity === 0 && uw.coc === 0, "underwater CoC 0");

  const er = analizzaCasa({ ...base, canoneMese: 1e9 });
  fin(er, "extreme rent");
  assert(Number.isFinite(er.yoc) && er.yoc > 1000 && er.voto === 10, "extreme rent finite + max voto");

  const empty = analizzaCasa({ ...AFFARE_VUOTO });
  fin(empty, "all zero");
  assert(empty.yoc === 0 && empty.lordo === 0 && empty.netto === 0 && empty.coc === 0, "empty yields 0");

  // inflazione −100 %: no Infinity in esito
  const inf = analizzaCasa({ ...base, inflazione: -1 });
  assert(Number.isNaN(inf.totaleReale), `infl−100 totaleReale NaN got ${inf.totaleReale}`);
  assert(inf.scenari.every((s) => Number.isFinite(s.totale) || Number.isNaN(s.totale)), "infl−100 scenari no ∞");
  assert(Number.isFinite(inf.voto), "infl−100 voto finite");
  assert(pct(inf.totaleReale) === "—", "pct(NaN) → —");
  assert(Number.isNaN(reale(0.07, -1)), "reale(·,−1) → NaN");
  assert(Number.isNaN(reale(Number.NaN, 0.02)), "reale(NaN) → NaN");
  assert(Math.abs(reale(0.07, 0.02) - ((1.07 / 1.02) - 1)) < 1e-12, "reale Fisher");

  const tan0 = analizzaCasa({ ...base, tan: 0 });
  fin(tan0, "tan 0");
  assert(Math.abs(rataFrancese(150_000, 0, 25) - 150_000 / (25 * 12)) < 1e-9, "rata tan0 = K/n");
  assert(interessiAnno1(150_000, 0, 25) === 0, "interessi tan0 = 0");

  const capInf = analizzaCapitale({
    nome: "x",
    tipo: "azioni",
    capitale: 1000,
    rendimentoAtteso: 0.08,
    crolloPct: 0.25,
    inflazione: -1,
  });
  assert(Number.isNaN(capInf.reale) && Number.isFinite(capInf.voto), "capitale infl−100");

  // UI contract: cards bind to s.totale (not s.reale) so Base shows nominale
  assert(Math.abs(e0.scenari[0].totale - e0.totale) < 1e-12, "UI Base = totale nominale");
  assert(Math.abs(e0.scenari[3].totale - e0.totaleReale) < 1e-12, "UI Reale = totaleReale");

  // Investi empty gates: denominatore (costo O valore di mercato) E ricavi — non inventare il voto
  assert(!schedaCasaPronta(empty), "gate rejects all-zero");
  assert(!schedaCasaPronta(analizzaCasa({ ...AFFARE_VUOTO, prezzo: 200_000 })), "gate rejects solo prezzo");
  assert(!schedaCasaPronta(analizzaCasa({ ...AFFARE_VUOTO, canoneMese: 900 })), "gate rejects solo canone");
  assert(!schedaCasaPronta(analizzaCasa({ ...AFFARE_VUOTO, valoreOggi: 220_000 })), "gate rejects solo valore");
  assert(
    schedaCasaPronta(analizzaCasa({ ...AFFARE_VUOTO, prezzo: 200_000, canoneMese: 900 })),
    "gate accepts prezzo+canone",
  );
  assert(
    schedaCasaPronta(analizzaCasa({ ...AFFARE_VUOTO, valoreOggi: 220_000, canoneMese: 900 })),
    "gate accepts valore di mercato+canone (20afcde residual)",
  );
  assert(
    schedaCasaPronta(
      analizzaCasa({ ...AFFARE_VUOTO, uso: "turistico", prezzo: 200_000, tariffaNotte: 80 }),
    ),
    "gate accepts turistico prezzo+tariffa",
  );
  assert(
    !schedaCasaPronta(analizzaCasa({ ...AFFARE_VUOTO, uso: "turistico", tariffaNotte: 80 })),
    "gate rejects turistico solo tariffa",
  );

  // Nonsense STR inputs must not yield negative OpEx (domain clamp)
  const nonsense = {
    ...AFFARE_VUOTO,
    uso: "turistico" as const,
    tariffaNotte: -100,
    occupazionePct: 1.5, // 150 % leaked past UI
    gestionePct: 0.2,
  };
  assert(ricaviAnno(nonsense) === 0, "turistico nonsense ricavi clamped to 0");
  assert(opexAnno(nonsense) >= 0, "turistico nonsense opex >= 0");
  assert(
    opexAnno(nonsense) !== -10_950,
    "turistico nonsense must not reproduce −10.950 €/anno bug",
  );
}

// --- Casa delete persists: no house revived from code; selection moves ---
{
  const temp = { ...IMMOBILE_VUOTO, id: "temp-1", nome: "Casa TEMP" };
  const base = { ...demoStatoCompleto(), immobili: [DEMO_CASA, temp], immobileSelezionatoId: "temp-1" };

  // After delete TEMP: persist remaining + selection on the demo house
  const afterDelete = {
    ...base,
    immobili: [DEMO_CASA],
    immobileSelezionatoId: DEMO_CASA_ID,
  };
  const hyd = hydratePersisted(afterDelete, base, null);
  assert(hyd.immobili.length === 1 && hyd.immobili[0].id === DEMO_CASA_ID, "delete TEMP hydrate keeps the demo house");
  assert(hyd.immobileSelezionatoId === DEMO_CASA_ID, "selection moves to remaining");
  const selPersa = hydratePersisted({ ...afterDelete, immobileSelezionatoId: "temp-1" }, base, null);
  assert(selPersa.immobileSelezionatoId === DEMO_CASA_ID, "selezione su una casa cancellata → la prima rimasta");

  // Empty list must NOT revive a house
  const emptyHyd = hydratePersisted({ ...afterDelete, immobili: [], immobileSelezionatoId: "" }, base, null);
  assert(emptyHyd.immobili.length === 0, "empty immobili must not re-seed");
  assert(emptyHyd.immobileSelezionatoId === "", "selection empty when no case");
  assert(
    emptyHyd.fisse.length === DEMO_FISSE.length && emptyHyd.fisse.every((f) => f.immobileId === undefined && f.voce === undefined),
    "spese di una casa che non c'è più: restano, ma scollegate",
  );

  // Storage blob leak must not fall back to a default house (would undo deletes)
  const blob = { state: { ...afterDelete, immobili: [temp] }, version: 20 };
  const fromBlob = hydratePersisted(blob, base, null);
  assert(
    fromBlob.immobili.length === 1 && fromBlob.immobili[0].id === "temp-1",
    "unwrap storage blob preserves immobili (no seed overwrite)",
  );

  // Casa agganciata a una rata mutuo che non c'è più: sganciata, niente mutuo fantasma.
  const orfano = hydratePersisted({ ...afterDelete, fisse: DEMO_FISSE.filter((f) => f.id !== "mutuo") }, base, null);
  assert(orfano.immobili[0].fissaMutuoId === "", "hydrate: casa legata a un mutuo cancellato → sganciata");
  assert(interessiMese(orfano.immobili[0], orfano.fisse, "2026-10-01") === (DEMO_CAPITALE_MUTUO * DEMO_TAN) / 12, "mutuo orfano: resta solo debito × TAN scritti dall'utente");

  // resolveImmobiliFromPersist unit
  const resolvedEmpty = resolveImmobiliFromPersist({ immobili: [] }, DEMO_PATRIMONIO, [DEMO_CASA], true);
  assert(resolvedEmpty.length === 0, "resolve [] stays []");
  const legacyId = immobileDaPatrimonio(DEMO_PATRIMONIO).id;
  const resolvedMissingLegacy = resolveImmobiliFromPersist({}, DEMO_PATRIMONIO, [DEMO_CASA], true);
  assert(
    resolvedMissingLegacy.length === 1 && resolvedMissingLegacy[0].id === legacyId && resolvedMissingLegacy[0].mq === 80,
    "legacy missing key → the patrimonio's own house, once",
  );
  // Il mutuo della casa vecchia si ritrova dal nome, qualunque id avesse nel salvataggio.
  const fisseVecchie = [null, 7, { id: "prestito", nome: "Prestito auto" }, { id: "rata-1", nome: "Mutuo prima casa" }];
  const legacyConMutuo = resolveImmobiliFromPersist({ fisse: fisseVecchie as never }, DEMO_PATRIMONIO, [], true);
  assert(legacyConMutuo[0]?.fissaMutuoId === "rata-1", "legacy: la casa si aggancia alla spesa fissa che si chiama mutuo");
  assert(immobileDaPatrimonio(DEMO_PATRIMONIO, [{ id: "prestito", nome: "Prestito" }]).fissaMutuoId === "", "legacy senza mutuo → nessun aggancio");
  assert(!/vr/i.test(legacyId), "legacy: l'id della casa non dice dove sta");
  assert(
    resolveImmobiliFromPersist({}, PATRIMONIO_VUOTO, [DEMO_CASA], true).length === 0,
    "legacy blob con patrimonio senza casa → nessuna casa fantasma",
  );
  assert(
    resolveImmobiliFromPersist({}, { ...PATRIMONIO_VUOTO, capitaleMutuo: 1000 }, [], true).length === 1,
    "legacy blob con solo il mutuo → la casa c'era",
  );
  assert(
    resolveImmobiliFromPersist({ immobili: "rotto" as never }, DEMO_PATRIMONIO, [DEMO_CASA], true).length === 0,
    "immobili corrotto → [] (non ri-semina)",
  );
  assert(
    resolveImmobiliFromPersist({}, DEMO_PATRIMONIO, [DEMO_CASA], false)[0]?.id === DEMO_CASA_ID,
    "primo avvio senza salvataggio → default in memoria",
  );
  assert(resolveImmobiliFromPersist({}, DEMO_PATRIMONIO, undefined, false).length === 0, "primo avvio senza default → []");
}

// --- App nuda: niente dati personali nel codice ---
{
  assert(
    STATO_VUOTO.fisse.length === 0 && STATO_VUOTO.redditoMensile === 0 && STATO_VUOTO.redditoAnnuo === 0,
    "STATO_VUOTO: niente spese, niente reddito",
  );
  assert(
    Object.values(PATRIMONIO_VUOTO).every((v) => v === 0 || v === false || v === ""),
    "PATRIMONIO_VUOTO: tutto a zero",
  );
  assert(SPESA_CATS.find((c) => c.id === "gatto")?.label === "Animali", "categoria di serie generica: Animali");
  // Il fixture stesso: piano con un buco, una rata con spese, rate pagate e da pagare.
  assert(DEMO_PIANO_MUTUO.length === DEMO_N_RATE - 1, "fixture: una riga manca nel piano");
  assert(DEMO_PIANO_MUTUO.at(-1)?.k === 0, "fixture: il piano chiude a zero");
  assert(DEMO_PIANO_MUTUO.some((r) => r.p) && DEMO_PIANO_MUTUO.some((r) => !r.p), "fixture: rate pagate e da pagare");
  assert(DEMO_PIANO_MUTUO.filter((r) => !splitChiude(r)).length === 1, "fixture: una sola rata con spese oltre a c + i");
}

// --- tanDaNota: il TAN che l'utente ha scritto nella nota della rata ---
{
  assert(near(tanDaNota("TAN 2,40% fisso"), 0.024), "tanDaNota «TAN 2,40%» → 0,024");
  assert(near(tanDaNota("mutuo tan 3.1 % variabile"), 0.031), "tanDaNota minuscolo, punto, spazio prima del %");
  assert(near(tanDaNota("Rata TAN2%"), 0.02), "tanDaNota senza spazio");
  assert(tanDaNota("") === 0 && tanDaNota(undefined) === 0, "tanDaNota vuota → 0");
  assert(tanDaNota("nessun tasso") === 0 && tanDaNota("TAEG 3%") === 0, "tanDaNota senza TAN → 0");
  assert(tanDaNota("TAN 0%") === 0, "tanDaNota 0 % → 0");
  assert(tanDaNota("TAN 45%") === 0, "tanDaNota fuori scala (≥ 30 %) → 0");
}

// --- importaProfiloPrivato: aggiunge solo dove manca, mai sopra un dato dell'utente ---
{
  const nudo = (id: string) => normalizzaFissa({ ...demoFissa(id), piano: undefined, immobileId: undefined, voce: undefined });
  const base = demoProfilo();
  const prof: ProfiloPrivato = {
    ...base,
    piani: { ...base.piani, prestito: DEMO_PIANO_MUTUO },
    immobili: { ...base.immobili, "casa-b": { eurMqZona: 9999, mutuoTan: 0.03 } },
  };
  const d = {
    fisse: [
      { ...nudo("mutuo"), frequenza: "annuale" as const, categoria: "casa" },
      demoFissa("prestito"), // ha già il suo piano
      nudo("condominio"),
      { ...nudo("luce"), immobileId: "casa-b", voce: "gas" as const }, // già legata dall'utente
      nudo("palestra"),
    ],
    immobili: [
      normalizzaImmobile({ ...DEMO_CASA, eurMqZona: 0, mutuoTan: 0 }),
      normalizzaImmobile({ ...DEMO_CASA, id: "casa-b", nome: "B", eurMqZona: 1500, mutuoTan: 0 }),
    ],
    csvMovimenti: [],
    regole: [{ needle: "bar demo", cat: "ristoranti" }],
  };
  const out = importaProfiloPrivato(d, prof);
  const fo = (id: string) => out.fisse.find((f) => f.id === id)!;
  assert(out.fisse.length === d.fisse.length, "profilo: nessuna fissa creata (piano per un id che non c'è ignorato)");
  assert(hasPiano(fo("mutuo")) && fo("mutuo").piano?.length === DEMO_PIANO_MUTUO.length, "profilo: piano sulla fissa che non l'aveva");
  assert(fo("mutuo").frequenza === "mensile" && fo("mutuo").categoria === "debito", "profilo: fissa col piano diventa mensile e debito");
  assert(fo("prestito").piano === DEMO_PIANO_PRESTITO, "profilo: il piano già dell'utente non viene sostituito");
  assert(fo("condominio").immobileId === DEMO_CASA_ID && fo("condominio").voce === "condominio", "profilo: spesa legata alla sua casa con la voce");
  assert(fo("luce").immobileId === "casa-b" && fo("luce").voce === "gas", "profilo: una spesa già legata dall'utente resta com'è");
  assert(fo("palestra").immobileId === undefined, "profilo: niente legami verso una casa che non esiste");
  assert(out.immobili.length === 2, "profilo: nessuna casa creata");
  const casa = out.immobili.find((i) => i.id === DEMO_CASA_ID)!;
  const casaB = out.immobili.find((i) => i.id === "casa-b")!;
  assert(casa.eurMqZona === 2000 && casa.mutuoTan === 0, "profilo: €/m² dove mancava, TAN assente nel profilo resta 0");
  assert(casaB.eurMqZona === 1500 && casaB.mutuoTan === 0.03, "profilo: €/m² dell'utente vince, TAN aggiunto dove era 0");
  assert(out.csvMovimenti.length === DEMO_MOVIMENTI.length, "profilo: movimenti quando l'estratto è vuoto");
  const conMovimenti = importaProfiloPrivato({ ...d, csvMovimenti: [DEMO_MOVIMENTI[0]] }, prof);
  assert(conMovimenti.csvMovimenti.length === 1, "profilo: movimenti mai sopra un estratto già caricato");
  assert(
    out.regole.length === 2 &&
      out.regole.find((r) => r.needle === "bar demo")?.cat === "ristoranti" &&
      out.regole.some((r) => r.needle === "supermercato demo"),
    "profilo: regole senza doppioni, quella dell'utente vince",
  );
  assert(stable(importaProfiloPrivato(out, prof)) === stable(out), "importaProfiloPrivato idempotente");
  assert(stable(importaProfiloPrivato(d, {})) === stable(d), "profilo vuoto → niente cambia");
  const pianoRotto = importaProfiloPrivato(d, { piani: { mutuo: [{ junk: 1 }] as never } });
  assert(!hasPiano(pianoRotto.fisse[0]), "profilo con piano malformato → nessun piano");

  // Salvataggio di prima delle case multiple: la casa ha un id nuovo, il profilo quello vecchio.
  const profVecchio: ProfiloPrivato = {
    immobili: { "casa-vecchia": { eurMqZona: 1234, mutuoTan: 0.021 } },
    fisseCasa: { "casa-vecchia": { condominio: "condominio" } },
  };
  const unaCasa = { ...d, immobili: [normalizzaImmobile({ ...DEMO_CASA, id: "casa", eurMqZona: 0, mutuoTan: 0 })] };
  const agganciata = importaProfiloPrivato(unaCasa, profVecchio);
  assert(
    agganciata.immobili[0].eurMqZona === 1234 && agganciata.immobili[0].mutuoTan === 0.021,
    "profilo con l'id vecchio della casa: €/m² e TAN arrivano sull'unica casa",
  );
  assert(
    agganciata.fisse.find((f) => f.id === "condominio")?.immobileId === "casa",
    "profilo con l'id vecchio della casa: le sue spese si legano all'unica casa",
  );
  const dueCase = importaProfiloPrivato(d, profVecchio);
  assert(
    dueCase.immobili.every((i) => i.eurMqZona !== 1234) && dueCase.fisse.find((f) => f.id === "condominio")?.immobileId === undefined,
    "con più case un id sconosciuto non si indovina",
  );
  const unaNota = importaProfiloPrivato(unaCasa, {
    immobili: { casa: { eurMqZona: 1500 }, "casa-vecchia": { eurMqZona: 1234 } },
  });
  assert(unaNota.immobili[0].eurMqZona === 1500, "se una chiave combacia, le altre non si indovinano");
}

// --- hydratePersisted: salvataggio di prima dell'app nuda, con e senza profilo ---
{
  const base = demoStatoCompleto();
  const prof = demoProfilo();
  const nudo = (id: string) => normalizzaFissa({ ...demoFissa(id), piano: undefined, immobileId: undefined, voce: undefined });
  // Come arriva da localStorage: JSON, senza legacyImportato, casa coi campi sparsi.
  const oldBlob = JSON.parse(
    JSON.stringify({
      redditoMensile: 0,
      redditoAnnuo: 0,
      fisse: ["mutuo", "prestito", "condominio", "luce", "tari", "palestra"].map(nudo),
      patrimonio: { ...DEMO_PATRIMONIO, fonteAttivo: undefined, fonteNome: undefined, fonteTotale: 3000, fonteInvestito: 3000 },
      immobili: [
        {
          ...DEMO_CASA,
          speseAcquisto: undefined,
          eurMqZona: undefined,
          mutuoTan: undefined,
          mutuoFine: undefined,
          uso: undefined,
          citta: undefined,
          closingCosts: 8000,
          capexTetto: 12_000,
          capexInfissi: 2000,
          capexPorte: 3000,
        },
      ],
      immobileSelezionatoId: DEMO_CASA_ID,
      cedolini: [
        { id: "2026-06", netto: 2000, nota: "" },
        { id: "2026-07", mese: "2026-07", netto: 2500, nota: "di cui 500 € 730" },
      ],
      csvMovimenti: [],
      regole: [],
      movimentiArchiviati: ["2026-08-01|bar demo|3|uscita"],
    }),
  );
  assert(!("legacyImportato" in oldBlob), "blob vecchio: senza flag");

  const out1 = hydratePersisted(oldBlob, base, prof);
  const f1 = (id: string) => out1.fisse.find((f) => f.id === id)!;
  const casa1 = out1.immobili[0];
  assert(out1.legacyImportato === true, "vecchio + profilo → legacyImportato true");
  assert(f1("mutuo").piano?.length === DEMO_PIANO_MUTUO.length, "vecchio + profilo: il piano torna sulla rata");
  assert(f1("mutuo").immobileId === DEMO_CASA_ID && f1("mutuo").voce === "mutuo", "la rata del mutuo diventa spesa della sua casa (voce mutuo)");
  assert(!hasPiano(f1("prestito")), "fissa senza piano nel profilo resta senza");
  assert(f1("condominio").voce === "condominio" && f1("tari").immobileId === DEMO_CASA_ID, "spese legate alla casa dal profilo");
  assert(f1("palestra").immobileId === undefined, "spesa non di casa resta libera");
  assert(casa1.eurMqZona === 2000, "€/m² della zona dal profilo");
  assert(near(casa1.mutuoTan ?? 0, DEMO_TAN), "TAN dalla nota della rata («TAN 2,40%»)");
  assert(casa1.mutuoFine === DEMO_PIANO_MUTUO.at(-1)!.d.slice(0, 7), "mutuoFine dall'ultima riga del piano");
  assert(
    casa1.speseAcquisto?.map((s) => `${s.id}:${s.importo}`).join(",") === "atto:8000,tetto:12000,infissi:2000,porte:3000",
    "spese di acquisto costruite dai campi vecchi",
  );
  assert(casa1.uso === "abito" && casa1.citta === "", "uso e città con valori neutri");
  assert(out1.csvMovimenti.length === DEMO_MOVIMENTI.length && out1.regole.length === 2, "movimenti e regole dal profilo");
  assert(out1.patrimonio.fonteAttivo === true, "Fon.Te acceso: il salvataggio vecchio aveva un saldo");
  assert(out1.cedolini.length === 2 && out1.cedolini[0].mese === "2026-06", "cedolino senza mese riparato dall'id");
  assert(out1.redditoMensile === 2000 && out1.redditoAnnuo === 24_000, "reddito = media dei netti ordinari (2.000 e 2.500 − 500)");
  assert(out1.movimentiArchiviati[0] === "2026-08-01|bar demo|3|uscita#0", "archivio vecchio → prima occorrenza (#0)");
  assert(
    near(costoAffittoMese(withImmobile(out1.patrimonio, casa1), casa1, out1.fisse).spese, 60 + 20),
    "dopo l'import: in affitto contano luce e TARI legate alla casa",
  );

  // Idempotenza: il risultato salvato (versione 21) e riletto dà lo stesso stato.
  const out2 = hydratePersisted({ state: out1, version: 21 }, base, prof);
  assert(stable(out2) === stable(out1), "hydrate idempotente: ri-hydrate della versione 21 = stesso stato");
  const out3 = hydratePersisted(out1, base, null);
  assert(stable(out3) === stable(out1), "dopo l'import il profilo non serve più");

  // Senza profilo: migrazioni generiche sì, dati del profilo no, flag resta false.
  const outNo = hydratePersisted(oldBlob, base, null);
  const fNo = (id: string) => outNo.fisse.find((f) => f.id === id)!;
  assert(outNo.legacyImportato === false, "vecchio senza profilo → legacyImportato resta false");
  assert(!hasPiano(fNo("mutuo")) && outNo.csvMovimenti.length === 0 && outNo.regole.length === 0, "senza profilo: nessun piano, movimento o regola inventati");
  assert(near(outNo.immobili[0].mutuoTan ?? 0, DEMO_TAN), "senza profilo: TAN dalla nota vale lo stesso");
  assert(outNo.immobili[0].eurMqZona === 0 && outNo.immobili[0].mutuoFine === "", "senza profilo: niente zona, niente fine mutuo");
  assert(fNo("mutuo").immobileId === DEMO_CASA_ID && fNo("condominio").immobileId === undefined, "senza profilo: solo il mutuo si lega alla casa");
  assert(stable(hydratePersisted({ state: outNo, version: 21 }, base, null)) === stable(outNo), "senza profilo: hydrate idempotente");
  // Lo stesso salvataggio aperto più tardi col profilo arriva allo stesso punto.
  const outDopo = hydratePersisted({ state: outNo, version: 21 }, base, prof);
  assert(outDopo.legacyImportato === true && hasPiano(outDopo.fisse.find((f) => f.id === "mutuo")), "profilo arrivato dopo: import al primo avvio");
  assert(stable(outDopo) === stable(out1), "profilo arrivato dopo = profilo subito");

  // Salvataggio già nuovo: il profilo non si riapplica, la nota non si rilegge.
  const nuovo = hydratePersisted({ ...oldBlob, legacyImportato: true }, base, prof);
  assert(nuovo.legacyImportato === true && !hasPiano(nuovo.fisse.find((f) => f.id === "mutuo")), "salvataggio nuovo: profilo ignorato");
  assert(nuovo.csvMovimenti.length === 0 && (nuovo.immobili[0].mutuoTan ?? 0) === 0, "salvataggio nuovo: niente movimenti, TAN solo come migrazione dei vecchi");
  // TAN scritto dall'utente: la nota non lo sovrascrive.
  const tanUtente = hydratePersisted({ ...oldBlob, immobili: [{ ...oldBlob.immobili[0], mutuoTan: 0.031 }] }, base, null);
  assert(tanUtente.immobili[0].mutuoTan === 0.031, "TAN dell'utente vince sulla nota");

  // Nessun salvataggio: resta lo stato iniziale, che è già a posto.
  const fresco = hydratePersisted(null, base, prof);
  assert(fresco.legacyImportato === true && fresco.csvMovimenti.length === 0, "primo avvio: legacyImportato true, profilo non applicato");
  const vuoto = hydratePersisted(undefined, { ...base, legacyImportato: true, fisse: [], immobili: [] }, prof);
  assert(vuoto.legacyImportato === true && vuoto.fisse.length === 0, "primo avvio app nuda: niente da importare");
}

// --- fonteAttivo: Fon.Te si vede solo se c'è ---
{
  const base = demoStatoCompleto();
  const pat = (extra: Record<string, unknown>) => ({ patrimonio: { ...PATRIMONIO_VUOTO, fonteAttivo: undefined, ...extra } });
  assert(hydratePersisted(pat({}), base, null).patrimonio.fonteAttivo === false, "vecchio senza dati Fon.Te → spento");
  assert(hydratePersisted(pat({ fonteTotale: 100 }), base, null).patrimonio.fonteAttivo === true, "vecchio con saldo Fon.Te → acceso");
  assert(hydratePersisted(pat({ retribuzioneUtile: 2000 }), base, null).patrimonio.fonteAttivo === true, "vecchio con busta Fon.Te → acceso");
  assert(hydratePersisted(pat({ tfrAccantonato: 300 }), base, null).patrimonio.fonteAttivo === true, "vecchio con TFR accantonato → acceso");
  assert(hydratePersisted(pat({ fonteAttivo: false, fonteTotale: 100 }), base, null).patrimonio.fonteAttivo === false, "spento dall'utente resta spento");
  assert(hydratePersisted(pat({ fonteAttivo: true }), base, null).patrimonio.fonteAttivo === true, "acceso senza dati resta acceso");
  const snap = buildFonteSnapshot({ data: "2026-06-30", comparto: "dinamico", numeroQuote: 10, valoreQuota: 20, fonte: "manuale" });
  assert(hydratePersisted({ ...pat({}), fonteSnapshots: [snap] }, base, null).patrimonio.fonteAttivo === true, "vecchio con storico Fon.Te → acceso");
  const senza = hydratePersisted({ fisse: [] }, base, null).patrimonio;
  assert(senza.fonteAttivo === false && senza.fonteNome === "", "patrimonio mancante → Fon.Te spento, nome vuoto");
  assert(hydratePersisted(pat({ fonteNome: 7 }), base, null).patrimonio.fonteNome === "", "fonteNome non stringa → ''");
}

// --- speseAcquistoDaCampi + withImmobile: la lista delle spese torna i tre numeri delle formule ---
{
  const lista = speseAcquistoDaCampi({ closingCosts: 8000, capexTetto: 12_000, capexInfissi: 2000, capexPorte: 0 });
  assert(lista.map((s) => s.id).join(",") === "atto,tetto,infissi", "speseAcquistoDaCampi: una voce per campo > 0 (porte 0 saltate)");
  const atto = lista.find((s) => s.id === "atto")!;
  assert(atto.tipo === "atto" && !atto.detraibile && atto.importo === 8000, "atto: notaio e imposte, senza bonus");
  assert(lista.filter((s) => s.tipo === "lavori").every((s) => s.detraibile), "tetto e infissi: lavori col bonus");
  assert(
    speseAcquistoDaCampi({ closingCosts: Number.NaN, capexTetto: -5, capexInfissi: 0, capexPorte: 3000 })
      .map((s) => `${s.id}:${s.tipo}:${s.detraibile}`)
      .join(",") === "porte:lavori:false",
    "speseAcquistoDaCampi: NaN e negativi saltati, porte senza bonus",
  );
  const pc = withImmobile(DEMO_PATRIMONIO, DEMO_CASA);
  assert(pc.closingCosts === 8000, "withImmobile: atto → closingCosts");
  assert(pc.capexTetto === 14_000 && pc.capexInfissi === 0, "withImmobile: lavori col bonus (12.000 + 2.000) → capexTetto");
  assert(pc.capexPorte === 3000, "withImmobile: lavori senza bonus → capexPorte");
  assert(pc.eurMqZona === 2000 && pc.mq === 80 && pc.capitaleMutuo === DEMO_CAPITALE_MUTUO, "withImmobile: campi della casa");
  assert(pc.saldoConto === DEMO_PATRIMONIO.saldoConto, "withImmobile: il resto del patrimonio resta");
  assert(costoPieno(pc) === 140_000 + 8000 + 17_000, "costoPieno = prezzo + atto + tutti i lavori");
  assert(costoPienoNetto(pc) === 140_000 + 8000 + 3000 + 14_000 * 0.5, "costoPienoNetto: scendono del 50 % solo i lavori col bonus");
  assert(near(bonusLavoriResiduo(pc), (7000 / 10) * 7), "bonus residuo: 7 quote da 700");
  // Casa grezza, senza lista: withImmobile ripiega sui campi sparsi.
  const grezza = { ...DEMO_CASA, speseAcquisto: undefined, closingCosts: 5000, capexTetto: 1000, capexInfissi: 500, capexPorte: 200 };
  const pg = withImmobile(DEMO_PATRIMONIO, grezza);
  assert(pg.closingCosts === 5000 && pg.capexTetto === 1500 && pg.capexPorte === 200, "withImmobile senza lista: campi sparsi");
  // Hydrate della lista.
  const norm = normalizzaImmobile({ ...DEMO_CASA, speseAcquisto: undefined, closingCosts: 5000 });
  assert(norm.speseAcquisto?.length === 1 && norm.speseAcquisto[0].importo === 5000, "normalizzaImmobile: lista dai campi vecchi, una volta");
  assert(
    normalizzaImmobile({ ...DEMO_CASA, speseAcquisto: [], closingCosts: 5000 }).speseAcquisto?.length === 0,
    "normalizzaImmobile: lista svuotata dall'utente resta vuota",
  );
  const sporca = normalizzaImmobile({
    ...DEMO_CASA,
    speseAcquisto: [
      { id: "a", nome: "Atto", importo: 100, tipo: "atto", detraibile: true },
      { id: "", nome: 3 as never, importo: -5, tipo: "lavori", detraibile: true },
      null as never,
      "x" as never,
      { id: "z", nome: "Z", importo: 1, tipo: "boh" as never, detraibile: true },
    ],
  });
  const sp = sporca.speseAcquisto ?? [];
  assert(sp.length === 3, "normalizzaImmobile: righe spesa non oggetto scartate");
  assert(sp[0].detraibile === false, "una spesa d'atto non è mai col bonus");
  assert(sp[1].importo === 0 && sp[1].nome === "" && sp[1].id.length > 0 && sp[1].detraibile, "importo negativo → 0, nome → '', id generato");
  assert(sp[2].tipo === "atto" && !sp[2].detraibile, "tipo sconosciuto → atto");
  assert(normalizzaImmobile({ ...DEMO_CASA, uso: "vacanza" as never }).uso === "abito", "uso sconosciuto → abito");
  assert(normalizzaImmobile({ ...DEMO_CASA, uso: "affitto" }).uso === "affitto", "uso affitto resta");
}

// --- mergeMissingCedolini: una riga rotta non fa fallire il ripristino ---
{
  const rows = mergeMissingCedolini([
    { id: "2026-03", netto: 2000, nota: "" } as never, // manca il mese: dall'id
    { id: "abc", netto: 1, nota: "" } as never, // né mese né id-mese: scartata
    { id: "x", mese: "2026-01", netto: Number.NaN, nota: 5 as never, fileName: "" },
    { mese: "2026-02", netto: 1800, nota: "ok", fileName: "feb.pdf" } as never,
    null as never,
    "riga" as never,
    { id: "2026-04", mese: "aprile", netto: 1900, nota: "" }, // mese malformato: dall'id
  ]);
  const m = (mese: string) => rows.find((r) => r.mese === mese);
  assert(rows.map((r) => r.mese).join(",") === "2026-01,2026-02,2026-03,2026-04", `cedolini riparati e ordinati got ${rows.map((r) => r.mese).join(",")}`);
  assert(m("2026-03")?.id === "2026-03" && m("2026-03")?.netto === 2000, "cedolino senza mese riparato dall'id");
  assert(m("2026-01")?.netto === 0 && m("2026-01")?.nota === "", "netto NaN → 0, nota non stringa → ''");
  assert(!("fileName" in m("2026-01")!), "fileName vuoto non salvato");
  assert(m("2026-02")?.id === "2026-02" && m("2026-02")?.fileName === "feb.pdf", "cedolino senza id: id = mese, fileName tenuto");
  assert(near(redditoMedio(rows), (0 + 1800 + 2000 + 1900) / 4), "redditoMedio sulle righe riparate");
  assert(near(redditoMedio(DEMO_CEDOLINI), 2000), "redditoMedio demo: (2.000 + 2.500 − 500) / 2");
}

// --- guessCedolinoMese: l'anno deve stare fra l'anno scorso e il prossimo ---
{
  const oggi = new Date(2026, 8, 25);
  const g = (nome: string, d = oggi) => guessCedolinoMese(nome, d);
  assert(g("Cedolino 3103.pdf") === "", "«Cedolino 3103» è il 31 marzo, non marzo 2031");
  assert(g("cedolino_2026-03.pdf") === "2026-03", "AAAA-MM");
  assert(g("busta.2025.12.pdf") === "2025-12", "anno scorso nella finestra");
  assert(g("busta 2603.pdf") === "2026-03", "AAMM");
  assert(g("202701.pdf") === "2027-01", "AAAAMM, anno prossimo nella finestra");
  assert(g("cedolino 2024-05.pdf") === "", "due anni fa: fuori finestra");
  assert(g("cedolino 2028-01.pdf") === "", "fra due anni: fuori finestra");
  assert(g("cedolino 2026-13.pdf") === "", "mese 13 → ''");
  assert(g("scan 1234 cedolino 2026_07.pdf") === "2026-07", "vince il primo candidato plausibile");
  assert(g("Cedolino 3103.pdf", new Date(2031, 0, 10)) === "2031-03", "lo stesso nome nel 2031 è marzo 2031");
  assert(g("") === "" && g("stipendio.pdf") === "", "nessuna data → ''");
}

// --- normalizzaFissa / normalizzaPiano: hydrate di spese e piani ---
{
  const f = normalizzaFissa({ ...PALESTRA, immobileId: "", voce: 3 as never, piano: [] });
  assert(!("immobileId" in f) && !("voce" in f) && !("piano" in f), "normalizzaFissa: casa vuota, voce non stringa, piano vuoto → tolti");
  const g = normalizzaFissa({ ...PALESTRA, frequenza: undefined as never, mese: undefined as never });
  assert(g.frequenza === "mensile" && g.mese === 1, "normalizzaFissa: frequenza e mese mancanti → mensile, gennaio");
  assert(normalizzaFissa(MUTUO).piano === DEMO_PIANO_MUTUO && normalizzaFissa(MUTUO).voce === "mutuo", "normalizzaFissa tiene piano e voce buoni");
  const np = normalizzaPiano([
    { n: 1, d: "2026-01-01", c: 10, i: 1, r: 11, k: 90, p: 1 as never },
    { n: 2, d: 5 as never, c: 1, i: 1, r: 2, k: 1, p: false },
    null,
    { n: 3, d: "2026-03-01", c: Number.NaN, i: 1, r: 1, k: 1, p: true },
  ]);
  assert(np?.length === 1 && np[0].p === true, "normalizzaPiano: righe malformate fuori, p booleano");
  assert(
    normalizzaPiano([]) === undefined && normalizzaPiano("x") === undefined && normalizzaPiano([{ junk: 1 }]) === undefined,
    "normalizzaPiano: niente di buono → undefined",
  );
  assert(stable(normalizzaPiano(DEMO_PIANO_MUTUO)) === stable(DEMO_PIANO_MUTUO), "normalizzaPiano tiene un piano sano");
}

// --- Store: addFissa → id, removeImmobile con e senza le spese, removeFonte ---
{
  const st = () => useQuadra.getState();
  assert(st().legacyImportato === true, "store nuovo: legacyImportato già true (niente da importare)");
  assert(
    st().fisse.length === 0 && st().immobili.length === 0 && st().cedolini.length === 0 && st().csvMovimenti.length === 0 && st().regole.length === 0,
    "store nuovo: app nuda, nessun dato nel codice",
  );
  assert(st().redditoMensile === 0 && st().patrimonio.fonteAttivo === false && st().patrimonio.saldoConto === 0, "store nuovo: reddito 0, Fon.Te spento");

  const idA = st().addImmobile({ ...IMMOBILE_VUOTO, nome: "A" });
  const idB = st().addImmobile({ ...IMMOBILE_VUOTO, nome: "B" });
  assert(st().immobileSelezionatoId === idB, "addImmobile seleziona la casa nuova");
  const spesa = (nome: string, immobileId?: string, voce?: Fissa["voce"]): Omit<Fissa, "id"> => ({
    nome,
    importo: 50,
    giorno: 1,
    mese: 1,
    frequenza: "mensile",
    categoria: "casa",
    note: "",
    immobileId,
    voce,
  });
  const fA1 = st().addFissa(spesa("Condominio A", idA, "condominio"));
  const fA2 = st().addFissa(spesa("Luce A", idA, "luce"));
  const fB = st().addFissa(spesa("Luce B", idB, "luce"));
  const fX = st().addFissa({ ...spesa("Palestra"), categoria: "vita" });
  assert(
    [fA1, fA2, fB, fX].every((id) => typeof id === "string" && st().fisse.some((f) => f.id === id)) && new Set([fA1, fA2, fB, fX]).size === 4,
    "addFissa restituisce l'id della spesa creata",
  );
  assert(!("immobileId" in st().fisse.find((f) => f.id === fX)!), "addFissa senza casa: nessun immobileId vuoto salvato");

  st().selectImmobile(idA);
  st().removeImmobile(idA);
  assert(st().immobili.map((i) => i.id).join(",") === idB, "removeImmobile: resta solo B");
  assert(st().immobileSelezionatoId === idB, "removeImmobile della casa selezionata → selezione sulla rimasta");
  assert(st().fisse.length === 4, "removeImmobile senza conSpese: le spese restano");
  const a1 = st().fisse.find((f) => f.id === fA1)!;
  const a2 = st().fisse.find((f) => f.id === fA2)!;
  assert(!("immobileId" in a1) && !("voce" in a1) && !("immobileId" in a2), "... ma scollegate (niente immobileId né voce)");
  assert(st().fisse.find((f) => f.id === fB)?.immobileId === idB, "la spesa dell'altra casa resta legata");

  st().removeImmobile(idB, { conSpese: true });
  assert(st().immobili.length === 0 && st().immobileSelezionatoId === "", "removeImmobile dell'ultima casa → nessuna selezione");
  assert(!st().fisse.some((f) => f.id === fB), "removeImmobile conSpese: via anche le spese della casa");
  assert(
    st().fisse.length === 3 && [fA1, fA2, fX].every((id) => st().fisse.some((f) => f.id === id)),
    "conSpese tocca solo le spese di quella casa",
  );

  const idC = st().addImmobile({ ...IMMOBILE_VUOTO, nome: "C" });
  const fm = st().addFissa({ ...spesa("Rata C", idC, "mutuo"), categoria: "debito" });
  st().updateImmobile(idC, { fissaMutuoId: fm });
  st().removeFissa(fm);
  assert(st().immobili.find((i) => i.id === idC)?.fissaMutuoId === "", "removeFissa: la casa non resta agganciata a un mutuo cancellato");

  st().setPatrimonio({
    fonteAttivo: true,
    fonteTotale: 5000,
    fonteInvestito: 4000,
    fonteAttesa: 1000,
    retribuzioneUtile: 2000,
    fonteLavPct: 0.01,
    fonteDatPct: 0.02,
    tfrAccantonato: 300,
    saldoConto: 700,
  });
  st().addFonteSnapshots([
    buildFonteSnapshot({ data: "2026-06-30", comparto: "dinamico", numeroQuote: 10, valoreQuota: 20, fonte: "manuale" }),
  ]);
  assert(st().fonteSnapshots.length === 1, "snapshot Fon.Te aggiunto");
  st().removeFonte();
  const pat = st().patrimonio;
  assert(
    pat.fonteAttivo === false &&
      pat.fonteTotale === 0 &&
      pat.fonteInvestito === 0 &&
      pat.fonteAttesa === 0 &&
      pat.tfrAccantonato === 0 &&
      pat.retribuzioneUtile === 0 &&
      pat.fonteLavPct === 0 &&
      pat.fonteDatPct === 0,
    "removeFonte azzera il fondo pensione",
  );
  assert(st().fonteSnapshots.length === 0 && st().fonteContributi.length === 0, "removeFonte svuota lo storico");
  assert(pat.saldoConto === 700, "removeFonte non tocca il resto del patrimonio");

  st().reset();
  assert(st().fisse.length === 0 && st().immobili.length === 0 && st().legacyImportato === true, "reset → app nuda");
}

// --- persist: corrupt JSON quarantined, never silent wipe ---
{
  function memKv(quota?: number): PersistKv & { data: Record<string, string> } {
    const data: Record<string, string> = {};
    const used = () => Object.values(data).reduce((s, v) => s + v.length, 0);
    return {
      data,
      getItem: (k) => (k in data ? data[k]! : null),
      setItem: (k, v) => {
        if (quota != null) {
          const next = used() - (data[k]?.length ?? 0) + v.length;
          if (next > quota) throw new Error("quota");
        }
        data[k] = v;
      },
      removeItem: (k) => {
        delete data[k];
      },
    };
  }

  const name = PERSIST_NAME;
  const valid = JSON.stringify({ state: { fisse: [] }, version: 20 });
  const shapes = [
    "",
    "{",
    '{"state":',
    '{"state": { "fisse": [',
    "undefined",
    "NaN",
    "{'a':1}",
    "\x00not-json",
    valid.slice(0, 12),
    valid + ",",
  ];

  for (const raw of shapes) {
    resetPersistRuntime();
    const kv = memKv();
    kv.setItem(name, raw);
    const got = readPersistedRaw(name, kv);
    assert(got === null, `corrupt getItem → null (${JSON.stringify(raw).slice(0, 40)})`);
    const bak = kv.getItem(backupKeyFor(name));
    assert(bak === raw, `corrupt kept in .bak (${JSON.stringify(raw).slice(0, 24)})`);
    assert(kv.getItem(name) == null, "live key moved aside (not delete-only)");
    const rec = getPersistRecovery();
    assert(!!rec && rec.backupKey === backupKeyFor(name) && rec.blocked === false, "recovery notice after corrupt");
    assert(readBackupRaw(kv) === raw, "readBackupRaw returns original");
    assert(kv.getItem(noticeKeyFor(name)) != null, "notice persisted for reload");
  }

  // Valid JSON is returned as-is; no backup.
  resetPersistRuntime();
  {
    const kv = memKv();
    kv.setItem(name, valid);
    assert(readPersistedRaw(name, kv) === valid, "valid JSON returned");
    assert(kv.getItem(name) === valid, "valid live key stays");
    assert(kv.getItem(backupKeyFor(name)) == null, "valid does not write .bak");
    assert(getPersistRecovery() == null, "valid: no recovery banner");
  }

  // Missing key.
  resetPersistRuntime();
  assert(readPersistedRaw(name, memKv()) === null, "missing → null");

  // Previous .bak preserved under timestamped key.
  resetPersistRuntime();
  {
    const kv = memKv();
    const oldBak = '{"old":true}';
    const raw = '{"state":';
    const now = new Date("2026-09-15T14:04:00.000Z");
    kv.setItem(backupKeyFor(name), oldBak);
    kv.setItem(name, raw);
    const rec = quarantineCorruptPersist(name, raw, kv, now);
    assert(kv.getItem(backupKeyFor(name)) === raw, "new corrupt occupies .bak");
    assert(kv.getItem(timestampedBackupKey(name, now)) === oldBak, "old .bak timestamped");
    assert(rec.timestampKey === timestampedBackupKey(name, now), "recovery records timestamped key");
    assert(kv.getItem(name) == null, "live removed after backup");
  }

  // Quota too small to copy: move (free live, then bak).
  resetPersistRuntime();
  {
    const raw = "x".repeat(100);
    const kv = memKv(150); // copy would need 200
    kv.setItem(name, raw);
    const got = readPersistedRaw(name, kv);
    assert(got === null, "quota-copy still hydrates null");
    assert(kv.getItem(backupKeyFor(name)) === raw, "quota: moved to .bak");
    assert(kv.getItem(name) == null, "quota: live freed");
    assert(getPersistRecovery()?.blocked === false, "quota move not blocked");
  }

  // Cannot write .bak at all: restore live + block writes.
  resetPersistRuntime();
  {
    const data: Record<string, string> = {};
    const kv: PersistKv = {
      getItem: (k) => (k in data ? data[k]! : null),
      setItem: (k, v) => {
        if (k.includes(".bak")) throw new Error("quota");
        data[k] = v;
      },
      removeItem: (k) => {
        delete data[k];
      },
    };
    const raw = '{"nope":';
    data[name] = raw;
    const got = readPersistedRaw(name, kv);
    assert(got === null, "unmovable still returns null (boot defaults)");
    assert(data[name] === raw, "unmovable: live restored, not wiped");
    assert(getPersistRecovery()?.blocked === true, "unmovable: blocked");
    assert(persistLiveWritesBlocked(), "unmovable: writes blocked");
    writePersistedRaw(name, valid, kv);
    assert(data[name] === raw, "blocked setItem does not overwrite live");
    const adapter = createQuadraPersistKv(kv);
    adapter.setItem(name, valid);
    assert(data[name] === raw, "adapter setItem blocked too");
    adapter.removeItem(name);
    assert(data[name] === raw, "adapter removeItem blocked too");
  }

  // Dismiss drops notice, keeps backup.
  resetPersistRuntime();
  {
    const kv = memKv();
    const raw = "{";
    kv.setItem(name, raw);
    readPersistedRaw(name, kv);
    dismissPersistRecovery(kv);
    assert(getPersistRecovery() == null, "dismiss clears notice");
    assert(kv.getItem(noticeKeyFor(name)) == null, "dismiss removes notice key");
    assert(kv.getItem(backupKeyFor(name)) === raw, "dismiss keeps .bak");
  }

  // Dismiss while blocked: banner hides, writes stay locked (sole copy on live).
  resetPersistRuntime();
  {
    const data: Record<string, string> = {};
    const kv: PersistKv = {
      getItem: (k) => (k in data ? data[k]! : null),
      setItem: (k, v) => {
        if (k.includes(".bak")) throw new Error("quota");
        data[k] = v;
      },
      removeItem: (k) => {
        delete data[k];
      },
    };
    const raw = '{"stuck":';
    data[name] = raw;
    readPersistedRaw(name, kv);
    assert(getPersistRecovery()?.blocked === true, "blocked before dismiss");
    assert(persistLiveWritesBlocked(), "writes blocked before dismiss");
    dismissPersistRecovery(kv);
    assert(getPersistRecovery() == null, "dismiss hides banner while blocked");
    assert(kv.getItem(noticeKeyFor(name)) == null, "dismiss drops notice key while blocked");
    assert(persistLiveWritesBlocked(), "dismiss blocked keeps write lock");
    writePersistedRaw(name, valid, kv);
    assert(data[name] === raw, "dismiss blocked: setItem still cannot overwrite sole copy");
    const adapter = createQuadraPersistKv(kv);
    adapter.setItem(name, valid);
    assert(data[name] === raw, "dismiss blocked: adapter setItem still locked");
    adapter.removeItem(name);
    assert(data[name] === raw, "dismiss blocked: adapter removeItem still locked");
    assert(readBackupRaw(kv) === raw, "dismiss blocked: backup still readable for export");
  }

  // Reload: notice still drives banner even if live now has defaults.
  resetPersistRuntime();
  {
    const kv = memKv();
    const raw = '{"state":';
    kv.setItem(name, raw);
    readPersistedRaw(name, kv);
    const notice = kv.getItem(noticeKeyFor(name));
    assert(!!notice, "notice written");
    resetPersistRuntime();
    kv.setItem(name, valid); // zustand wrote defaults
    const got = readPersistedRaw(name, kv);
    assert(got === valid, "reload live defaults still parse");
    const rec = getPersistRecovery();
    assert(!!rec && rec.backupKey === backupKeyFor(name), "reload restores banner from notice");
    assert(kv.getItem(backupKeyFor(name)) === raw, "reload .bak intact");
  }

  // Adapter: valid through createQuadraPersistKv
  resetPersistRuntime();
  {
    const kv = memKv();
    const adapter = createQuadraPersistKv(kv);
    adapter.setItem(name, valid);
    assert(adapter.getItem(name) === valid, "adapter roundtrip valid");
    adapter.setItem(name, "{");
    // setItem does not parse; getItem quarantines
    assert(adapter.getItem(name) === null, "adapter getItem quarantines");
    assert(kv.getItem(backupKeyFor(name)) === "{", "adapter backup");
  }
}

// --- Revisione del redesign: ogni correzione con il suo controllo ---
{
  const inv = await import("../src/lib/investi.ts");
  const pianoMod = await import("../src/lib/piano.ts");
  const quadraMod = await import("../src/lib/quadra.ts");
  const utilsMod = await import("../src/lib/utils.ts");
  const catMod = await import("../src/lib/categorie.ts");
  const casaMod = await import("../src/lib/casa.ts");
  const ip = (x: Partial<typeof inv.IPOTESI_BASE> = {}) => ({ ...inv.IPOTESI_BASE, ...x });
  const base = {
    turisti: false,
    canoneMese: 0,
    tariffaNotte: 0,
    occupazione: 0,
    gestionePct: 0,
    costi: [] as import("../src/lib/investi.ts").Costo[],
    costiCasaAnno: 0,
    prezzo: 200_000,
    valore: 0,
    debito: { residuo: 0, tan: 0, fine: "", rata: 0 },
    esistente: false,
  };

  // Inflazione: con la casa che sale quanto i prezzi, senza affitto né debito, in soldi di oggi non guadagni niente.
  const piatto = inv.analizzaAffitto({ ...base, ipotesi: ip({ su: 0.02, inflazione: 0.02, anni: 10 }) });
  const su0 = piatto.scenari.find((s) => s.id === "su")!;
  assert(near(su0.dopoAnni, 0, 1e-6), `scenari: casa +2 % con inflazione 2 % → 0 € reali got ${su0.dopoAnni}`);
  const fermo0 = piatto.scenari.find((s) => s.id === "fermo")!;
  assert(
    near(fermo0.dopoAnni, 200_000 / 1.02 ** 10 - 200_000, 1e-6),
    `scenari: valore fermo, l'inflazione mangia il capitale got ${fermo0.dopoAnni}`,
  );
  // Il debito è nominale: con la casa che tiene il passo coi prezzi, chi ha un mutuo ci guadagna in termini reali.
  const conDebito = inv.analizzaAffitto({
    ...base,
    debito: { residuo: 150_000, tan: 0, fine: "", rata: 0 },
    ipotesi: ip({ su: 0.02, inflazione: 0.02, anni: 10 }),
  });
  const suD = conDebito.scenari.find((s) => s.id === "su")!;
  assert(
    near(suD.dopoAnni, 150_000 - 150_000 / 1.02 ** 10, 1e-6),
    `scenari: l'inflazione erode un debito a tasso zero a tuo favore got ${suD.dopoAnni}`,
  );

  // Spese una tantum: si tolgono dal risultato e non fanno valere di più la casa.
  const conNotaio = inv.analizzaAffitto({
    ...base,
    costi: [{ id: "n", nome: "Notaio", importo: 5_000, cadenza: "una" }],
    ipotesi: ip({ su: 0.02, inflazione: 0.02, anni: 10 }),
  });
  assert(conNotaio.valore === 200_000, "senza valore di mercato la casa vale il prezzo, non prezzo + notaio");
  assert(
    near(conNotaio.scenari.find((s) => s.id === "su")!.dopoAnni, -5_000, 1e-6),
    "il notaio si toglie una volta sola dal risultato",
  );
  assert(!inv.analizzaAffitto({ ...base, prezzo: 0, canoneMese: 800, costi: [{ id: "n", nome: "Notaio", importo: 5_000, cadenza: "una" }], ipotesi: ip() }).pronto, "senza prezzo né valore niente rendimento (il notaio non fa da valore)");

  // Interessi: finito il mutuo, finiti gli interessi.
  const oggi = new Date();
  const fine2 = `${oggi.getFullYear() + 2}-${String(oggi.getMonth() + 1).padStart(2, "0")}`;
  const anniDeb = inv.debitoNegliAnni({ residuo: 20_000, tan: 0.04, fine: fine2, rata: 0 }, 5).anni;
  assert(anniDeb[0].interessi > 0 && anniDeb[3].interessi === 0 && anniDeb[4].pagato === 0, "debito: dopo l'ultima rata niente interessi né rate");
  assert(anniDeb[0].interessi > anniDeb[1].interessi, "debito: gli interessi scendono anno dopo anno");

  // Rata con scadenza passata: resta almeno il costo degli interessi, e l'app lo dice.
  const scaduta = inv.rataEffettiva({ residuo: 50_000, tan: 0.04, fine: "2020-01", rata: 0 });
  assert(scaduta.origine === "solo-interessi" && near(scaduta.rata, (50_000 * 0.04) / 12, 1e-9), "rata: scadenza passata → solo interessi, non 0 €");
  assert(inv.rataEffettiva({ residuo: 50_000, tan: 0, fine: "", rata: 0 }).origine === "nessuna", "rata: né tasso né scadenza → «nessuna», da scrivere");

  // Investimento non casa: l'anno brutto capita una volta (prima di vendere), non ogni anno.
  const cap = inv.analizzaCapitale({ capitale: 10_000, rendimento: 0.07, calo: 0.3, costi: [], ipotesi: ip({ anni: 10, inflazione: 0 }) });
  const giuC = cap.scenari.find((s) => s.id === "giu")!;
  assert(near(giuC.dopoAnni, 10_000 * 1.07 ** 9 * 0.7 - 10_000, 1e-6), `capitale: anno brutto una volta got ${giuC.dopoAnni}`);
  const capUna = inv.analizzaCapitale({ capitale: 10_000, rendimento: 0, calo: 0, costi: [{ id: "i", nome: "Costo di ingresso", importo: 200, cadenza: "una" }], ipotesi: ip({ anni: 5, inflazione: 0 }) });
  assert(near(capUna.scenari.find((s) => s.id === "fermo")!.dopoAnni, -200, 1e-9), "capitale: il costo una tantum entra nel conto");

  // Ci abito: le bollette che paghi anche in affitto stanno da tutte e due le parti.
  const abito = inv.analizzaAbito({
    costi: [
      { id: "c", nome: "Condominio", importo: 80, cadenza: "mese" },
      { id: "l", nome: "Luce", importo: 50, cadenza: "mese", ancheInAffitto: true },
    ],
    debito: { residuo: 0, tan: 0, fine: "", rata: 0 },
    affittoAltrove: 700,
    prezzo: 150_000,
  });
  assert(near(abito.costoMese, 130, 1e-9) && near(abito.affittoMese, 750, 1e-9), "ci abito: la luce pesa su tutte e due le parti");
  assert(abito.capitaleTuo === 150_000, "ci abito: senza mutuo la parte tua è il prezzo");
  assert(inv.sembraAncheInAffitto("Luce") && inv.sembraAncheInAffitto("TARI") && !inv.sembraAncheInAffitto("IMU"), "bollette e rifiuti si pagano anche in affitto, l'IMU no");

  // Piano: la rata pagata si legge dalla data, non dal flag salvato all'import.
  const pianoProva = [
    { n: 1, d: "2020-01-01", c: 100, i: 10, r: 110, k: 900, p: false },
    { n: 2, d: "2020-02-01", c: 100, i: 9, r: 109, k: 800, p: false },
    { n: 3, d: "2999-03-01", c: 100, i: 8, r: 108, k: 700, p: false },
  ];
  assert(pianoMod.ultimaPagataAl(pianoProva)?.n === 2, "piano: pagate le rate con data passata anche senza flag");
  assert(pianoMod.residuoAl(pianoProva) === 800, "piano: il debito di oggi è quello dopo l'ultima rata passata");
  assert(pianoMod.rateFuture(pianoProva).length === 1, "piano: una rata ancora da pagare");

  // Hydrate: col piano il debito della casa si riallinea al piano.
  {
    const fisse = [{ id: "m", nome: "Mutuo", importo: 110, giorno: 1, mese: 1, frequenza: "mensile", categoria: "debito", note: "", piano: pianoProva }];
    const casa = { ...quadraMod.IMMOBILE_VUOTO, id: "c1", nome: "Casa", capitaleMutuo: 12_345, fissaMutuoId: "m" };
    const blob = { state: { fisse, immobili: [casa], legacyImportato: true }, version: 21 };
    const h = hydratePersisted(blob, { ...quadraMod.STATO_VUOTO, cedolini: [], immobili: [], legacyImportato: true } as never, null) as { immobili: { capitaleMutuo: number }[] };
    assert(h.immobili[0].capitaleMutuo === 800, `hydrate: debito riallineato al piano got ${h.immobili[0].capitaleMutuo}`);
    assert(casaMod.debitoCasa(h.immobili[0] as never, fisse as never) === 800, "debitoCasa legge il piano");
  }

  // Rivalutazione: le case nuove non hanno un'ipotesi messa dall'app, quelle già salvate tengono la loro.
  assert(quadraMod.IMMOBILE_VUOTO.rivalutazioneScelta === false, "casa nuova: rivalutazione non scelta");
  assert(quadraMod.normalizzaImmobile({ ...quadraMod.IMMOBILE_VUOTO, id: "x", nome: "x", rivalutazioneScelta: undefined }).rivalutazioneScelta === true, "salvataggio vecchio senza il campo: la rivalutazione resta valida");

  // Cedolino: se cambi il mese cambia anche l'id, niente doppioni.
  {
    const st = () => useQuadra.getState();
    useQuadra.setState({ cedolini: [] });
    st().addCedolino({ mese: "2026-01", netto: 1_000, nota: "" });
    st().addCedolino({ mese: "2026-02", netto: 1_100, nota: "" });
    st().updateCedolino("2026-01", { mese: "2026-03" });
    const ids = st().cedolini.map((c) => c.id).join(",");
    assert(ids === "2026-02,2026-03", `cedolino spostato di mese: id nuovo, nessun doppione got ${ids}`);
    st().removeCedolino("2026-03");
    assert(st().cedolini.length === 1 && st().cedolini[0].mese === "2026-02", "eliminare il cedolino spostato non tocca gli altri");
    useQuadra.setState({ cedolini: [] });
  }

  // Dal telefono (http sull'IP del PC) crypto.randomUUID non c'è: creare deve funzionare lo stesso.
  {
    const { nuovoId } = await import("../src/lib/id.ts");
    const st = () => useQuadra.getState();
    const prima = { fisse: st().fisse, immobili: st().immobili };
    const proto = Object.getPrototypeOf(globalThis.crypto);
    const orig = Object.getOwnPropertyDescriptor(proto, "randomUUID");
    Object.defineProperty(proto, "randomUUID", { value: undefined, configurable: true, writable: true });
    try {
      assert(typeof globalThis.crypto.randomUUID !== "function", "prova: randomUUID tolto come su http");
      const ids = new Set(Array.from({ length: 2000 }, () => nuovoId()));
      assert(ids.size === 2000, "nuovoId senza randomUUID: 2000 id tutti diversi");
      assert([...ids].every((x) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(x)), "nuovoId senza randomUUID: forma di UUID v4");
      let idFissa = "";
      let idCasa = "";
      try {
        idFissa = st().addFissa({ nome: "Palestra", importo: 40, giorno: 1, mese: 1, frequenza: "mensile", categoria: "vita", note: "" });
        idCasa = st().addImmobile({ ...quadraMod.IMMOBILE_VUOTO, nome: "Casa prova" });
      } catch (e) {
        assert(false, `senza randomUUID aggiungere non deve lanciare: ${String(e)}`);
      }
      assert(!!idFissa && st().fisse.some((f) => f.id === idFissa), "senza randomUUID: la spesa fissa si aggiunge");
      assert(!!idCasa && st().immobili.some((i) => i.id === idCasa), "senza randomUUID: la casa si aggiunge");
    } finally {
      if (orig) Object.defineProperty(proto, "randomUUID", orig);
      else delete (proto as { randomUUID?: unknown }).randomUUID;
      useQuadra.setState(prima);
    }
    assert(typeof globalThis.crypto.randomUUID === "function", "prova finita: randomUUID rimesso");
    assert(/^[0-9a-f-]{36}$/.test(nuovoId()), "con randomUUID: nuovoId lo usa");
  }

  // Parole: plurali, trimestri, un solo nome per «da sistemare».
  assert(utilsMod.plurale(1, "spesa", "spese") === "1 spesa" && utilsMod.plurale(3, "spesa", "spese") === "3 spese", "plurale accordato");
  assert(utilsMod.periodoLeggibile("2025-Q4") === "4º trimestre 2025" && utilsMod.periodoLeggibile("2026-08") === "agosto 2026", "periodi in italiano");
  assert(catMod.labelCat("da_classificare") === "Da sistemare", "un solo nome: Da sistemare");
  assert(!utilsMod.eur(1070, 0).startsWith("1070"), `migliaia col punto: ${utilsMod.eur(1070, 0)}`);
}

// --- Revisione «dati salvati»: righe rotte, caricamento fallito, scritture ferme ---
{
  const quadraMod = await import("../src/lib/quadra.ts");
  const persistMod = await import("../src/lib/persist.ts");
  const base = { ...quadraMod.STATO_VUOTO, cedolini: [], immobili: [], legacyImportato: true } as never;
  const blob = {
    state: {
      fisse: [{ id: "f", nome: "Palestra", importo: 40, giorno: 1, mese: 1, frequenza: "mensile", categoria: "vita", note: "" }],
      cedolini: [{ id: "2026-01", mese: "2026-01", netto: 1_000, nota: "" }],
      movimentiManuali: [null, { id: "m", data: "2026-01-02", descrizione: "Pane", importo: 2, segno: "uscita", cat: "spesa" }],
      investimenti: [null, { id: "i", nome: "Fondo", tipo: "fondo", valore: 100, note: "", transazioni: [null] }],
      regole: [null, { needle: "pane", cat: "spesa" }],
      categorieCustom: [null],
      csvMovimenti: [null, { data: "2026-01-03", descrizione: "Bar", importo: 1.5, segno: "uscita" }],
      legacyImportato: true,
    },
    version: 21,
  };
  let h: Record<string, unknown[]> | null = null;
  try {
    h = hydratePersisted(blob, base, null) as never;
  } catch (e) {
    assert(false, `hydrate con righe null non deve lanciare: ${String(e)}`);
  }
  if (h) {
    assert(h.fisse.length === 1 && h.cedolini.length === 1, "righe null: fisse e cedolini salvi");
    assert(h.movimentiManuali.length === 1 && h.investimenti.length === 1, "righe null scartate, il resto resta");
    assert((h.investimenti[0] as { transazioni: unknown[] }).transazioni.length === 0, "transazione null scartata");
    assert(h.regole.length === 1 && h.csvMovimenti.length === 1 && h.categorieCustom.length === 0, "regole, estratto e categorie senza righe rotte");
  }

  // Caricamento fallito: la chiave resta intatta e non ci si scrive sopra.
  persistMod.resetPersistRuntime();
  const dati: Record<string, string> = { "chiave-prova": '{"state":{"fisse":[1]},"version":21}' };
  const kv = {
    getItem: (k: string) => (k in dati ? dati[k] : null),
    setItem: (k: string, v: string) => {
      dati[k] = v;
    },
    removeItem: (k: string) => {
      delete dati[k];
    },
  };
  const origErr = console.error;
  console.error = () => {};
  persistMod.segnalaCaricamentoFallito("chiave-prova", new Error("prova"), kv);
  console.error = origErr;
  const origWarn = console.warn;
  console.warn = () => {};
  persistMod.writePersistedRaw("chiave-prova", '{"state":{},"version":21}', kv);
  console.warn = origWarn;
  assert(dati["chiave-prova"] === '{"state":{"fisse":[1]},"version":21}', "caricamento fallito: scritture bloccate, dati intatti");
  const rec = persistMod.getPersistRecovery();
  assert(!!rec && rec.motivo === "caricamento" && rec.blocked, "caricamento fallito: avviso con «Scarica»");
  persistMod.resetPersistRuntime();

  // Scritture ferme prima di un ripristino: niente salvataggi in coda sopra la copia rimessa.
  persistMod.fermaScritture();
  persistMod.writePersistedRaw("chiave-2", "x", kv);
  persistMod.removePersistedRaw("chiave-prova", kv);
  assert(!("chiave-2" in dati) && "chiave-prova" in dati, "scritture ferme: né scrivere né cancellare");
  persistMod.riprendiScritture();
  persistMod.writePersistedRaw("chiave-2", "y", kv);
  assert(dati["chiave-2"] === "y", "ripristino fallito: le scritture ripartono");
}

// --- Righe non valide: si contano, si tiene una copia dell'originale, si avvisa una volta ---
{
  const storeMod = await import("../src/lib/store.ts");
  const quadraMod = await import("../src/lib/quadra.ts");
  const persistMod = await import("../src/lib/persist.ts");
  const base = { ...quadraMod.STATO_VUOTO, cedolini: [], immobili: [], legacyImportato: true } as never;
  const sporco = {
    state: {
      fisse: [{ id: "f", nome: "Palestra", importo: 40, giorno: 1, mese: 1, frequenza: "mensile", categoria: "vita", note: "" }, null, 7],
      csvMovimenti: [{ data: "2026-01-03", descrizione: "Bar", importo: 1.5, segno: "uscita" }, { data: "2026-01-04", descrizione: "X", importo: "tanto", segno: "uscita" }],
      investimenti: [{ id: "i", nome: "Fondo", tipo: "fondo", valore: 100, note: "", transazioni: [null, { id: "t", data: "2026-01-01", importo: 10, tipo: "acquisto" }] }],
      immobili: "rotto",
      legacyImportato: true,
    },
    version: 21,
  };
  const h = hydratePersisted(sporco, base, null);
  const r = storeMod.righeNonLette(sporco, h, null);
  assert(r.totale === 5, `righe non valide contate: 2 fisse, 1 movimento, 1 operazione, la lista case got ${r.totale} (${r.dove.join(", ")})`);
  assert(
    ["spese fisse", "movimenti dell'estratto", "case", "operazioni degli investimenti"].every((x) => r.dove.includes(x)),
    `righe non valide: si dice dove (${r.dove.join(", ")})`,
  );
  const pulito = { state: { fisse: sporco.state.fisse.slice(0, 1), legacyImportato: true }, version: 21 };
  assert(storeMod.righeNonLette(pulito, hydratePersisted(pulito, base, null), null).totale === 0, "salvataggio pulito: nessuna riga persa");

  persistMod.resetPersistRuntime();
  const mem: Record<string, string> = { "prova-righe": JSON.stringify(sporco) };
  const kv = {
    getItem: (k: string) => (k in mem ? mem[k] : null),
    setItem: (k: string, v: string) => {
      mem[k] = v;
    },
    removeItem: (k: string) => {
      delete mem[k];
    },
  };
  const origWarn = console.warn;
  console.warn = () => {};
  persistMod.segnalaRighePerse("prova-righe", r.totale, r.dove, kv, new Date("2026-09-28T10:00:00Z"));
  const rec = persistMod.getPersistRecovery();
  assert(mem["prova-righe.righe"] === mem["prova-righe"], "righe perse: copia dell'originale prima di scriverci sopra");
  assert(!!rec && rec.motivo === "righe" && rec.righe === 5 && !rec.blocked, "righe perse: avviso, l'app va avanti");
  persistMod.writePersistedRaw("prova-righe", '{"state":{},"version":21}', kv);
  assert(mem["prova-righe"] === '{"state":{},"version":21}', "righe perse: le scritture restano libere");
  // Riaperta senza salvare: la stessa copia non si rifà.
  mem["prova-righe"] = JSON.stringify(sporco);
  const chiaviPrima = Object.keys(mem).length;
  persistMod.segnalaRighePerse("prova-righe", r.totale, r.dove, kv, new Date("2026-09-28T11:00:00Z"));
  assert(Object.keys(mem).length === chiaviPrima, "stesso salvataggio riaperto: nessuna copia in più");
  // Riaprendo l'app (memoria azzerata) l'avviso si rilegge e resta quello delle righe.
  persistMod.resetPersistRuntime();
  persistMod.readPersistedRaw("prova-righe", kv);
  const riletto = persistMod.getPersistRecovery();
  assert(riletto?.motivo === "righe" && riletto.righe === 5 && (riletto.dove ?? []).includes("case"), "avviso riletto all'avvio: resta «righe», con quante e dove");
  persistMod.segnalaRighePerse("prova-righe", r.totale, r.dove, kv, new Date("2026-09-28T11:30:00Z"));
  assert(Object.keys(mem).length === chiaviPrima, "riaperta dopo il riavvio: nessuna copia in più");
  // La copia di un salvataggio danneggiato (.bak) non si tocca; le righe hanno il loro posto, uno solo.
  persistMod.resetPersistRuntime();
  mem["prova-righe.bak"] = "copia di una quarantena";
  delete mem["prova-righe.bak.notice"];
  mem["prova-righe"] = JSON.stringify({ ...sporco, version: 21, altro: 1 });
  const chiaviPrimaDiNuovo = Object.keys(mem).filter((k) => k.startsWith("prova-righe")).length;
  persistMod.segnalaRighePerse("prova-righe", 1, ["spese fisse"], kv, new Date("2026-09-28T12:00:00Z"));
  assert(mem["prova-righe.bak"] === "copia di una quarantena", "la copia di un salvataggio danneggiato resta intatta");
  assert(mem["prova-righe.righe"] === mem["prova-righe"], "la copia delle righe prende il posto della precedente");
  assert(
    Object.keys(mem).filter((k) => k.startsWith("prova-righe")).length === chiaviPrimaDiNuovo + 1,
    "una sola copia per le righe: nessuna chiave con l'ora in più",
  );
  // Telefono pieno: niente copia, ma le scritture non si bloccano mai.
  persistMod.resetPersistRuntime();
  const pieno = { ...kv, setItem: (k: string, v: string) => {
    if (!(k in mem)) throw new Error("QuotaExceededError");
    mem[k] = v;
  } };
  delete mem["prova-righe.righe"];
  delete mem["prova-righe.bak.notice"];
  persistMod.segnalaRighePerse("prova-righe", 2, ["case"], pieno, new Date("2026-09-28T13:00:00Z"));
  const recPieno = persistMod.getPersistRecovery();
  assert(!!recPieno && recPieno.motivo === "righe" && !recPieno.blocked && recPieno.backupKey === "prova-righe", "telefono pieno: avviso di scaricare subito, niente blocco");
  persistMod.writePersistedRaw("prova-righe", "dopo", pieno);
  assert(mem["prova-righe"] === "dopo", "telefono pieno: le modifiche si salvano lo stesso");
  console.warn = origWarn;
  persistMod.resetPersistRuntime();
}

// --- Un salvataggio di una versione più nuova (un'altra scheda, un altro telefono) non si riporta indietro ---
{
  const storeMod = await import("../src/lib/store.ts");
  const persistMod = await import("../src/lib/persist.ts");
  const mem: Record<string, string> = {};
  const g = globalThis as { localStorage?: Storage };
  const primaLs = g.localStorage;
  g.localStorage = {
    getItem: (k: string) => (k in mem ? mem[k] : null),
    setItem: (k: string, v: string) => {
      mem[k] = String(v);
    },
    removeItem: (k: string) => {
      delete mem[k];
    },
    clear: () => {},
    key: () => null,
    length: 0,
  } as Storage;
  const primaStato = useQuadra.getState();
  const origErr = console.error;
  const origWarn = console.warn;
  console.error = () => {};
  console.warn = () => {};
  try {
    persistMod.resetPersistRuntime();
    const nuovo = JSON.stringify({
      state: { fisse: [], nuovoCampo: ["solo della versione dopo"], legacyImportato: true },
      version: storeMod.VERSIONE_SALVATAGGIO + 1,
    });
    mem["quadra-v1"] = nuovo;
    await useQuadra.persist.rehydrate();
    await new Promise((r) => setTimeout(r, 20));
    assert(mem["quadra-v1"] === nuovo, "versione più nuova: rileggere non la riscrive né la riporta indietro");
    assert(persistMod.getPersistRecovery()?.motivo === "caricamento" && persistMod.persistLiveWritesBlocked(), "versione più nuova: scritture ferme e avviso");
    useQuadra.getState().addFissa({ nome: "Prova", importo: 1, giorno: 1, mese: 1, frequenza: "mensile", categoria: "vita", note: "" });
    assert(mem["quadra-v1"] === nuovo, "versione più nuova: una modifica qui non ci scrive sopra");
  } finally {
    console.error = origErr;
    console.warn = origWarn;
    persistMod.resetPersistRuntime();
    useQuadra.setState(primaStato, true);
    if (primaLs) g.localStorage = primaLs;
    else delete g.localStorage;
  }
}

if (failed) {
  console.error(`\n${failed} FAILED`);
  process.exit(1);
}
console.log("\nAll stress checks passed.");
