import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createQuadraPersistKv } from "./persist";
import { CHIAVE_ATTIVA, CHIAVE_TELEFONO } from "./profilo";
import { segnalaCaricamentoFallito, segnalaRighePerse } from "./persist";
import { PROFILO_PRIVATO, type ProfiloPrivato } from "./profilo-privato";
import type { Movimento, MovimentoManuale } from "./banca";
import { merchantKey } from "./banca";
import type { Categoria, Regola } from "./categorie";
import { allocCatId, builtinCatIds } from "./categorie";
import { healPianoFissa, hasPiano, normalizzaPiano, residuoAl } from "./piano";
import {
  applyFonteSnapshotToPatrimonio,
  clearFontePosizioneFromPatrimonio,
  hydrateFonteContributi,
  hydrateFonteSnapshots,
  latestFonteSnapshot,
  partizionaFonteContributi,
  type FonteContributo,
  type FonteSnapshot,
} from "./fonte";
import {
  CATEGORIA_FISSA_DEFAULT,
  CATEGORIE_FISSE_BUILTIN,
  immobileDaPatrimonio,
  mergeMissingCedolini,
  normalizzaFissa,
  normalizzaImmobile,
  normalizzaImmobili,
  normalizzaInvestimento,
  normalizzaPatrimonio,
  PATRIMONIO_VUOTO,
  redditoMedio,
  STATO_VUOTO,
  slugCategoriaFissa,
  type CategoriaFissa,
  type Cedolino,
  type Fissa,
  type Immobile,
  type Investimento,
  type InvTransazione,
  type Patrimonio,
  type QuadraState,
} from "./quadra";
import { nuovoId } from "./id";

export type CsvMeta = {
  dal: string;
  al: string;
  n: number;
  when: string;
};

type Actions = {
  setReddito: (mensile: number) => void;
  addFissa: (f: Omit<Fissa, "id">) => string;
  updateFissa: (id: string, patch: Partial<Fissa>) => void;
  removeFissa: (id: string) => void;
  setPatrimonio: (patch: Partial<Patrimonio>) => void;
  addRegola: (needle: string, cat: string) => void;
  addCategoria: (label: string) => string;
  addCategoriaFissa: (label: string) => string;
  removeCategoriaFissa: (id: string) => void;
  renameCategoria: (id: string, label: string) => void;
  removeCategoria: (id: string) => void;
  addInvestimento: (i: Omit<Investimento, "id">) => void;
  updateInvestimento: (id: string, patch: Partial<Investimento>) => void;
  removeInvestimento: (id: string) => void;
  addInvTransazione: (invId: string, txn: Omit<InvTransazione, "id">) => void;
  updateInvTransazione: (
    invId: string,
    txnId: string,
    patch: Partial<InvTransazione>,
  ) => void;
  removeInvTransazione: (invId: string, txnId: string) => void;
  addMovimento: (m: Omit<MovimentoManuale, "id">) => void;
  updateMovimento: (id: string, patch: Partial<MovimentoManuale>) => void;
  removeMovimento: (id: string) => void;
  setManualeArchiviato: (id: string, archiviato: boolean) => void;
  setCsvArchiviato: (key: string, archiviato: boolean) => void;
  setCsv: (movimenti: Movimento[], meta: CsvMeta) => void;
  clearCsv: () => void;
  setOverride: (key: string, cat: string, needle?: string) => void;
  addCedolino: (c: Omit<Cedolino, "id">) => void;
  updateCedolino: (id: string, patch: Partial<Cedolino>) => void;
  removeCedolino: (id: string) => void;
  addImmobile: (i: Omit<Immobile, "id">) => string;
  updateImmobile: (id: string, patch: Partial<Immobile>) => void;
  /** conSpese: toglie anche le spese fisse legate a quella casa (altrimenti restano, scollegate). */
  removeImmobile: (id: string, opts?: { conSpese?: boolean }) => void;
  /** Toglie il fondo pensione: saldo, busta paga e storico. */
  removeFonte: () => void;
  selectImmobile: (id: string) => void;
  toggleSaldo: () => void;
  toggleDettaglioDebito: () => void;
  reset: () => void;
  applyFonteSnapshot: (snap: FonteSnapshot) => void;
  addFonteSnapshots: (snaps: FonteSnapshot[]) => void;
  addFonteContributi: (rows: FonteContributo[], includeDups?: boolean) => void;
  removeFonteSnapshot: (id: string) => void;
  removeFonteContributo: (id: string) => void;
};

type Extra = {
  regole: Regola[];
  categorieCustom: Categoria[];
  categorieNascoste: string[];
  /** Categorie delle fisse aggiunte dall utente (le quattro di serie non stanno qui). */
  fisseCategorie: CategoriaFissa[];
  investimenti: Investimento[];
  movimentiManuali: MovimentoManuale[];
  /** dupKey (date|desc|importo|segno) delle righe CSV/seed archiviate. */
  movimentiArchiviati: string[];
  csvMovimenti: Movimento[];
  csvMeta: CsvMeta | null;
  overrideCat: Record<string, string>;
  cedolini: Cedolino[];
  immobili: Immobile[];
  /** Id casa selezionata in Casa; clamp on hydrate/delete. */
  immobileSelezionatoId: string;
  nascostoSaldo: boolean;
  mostraDettaglioDebito: boolean;
  fonteSnapshots: FonteSnapshot[];
  fonteContributi: FonteContributo[];
  /**
   * I dati che prima stavano nel codice (piano del mutuo, movimenti, prezzo della
   * zona) sono già stati portati in questo salvataggio. Un salvataggio nuovo nasce
   * già a posto; uno vecchio lo diventa al primo avvio col profilo privato.
   */
  legacyImportato: boolean;
};

const EXTRA_DEFAULT: Extra = {
  regole: [],
  categorieCustom: [],
  categorieNascoste: [],
  fisseCategorie: [],
  investimenti: [],
  movimentiManuali: [],
  movimentiArchiviati: [],
  csvMovimenti: [],
  csvMeta: null,
  overrideCat: {},
  cedolini: [],
  immobili: [],
  immobileSelezionatoId: "",
  nascostoSaldo: false,
  mostraDettaglioDebito: false,
  fonteSnapshots: [],
  fonteContributi: [],
  legacyImportato: true,
};

function applyReddito(cedolini: Cedolino[]) {
  const mensile = Math.round(redditoMedio(cedolini));
  return { redditoMensile: mensile, redditoAnnuo: mensile * 12 };
}


function asArray<T>(v: unknown, fallback: T[]): T[] {
  return Array.isArray(v) ? (v as T[]) : fallback;
}

/** Solo le righe che sono oggetti: un null in un elenco non deve far fallire tutto il caricamento. */
function soloOggetti<T>(v: unknown, fallback: T[] = []): T[] {
  return asArray<unknown>(v, fallback).filter(
    (x): x is T => !!x && typeof x === "object" && !Array.isArray(x),
  );
}

function soloStringhe(v: unknown): string[] {
  return asArray<unknown>(v, []).filter((x): x is string => typeof x === "string" && x.length > 0);
}

function asRecord(v: unknown): Record<string, string> {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, string>)
    : {};
}

function asBool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

/** Unwrap `{ state, version }` if storage blob leaked into merge/migrate. */
function unwrapPersisted(persisted: unknown): Partial<QuadraState & Extra> {
  if (persisted === null || typeof persisted !== "object" || Array.isArray(persisted)) {
    return {};
  }
  const obj = persisted as Record<string, unknown>;
  const nested = obj.state;
  if (
    nested !== null &&
    typeof nested === "object" &&
    !Array.isArray(nested) &&
    !("fisse" in obj) &&
    !("immobili" in obj) &&
    !("patrimonio" in obj) &&
    ("version" in obj || "immobili" in (nested as object) || "fisse" in (nested as object))
  ) {
    return nested as Partial<QuadraState & Extra>;
  }
  return obj as Partial<QuadraState & Extra>;
}

/**
 * Immobili from persist: trust arrays (incl. []). Never revive a house when the user
 * cleared the list. Legacy blobs without `immobili` key get the one house that lived
 * in the patrimonio, once. If a storage `{state,version}` blob leaks in, unwrap first
 * (otherwise `immobili` is undefined and the house would overwrite deletes).
 */
export function resolveImmobiliFromPersist(
  p: Partial<QuadraState & Extra>,
  patrimonio: Patrimonio,
  currentImmobili: Immobile[] | undefined,
  hadPersistedBlob: boolean,
): Immobile[] {
  if (Array.isArray(p.immobili)) return p.immobili;
  if (hadPersistedBlob && "immobili" in p) return []; // corrupt present → empty, do not reseed
  if (hadPersistedBlob && !("immobili" in p)) {
    // Pre-multi-casa persist: la casa stava nel patrimonio. Solo se c'era davvero.
    const c = immobileDaPatrimonio(patrimonio, p.fisse);
    return c.mq > 0 || c.prezzoAcquisto > 0 || c.valoreCasa > 0 || c.capitaleMutuo > 0 ? [c] : [];
  }
  // First run (no persist): keep in-memory default.
  return currentImmobili ?? [];
}

/** TAN scritto nella nota della rata («TAN 2,40% …»): dato dell'utente, non del codice. */
export function tanDaNota(nota: string | undefined): number {
  const m = (nota ?? "").match(/TAN\s*(\d+(?:[.,]\d+)?)\s*%/i);
  if (!m) return 0;
  const n = Number(m[1].replace(",", "."));
  return Number.isFinite(n) && n > 0 && n < 30 ? n / 100 : 0;
}

export type DatiImportabili = {
  fisse: Fissa[];
  immobili: Immobile[];
  csvMovimenti: Movimento[];
  regole: Regola[];
};

/**
 * Porta nel salvataggio quello che prima stava nel codice. Non sovrascrive mai
 * un dato dell'utente: aggiunge solo dove manca. Idempotente.
 */
/**
 * Chiave di casa del profilo → id della casa nel salvataggio. Di regola coincidono. Un
 * salvataggio di prima delle case multiple ha una casa sola con un id nuovo: se anche nel
 * profilo resta una casa sola senza corrispondenza, è quella. Con più case non si indovina.
 */
function caseDelProfilo(d: DatiImportabili, prof: ProfiloPrivato): Map<string, string> {
  const ids = new Set(d.immobili.map((i) => i.id));
  const chiavi = [...new Set([...Object.keys(prof.immobili ?? {}), ...Object.keys(prof.fisseCasa ?? {})])];
  const mappa = new Map<string, string>();
  for (const k of chiavi) if (ids.has(k)) mappa.set(k, k);
  const libere = chiavi.filter((k) => !mappa.has(k));
  if (libere.length === 1 && d.immobili.length === 1 && mappa.size === 0) mappa.set(libere[0], d.immobili[0].id);
  return mappa;
}

export function importaProfiloPrivato(d: DatiImportabili, prof: ProfiloPrivato): DatiImportabili {
  const casaDi = caseDelProfilo(d, prof);
  const casaDiFissa = new Map<string, { casa: string; voce: Fissa["voce"] }>();
  for (const [chiave, mappa] of Object.entries(prof.fisseCasa ?? {})) {
    const casa = casaDi.get(chiave);
    if (!casa) continue;
    for (const [fid, voce] of Object.entries(mappa)) casaDiFissa.set(fid, { casa, voce });
  }
  const fisse = d.fisse.map((f) => {
    let out = f;
    const piano = normalizzaPiano(prof.piani?.[f.id]);
    if (piano && !hasPiano(out)) out = healPianoFissa({ ...out, piano });
    const link = casaDiFissa.get(f.id);
    if (link && !out.immobileId) out = { ...out, immobileId: link.casa, voce: link.voce };
    return out;
  });
  const immobili = d.immobili.map((i) => {
    const chiave = [...casaDi].find(([, id]) => id === i.id)?.[0];
    const extra = chiave ? prof.immobili?.[chiave] : undefined;
    if (!extra) return i;
    return {
      ...i,
      eurMqZona: i.eurMqZona && i.eurMqZona > 0 ? i.eurMqZona : Math.max(0, extra.eurMqZona ?? 0),
      mutuoTan: i.mutuoTan && i.mutuoTan > 0 ? i.mutuoTan : Math.max(0, extra.mutuoTan ?? 0),
    };
  });
  const csvMovimenti =
    d.csvMovimenti.length === 0 && Array.isArray(prof.movimenti) ? prof.movimenti : d.csvMovimenti;
  const giaRegole = new Set(d.regole.map((r) => r.needle));
  const regole = [
    ...d.regole,
    ...(prof.regole ?? []).filter(
      (r) => r && typeof r.needle === "string" && !giaRegole.has(r.needle),
    ),
  ];
  return { fisse, immobili, csvMovimenti, regole };
}

/** Il mutuo di una casa è una spesa di quella casa; col piano si sa anche quando finisce. */
function legaMutui(d: DatiImportabili): DatiImportabili {
  return {
    ...d,
    immobili: d.immobili.map((i) => {
      if (i.mutuoFine || !i.fissaMutuoId) return i;
      const piano = d.fisse.find((f) => f.id === i.fissaMutuoId)?.piano;
      const ultima = piano?.[piano.length - 1]?.d;
      return ultima ? { ...i, mutuoFine: ultima.slice(0, 7) } : i;
    }),
    fisse: d.fisse.map((f) => {
      const casa = d.immobili.find((i) => i.fissaMutuoId === f.id);
      return casa && !f.immobileId ? { ...f, immobileId: casa.id, voce: "mutuo" as const } : f;
    }),
  };
}

/** Fon.Te: un salvataggio vecchio senza il flag lo mostra se c'era qualcosa dentro. */
function fonteAttivoDa(p: Patrimonio, snaps: unknown[], contributi: unknown[]): boolean {
  if (typeof p.fonteAttivo === "boolean") return p.fonteAttivo;
  return (
    p.fonteTotale > 0 ||
    p.fonteInvestito > 0 ||
    p.fonteAttesa > 0 ||
    p.retribuzioneUtile > 0 ||
    p.tfrAccantonato > 0 ||
    snaps.length > 0 ||
    contributi.length > 0
  );
}

/** Defensive rehydrate: corrupt / partial / wrong-typed persist must not wipe actions or crash. */
export function hydratePersisted<T extends QuadraState & Extra>(
  persisted: unknown,
  current: T,
  profilo: ProfiloPrivato | null = PROFILO_PRIVATO,
): T {
  const hadPersistedBlob =
    persisted !== null && typeof persisted === "object" && !Array.isArray(persisted);
  const p = unwrapPersisted(persisted);
  const fisseRaw = asArray<Fissa>(p.fisse, current.fisse)
    .filter((f): f is Fissa => !!f && typeof f === "object")
    .map((f) => healPianoFissa(normalizzaFissa({ ...f, piano: normalizzaPiano(f.piano) })));
  const cedolini = mergeMissingCedolini(
    Array.isArray(p.cedolini) ? p.cedolini : undefined,
  );
  const reddito = applyReddito(cedolini);
  const fonteSnapshots = hydrateFonteSnapshots(p.fonteSnapshots);
  const fonteContributi = hydrateFonteContributi(p.fonteContributi);
  const patrimonioRaw: Partial<Patrimonio> =
    p.patrimonio && typeof p.patrimonio === "object" ? p.patrimonio : {};
  const patrimonio = normalizzaPatrimonio({ ...PATRIMONIO_VUOTO, ...patrimonioRaw });
  patrimonio.fonteAttivo = fonteAttivoDa(
    { ...patrimonio, fonteAttivo: patrimonioRaw.fonteAttivo },
    fonteSnapshots,
    fonteContributi,
  );
  patrimonio.fonteNome = typeof patrimonioRaw.fonteNome === "string" ? patrimonioRaw.fonteNome : "";
  const rawImmobili = normalizzaImmobili(
    resolveImmobiliFromPersist(p, patrimonio, current.immobili, hadPersistedBlob),
  );
  let dati: DatiImportabili = {
    fisse: fisseRaw,
    immobili: rawImmobili,
    csvMovimenti: soloOggetti<Movimento>(p.csvMovimenti).filter(
      (m) => typeof m.data === "string" && typeof m.descrizione === "string" && Number.isFinite(m.importo),
    ),
    regole: soloOggetti<Regola>(p.regole).filter((r) => typeof r.needle === "string" && typeof r.cat === "string"),
  };
  // Un salvataggio senza il flag viene da prima dell'app nuda.
  const vecchio = hadPersistedBlob && p.legacyImportato !== true;
  let legacyImportato = hadPersistedBlob ? p.legacyImportato === true : current.legacyImportato;
  if (vecchio) {
    // TAN scritto nella nota della rata: vale per chiunque, anche senza profilo.
    dati.immobili = dati.immobili.map((i) => {
      if ((i.mutuoTan ?? 0) > 0 || !i.fissaMutuoId) return i;
      const tan = tanDaNota(dati.fisse.find((f) => f.id === i.fissaMutuoId)?.note);
      return tan > 0 ? { ...i, mutuoTan: tan } : i;
    });
    if (profilo) {
      dati = importaProfiloPrivato(dati, profilo);
      legacyImportato = true;
    }
  }
  dati = legaMutui(dati);
  // Col piano della banca il debito di oggi si legge dal piano: il numero scritto
  // al momento dell import invecchia di mese in mese.
  dati.immobili = dati.immobili.map((i) => {
    const piano = dati.fisse.find((f) => f.id === i.fissaMutuoId)?.piano;
    return piano && piano.length ? { ...i, capitaleMutuo: residuoAl(piano) } : i;
  });
  // Salvataggi già sporchi: un immobile può puntare a una fissa mutuo cancellata.
  // Lasciato lì produce rata, interessi e detrazione 730 di un mutuo che non esiste.
  const idsFisse = new Set(dati.fisse.map((f) => f.id));
  const idsCase = new Set(dati.immobili.map((i) => i.id));
  const immobili = dati.immobili.map((i) =>
    i.fissaMutuoId && !idsFisse.has(i.fissaMutuoId) ? { ...i, fissaMutuoId: "" } : i,
  );
  // E una spesa non resta legata a una casa che non c'è più.
  const fisse = dati.fisse.map((f) =>
    f.immobileId && !idsCase.has(f.immobileId)
      ? normalizzaFissa({ ...f, immobileId: undefined, voce: undefined })
      : f,
  );
  const selRaw =
    typeof p.immobileSelezionatoId === "string" ? p.immobileSelezionatoId : "";
  const immobileSelezionatoId = immobili.some((i) => i.id === selRaw)
    ? selRaw
    : (immobili[0]?.id ?? "");
  return {
    ...current,
    fisse,
    regole: dati.regole,
    categorieCustom: soloOggetti<{ id: string; label: string }>(p.categorieCustom).filter(
      (c) => typeof c.id === "string" && c.id.length > 0,
    ),
    categorieNascoste: soloStringhe(p.categorieNascoste),
    fisseCategorie: soloOggetti<{ id: string; label: string }>(p.fisseCategorie).filter(
      (c) => typeof c.id === "string" && c.id.length > 0,
    ),
    investimenti: soloOggetti<Investimento>(p.investimenti).map(normalizzaInvestimento),
    movimentiManuali: soloOggetti<MovimentoManuale>(p.movimentiManuali).map((m) => ({
      ...m,
      archiviato: !!m.archiviato,
    })),
    movimentiArchiviati: asArray<string>(p.movimentiArchiviati, [])
      .filter((k): k is string => typeof k === "string" && k.length > 0)
      // Le chiavi salvate prima del numero d'ordine valgono per la prima occorrenza:
      // senza questa conversione tutti gli archivi fatti finora tornerebbero attivi
      // e V salterebbe su di colpo.
      .map((k) => (k.includes("#") ? k : `${k}#0`)),
    csvMovimenti: dati.csvMovimenti,
    csvMeta:
      p.csvMeta && typeof p.csvMeta === "object" ? (p.csvMeta as typeof EXTRA_DEFAULT.csvMeta) : null,
    overrideCat: asRecord(p.overrideCat),
    cedolini,
    immobili,
    immobileSelezionatoId,
    nascostoSaldo: asBool(p.nascostoSaldo, false),
    mostraDettaglioDebito: asBool(p.mostraDettaglioDebito, false),
    fonteSnapshots,
    fonteContributi,
    legacyImportato,
    ...reddito,
    mancanti: [],
    patrimonio,
  } as T;
}

const ELENCHI: Record<string, string> = {
  fisse: "spese fisse",
  cedolini: "cedolini",
  immobili: "case",
  movimentiManuali: "movimenti scritti a mano",
  csvMovimenti: "movimenti dell'estratto",
  investimenti: "investimenti",
  regole: "regole dei negozi",
  categorieCustom: "categorie",
  fisseCategorie: "categorie delle spese fisse",
  categorieNascoste: "categorie nascoste",
  fonteSnapshots: "aggiornamenti del fondo",
  fonteContributi: "versamenti del fondo",
  movimentiArchiviati: "movimenti archiviati",
};

/**
 * Quante righe del salvataggio sono rimaste fuori dopo il caricamento (non valide,
 * doppioni tolti, un elenco che non era un elenco). Serve a tenere una copia prima che
 * la prossima scrittura le cancelli. Le righe aggiunte dal profilo privato non contano.
 */
export function righeNonLette(
  persisted: unknown,
  caricato: QuadraState & Extra,
  profilo: ProfiloPrivato | null = null,
): { totale: number; dove: string[] } {
  if (persisted === null || typeof persisted !== "object" || Array.isArray(persisted)) return { totale: 0, dove: [] };
  const p = unwrapPersisted(persisted) as Record<string, unknown>;
  // Al primo passaggio col profilo, estratto e regole possono crescere: lì non si confronta.
  const importato = !!profilo && p.legacyImportato !== true;
  let totale = 0;
  const dove: string[] = [];
  const conta = (chiave: string, n: number) => {
    if (n <= 0) return;
    totale += n;
    const nome = ELENCHI[chiave] ?? chiave;
    if (!dove.includes(nome)) dove.push(nome);
  };
  const c = caricato as unknown as Record<string, unknown>;
  for (const chiave of Object.keys(ELENCHI)) {
    if (importato && (chiave === "csvMovimenti" || chiave === "regole")) continue;
    const raw = p[chiave];
    if (raw === undefined || raw === null) continue;
    const dopo = Array.isArray(c[chiave]) ? (c[chiave] as unknown[]).length : 0;
    if (!Array.isArray(raw)) {
      conta(chiave, 1);
      continue;
    }
    conta(chiave, raw.length - dopo);
  }
  // Le operazioni dentro ogni investimento.
  if (Array.isArray(p.investimenti)) {
    const prima = (p.investimenti as unknown[]).reduce<number>(
      (s, i) => s + (i && typeof i === "object" && Array.isArray((i as { transazioni?: unknown }).transazioni) ? ((i as { transazioni: unknown[] }).transazioni.length) : 0),
      0,
    );
    const invs = Array.isArray(c.investimenti) ? (c.investimenti as { transazioni?: unknown[] }[]) : [];
    const dopo = invs.reduce((s, i) => s + (Array.isArray(i.transazioni) ? i.transazioni.length : 0), 0);
    conta("transazioni", prima - dopo);
    if (prima - dopo > 0) {
      const i = dove.indexOf("transazioni");
      if (i >= 0) dove[i] = "operazioni degli investimenti";
    }
  }
  return { totale, dove };
}

/** Carica e, se qualche riga resta fuori, tiene una copia dell'originale prima di scriverci sopra. */
function caricaEControlla<T extends QuadraState & Extra>(persisted: unknown, current: T): T {
  const profilo = profiloPerChiave();
  const h = hydratePersisted(persisted, current, profilo);
  try {
    const { totale, dove } = righeNonLette(persisted, h, profilo);
    if (totale > 0) segnalaRighePerse(CHIAVE_ATTIVA, totale, dove);
  } catch {
    /* il controllo non deve mai impedire di caricare */
  }
  return h;
}

/** Versione del salvataggio. Una versione più nuova non si riporta mai indietro. */
export const VERSIONE_SALVATAGGIO = 21;

function profiloPerChiave(): ProfiloPrivato | null {
  return CHIAVE_ATTIVA === CHIAVE_TELEFONO ? PROFILO_PRIVATO : null;
}

export const useQuadra = create<QuadraState & Extra & Actions>()(
  persist(
    (set) => ({
      ...STATO_VUOTO,
      ...EXTRA_DEFAULT,
      setReddito: (mensile) =>
        set({ redditoMensile: mensile, redditoAnnuo: Math.round(mensile * 12) }),
      addFissa: (f) => {
        const id = nuovoId();
        set((s) => ({
          fisse: [...s.fisse, normalizzaFissa({ ...f, id })],
        }));
        return id;
      },
      updateFissa: (id, patch) =>
        set((s) => ({
          fisse: s.fisse.map((x) => {
            if (x.id !== id) return x;
            const next = normalizzaFissa({ ...x, ...patch });
            if (hasPiano(x)) {
              // Lock like Fisse UI: freq/categoria fixed; importo anagrafica only via gap fallback (not free edit).
              return healPianoFissa({ ...next, importo: x.importo });
            }
            return next;
          }),
        })),
      removeFissa: (id) =>
        set((s) => ({
          fisse: s.fisse.filter((x) => x.id !== id),
          // Gli immobili non restano agganciati a una fissa che non c'è più.
          immobili: s.immobili.map((i) =>
            i.fissaMutuoId === id ? { ...i, fissaMutuoId: "" } : i,
          ),
        })),
      setPatrimonio: (patch) =>
        set((s) => ({ patrimonio: { ...s.patrimonio, ...patch } })),
      addRegola: (needle, cat) =>
        set((s) => ({
          regole: [
            { needle: needle.toLowerCase(), cat },
            ...s.regole.filter((r) => r.needle !== needle.toLowerCase()),
          ],
        })),
      addCategoria: (label) => {
        const trimmed = label.trim();
        if (!trimmed) return "";
        let id = "";
        set((s) => {
          id = allocCatId(trimmed, s.categorieCustom);
          // Built-in: only unhide, never duplicate into custom
          if (builtinCatIds().has(id)) {
            return {
              categorieNascoste: s.categorieNascoste.filter((x) => x !== id),
            };
          }
          if (s.categorieCustom.some((c) => c.id === id)) {
            return {
              categorieNascoste: s.categorieNascoste.filter((x) => x !== id),
            };
          }
          return {
            categorieCustom: [...s.categorieCustom, { id, label: trimmed }],
            categorieNascoste: s.categorieNascoste.filter((x) => x !== id),
          };
        });
        return id;
      },
      addCategoriaFissa: (label) => {
        const nome = label.trim();
        const id = slugCategoriaFissa(nome);
        if (!nome || !id) return "";
        // Gia di serie o gia aggiunta: nessun doppione, restituisco quella esistente.
        if (CATEGORIE_FISSE_BUILTIN.has(id)) return id;
        set((s) =>
          s.fisseCategorie.some((c) => c.id === id)
            ? s
            : { fisseCategorie: [...s.fisseCategorie, { id, label: nome }] },
        );
        return id;
      },
      removeCategoriaFissa: (id) =>
        set((s) => {
          // Le quattro di serie non si cancellano.
          if (CATEGORIE_FISSE_BUILTIN.has(id)) return s;
          if (!s.fisseCategorie.some((c) => c.id === id)) return s;
          return {
            fisseCategorie: s.fisseCategorie.filter((c) => c.id !== id),
            // Le fisse che la usavano non restano orfane: tornano ad Altro.
            fisse: s.fisse.map((f) =>
              f.categoria === id ? { ...f, categoria: CATEGORIA_FISSA_DEFAULT } : f,
            ),
          };
        }),
      renameCategoria: (id, label) =>
        set((s) => {
          const trimmed = label.trim();
          if (!trimmed) return s;
          // Builtin: only custom labels are renamed; builtins keep fixed labels in SPESA_CATS.
          if (!s.categorieCustom.some((c) => c.id === id)) return s;
          return {
            categorieCustom: s.categorieCustom.map((c) =>
              c.id === id ? { ...c, label: trimmed } : c,
            ),
          };
        }),
      removeCategoria: (id) =>
        set((s) => {
          const overrideCat = { ...s.overrideCat };
          for (const [k, cat] of Object.entries(overrideCat)) {
            if (cat === id) delete overrideCat[k];
          }
          // Manuali with deleted cat → da_classificare (avoid orphan <select> value).
          const movimentiManuali = s.movimentiManuali.map((m) =>
            m.cat === id ? { ...m, cat: "da_classificare" } : m,
          );
          return {
            categorieCustom: s.categorieCustom.filter((c) => c.id !== id),
            categorieNascoste: s.categorieNascoste.includes(id)
              ? s.categorieNascoste
              : [...s.categorieNascoste, id],
            regole: s.regole.filter((r) => r.cat !== id),
            // Drop forced labels for the removed cat (else ghost "vacanze" forever).
            overrideCat,
            movimentiManuali,
          };
        }),
      addInvestimento: (i) =>
        set((s) => ({
          investimenti: [
            ...s.investimenti,
            normalizzaInvestimento({
              ...i,
              id: nuovoId(),
              transazioni: i.transazioni ?? [],
            }),
          ],
        })),
      updateInvestimento: (id, patch) =>
        set((s) => ({
          investimenti: s.investimenti.map((x) =>
            x.id === id
              ? normalizzaInvestimento({
                  ...x,
                  ...patch,
                  transazioni:
                    patch.transazioni !== undefined
                      ? patch.transazioni
                      : (x.transazioni ?? []),
                })
              : x,
          ),
        })),
      removeInvestimento: (id) =>
        set((s) => ({ investimenti: s.investimenti.filter((x) => x.id !== id) })),
      addInvTransazione: (invId, txn) =>
        set((s) => ({
          investimenti: s.investimenti.map((inv) => {
            if (inv.id !== invId) return inv;
            const row = {
              ...txn,
              id: nuovoId(),
              importo: Math.max(0, Number.isFinite(txn.importo) ? txn.importo : 0),
              commissione: Math.max(
                0,
                Number.isFinite(txn.commissione) ? txn.commissione : 0,
              ),
              note: txn.note ?? "",
            };
            return {
              ...inv,
              transazioni: [...(inv.transazioni ?? []), row],
            };
          }),
        })),
      updateInvTransazione: (invId, txnId, patch) =>
        set((s) => ({
          investimenti: s.investimenti.map((inv) => {
            if (inv.id !== invId) return inv;
            const txns = inv.transazioni ?? [];
            return {
              ...inv,
              transazioni: txns.map((t) => {
                if (t.id !== txnId) return t;
                const next = { ...t, ...patch };
                return {
                  ...next,
                  importo: Math.max(
                    0,
                    Number.isFinite(next.importo) ? next.importo : 0,
                  ),
                  commissione: Math.max(
                    0,
                    Number.isFinite(next.commissione) ? next.commissione : 0,
                  ),
                  note: next.note ?? "",
                };
              }),
            };
          }),
        })),
      removeInvTransazione: (invId, txnId) =>
        set((s) => ({
          investimenti: s.investimenti.map((inv) =>
            inv.id !== invId
              ? inv
              : {
                  ...inv,
                  transazioni: (inv.transazioni ?? []).filter((t) => t.id !== txnId),
                },
          ),
        })),
      addMovimento: (m) =>
        set((s) => ({
          movimentiManuali: [
            { ...m, id: nuovoId(), archiviato: !!m.archiviato },
            ...s.movimentiManuali,
          ],
        })),
      updateMovimento: (id, patch) =>
        set((s) => ({
          movimentiManuali: s.movimentiManuali.map((x) =>
            x.id === id ? { ...x, ...patch } : x,
          ),
        })),
      removeMovimento: (id) =>
        set((s) => ({
          movimentiManuali: s.movimentiManuali.filter((x) => x.id !== id),
        })),
      setManualeArchiviato: (id, archiviato) =>
        set((s) => ({
          movimentiManuali: s.movimentiManuali.map((x) =>
            x.id === id ? { ...x, archiviato } : x,
          ),
        })),
      setCsvArchiviato: (key, archiviato) =>
        set((s) => {
          const setKeys = new Set(s.movimentiArchiviati);
          if (archiviato) setKeys.add(key);
          else setKeys.delete(key);
          return { movimentiArchiviati: [...setKeys] };
        }),
      setCsv: (movimenti, meta) => set({ csvMovimenti: movimenti, csvMeta: meta }),
      clearCsv: () => set({ csvMovimenti: [], csvMeta: null }),
      setOverride: (key, cat, needle) =>
        set((s) => {
          const regole =
            needle && cat !== "da_classificare"
              ? [
                  { needle: merchantKey(needle).toLowerCase(), cat },
                  ...s.regole.filter((r) => r.needle !== merchantKey(needle).toLowerCase()),
                ]
              : s.regole;
          return { overrideCat: { ...s.overrideCat, [key]: cat }, regole };
        }),
      addCedolino: (c) =>
        set((s) => {
          const id = c.mese;
          const next = [
            ...s.cedolini.filter((x) => x.mese !== c.mese && x.id !== id),
            { ...c, id },
          ].sort((a, b) => a.mese.localeCompare(b.mese));
          return { cedolini: next, ...applyReddito(next) };
        }),
      updateCedolino: (id, patch) =>
        set((s) => {
          const vecchio = s.cedolini.find((x) => x.id === id);
          if (!vecchio) return s;
          // L id è il mese: se cambia il mese cambia anche l id, e nessun altro
          // cedolino può restare con lo stesso mese (niente doppioni).
          const aggiornato = { ...vecchio, ...patch };
          aggiornato.id = aggiornato.mese;
          const next = [
            ...s.cedolini.filter((x) => x.id !== id && x.mese !== aggiornato.mese),
            aggiornato,
          ].sort((a, b) => a.mese.localeCompare(b.mese));
          return { cedolini: next, ...applyReddito(next) };
        }),
      removeCedolino: (id) =>
        set((s) => {
          const next = s.cedolini.filter((x) => x.id !== id);
          return { cedolini: next, ...applyReddito(next) };
        }),
      addImmobile: (i) => {
        const id = nuovoId();
        set((s) => ({
          immobili: [...s.immobili, normalizzaImmobile({ ...i, id })],
          immobileSelezionatoId: id,
        }));
        return id;
      },
      updateImmobile: (id, patch) =>
        set((s) => ({
          immobili: s.immobili.map((x) => (x.id === id ? { ...x, ...patch } : x)),
        })),
      removeImmobile: (id, opts) =>
        set((s) => {
          const immobili = s.immobili.filter((x) => x.id !== id);
          // Le spese della casa: via con lei, oppure restano come spese fisse normali.
          const fisse = opts?.conSpese
            ? s.fisse.filter((f) => f.immobileId !== id)
            : s.fisse.map((f) =>
                f.immobileId === id
                  ? normalizzaFissa({ ...f, immobileId: undefined, voce: undefined })
                  : f,
              );
          const immobileSelezionatoId =
            s.immobileSelezionatoId === id
              ? (immobili[0]?.id ?? "")
              : immobili.some((x) => x.id === s.immobileSelezionatoId)
                ? s.immobileSelezionatoId
                : (immobili[0]?.id ?? "");
          return { immobili, immobileSelezionatoId, fisse };
        }),
      removeFonte: () =>
        set((s) => ({
          patrimonio: {
            ...s.patrimonio,
            fonteAttivo: false,
            fonteTotale: 0,
            fonteInvestito: 0,
            fonteAttesa: 0,
            tfrAccantonato: 0,
            retribuzioneUtile: 0,
            fonteLavPct: 0,
            fonteDatPct: 0,
          },
          fonteSnapshots: [],
          fonteContributi: [],
        })),
      selectImmobile: (id) =>
        set((s) =>
          s.immobili.some((x) => x.id === id) ? { immobileSelezionatoId: id } : s,
        ),
      toggleSaldo: () => set((s) => ({ nascostoSaldo: !s.nascostoSaldo })),
      toggleDettaglioDebito: () =>
        set((s) => ({ mostraDettaglioDebito: !s.mostraDettaglioDebito })),
      applyFonteSnapshot: (snap) =>
        set((s) => {
          const row: FonteSnapshot = {
            ...snap,
            id: snap.id || nuovoId(),
          };
          const exists = s.fonteSnapshots.some((x) => x.id === row.id);
          return {
            patrimonio: applyFonteSnapshotToPatrimonio(s.patrimonio, row),
            fonteSnapshots: exists
              ? s.fonteSnapshots.map((x) => (x.id === row.id ? row : x))
              : [row, ...s.fonteSnapshots],
          };
        }),
      addFonteSnapshots: (snaps) =>
        set((s) => {
          if (!snaps.length) return s;
          const have = new Set(
            s.fonteSnapshots.map((x) => `${x.data}|${x.comparto}|${x.numeroQuote}|${x.valoreQuota}`),
          );
          const extra: FonteSnapshot[] = [];
          for (const snap of snaps) {
            const k = `${snap.data}|${snap.comparto}|${snap.numeroQuote}|${snap.valoreQuota}`;
            if (have.has(k)) continue;
            have.add(k);
            extra.push({ ...snap, id: snap.id || nuovoId() });
          }
          if (!extra.length) return s;
          // Latest tra nuovi + esistenti: un CSV storico non deve regressare il saldo.
          const merged = [...extra, ...s.fonteSnapshots];
          const latest = latestFonteSnapshot(merged);
          return {
            fonteSnapshots: merged,
            patrimonio: latest
              ? applyFonteSnapshotToPatrimonio(s.patrimonio, latest)
              : s.patrimonio,
          };
        }),
      addFonteContributi: (rows, includeDups = false) =>
        set((s) => {
          if (!rows.length) return s;
          const { nuovi, duplicati } = partizionaFonteContributi(rows, s.fonteContributi);
          const take = includeDups ? [...nuovi, ...duplicati] : nuovi;
          if (!take.length) return s;
          return {
            fonteContributi: [
              ...take.map((c) => ({ ...c, id: c.id || nuovoId() })),
              ...s.fonteContributi,
            ],
          };
        }),
      removeFonteSnapshot: (id) =>
        set((s) => {
          const prevLatest = latestFonteSnapshot(s.fonteSnapshots);
          const fonteSnapshots = s.fonteSnapshots.filter((x) => x.id !== id);
          // Solo se rimuovi il più recente: riallinea allo snapshot restante, o azzera investito se lista vuota.
          if (!prevLatest || prevLatest.id !== id) return { fonteSnapshots };
          const latest = latestFonteSnapshot(fonteSnapshots);
          return {
            fonteSnapshots,
            patrimonio: latest
              ? applyFonteSnapshotToPatrimonio(s.patrimonio, latest)
              : clearFontePosizioneFromPatrimonio(s.patrimonio),
          };
        }),
      removeFonteContributo: (id) =>
        set((s) => ({ fonteContributi: s.fonteContributi.filter((x) => x.id !== id) })),
      reset: () =>
        set({
          ...STATO_VUOTO,
          ...EXTRA_DEFAULT,
        }),
    }),
    {
      // «Dati del telefono» o «app vuota»: due salvataggi che non si mescolano.
      name: CHIAVE_ATTIVA,
      version: VERSIONE_SALVATAGGIO,
      // Data only — never persist action fns (avoids silent key loss / blob confusion).
      partialize: (s) => ({
        redditoMensile: s.redditoMensile,
        redditoAnnuo: s.redditoAnnuo,
        fisse: s.fisse,
        patrimonio: s.patrimonio,
        mancanti: s.mancanti,
        regole: s.regole,
        categorieCustom: s.categorieCustom,
        categorieNascoste: s.categorieNascoste,
        fisseCategorie: s.fisseCategorie,
        investimenti: s.investimenti,
        movimentiManuali: s.movimentiManuali,
        movimentiArchiviati: s.movimentiArchiviati,
        csvMovimenti: s.csvMovimenti,
        csvMeta: s.csvMeta,
        overrideCat: s.overrideCat,
        cedolini: s.cedolini,
        immobili: s.immobili,
        immobileSelezionatoId: s.immobileSelezionatoId,
        nascostoSaldo: s.nascostoSaldo,
        mostraDettaglioDebito: s.mostraDettaglioDebito,
        fonteSnapshots: s.fonteSnapshots,
        fonteContributi: s.fonteContributi,
        legacyImportato: s.legacyImportato,
      }),
      storage: createJSONStorage(() => createQuadraPersistKv()),
      // I dati di prima stanno solo nel salvataggio storico: l'app vuota non li riceve mai.
      merge: (persisted, current) => caricaEControlla(persisted, current),
      migrate: (persisted, version) => {
        // Salvato da un'app più nuova (un'altra scheda, un altro telefono): riportarlo indietro
        // butterebbe i campi che questa versione non conosce. Si blocca e si avvisa.
        if (version > VERSIONE_SALVATAGGIO)
          throw new Error(`Salvataggio della versione ${version}, questa app è la ${VERSIONE_SALVATAGGIO}.`);
        return caricaEControlla(persisted, { ...STATO_VUOTO, ...EXTRA_DEFAULT } as QuadraState & Extra);
      },
      // Se il caricamento fallisce comunque, niente scritture sopra il salvataggio vero.
      onRehydrateStorage: () => (_state, error) => {
        if (error) segnalaCaricamentoFallito(CHIAVE_ATTIVA, error);
      },
    },
  ),
);
