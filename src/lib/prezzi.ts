/**
 * Prezzi live — solo UI. Mapping e costo sono puri/offline (stressable).
 * Catena: CoinMarketCap (se chiave in localStorage) → CoinGecko → Binance → Coinbase.
 * Cache localStorage ~10 min. La chiave CMC non va nel repo.
 */

const TICKER_TO_ID: Record<string, string> = {
  btc: "bitcoin",
  bitcoin: "bitcoin",
  eth: "ethereum",
  ethereum: "ethereum",
  sol: "solana",
  solana: "solana",
  ada: "cardano",
  cardano: "cardano",
  xrp: "ripple",
  ripple: "ripple",
  doge: "dogecoin",
  dogecoin: "dogecoin",
};

/** CoinGecko id → ticker Binance/Coinbase/CMC (EUR). Solo questi hanno fallback exchange. */
const ID_TO_TICKER: Record<string, string> = {
  bitcoin: "BTC",
  ethereum: "ETH",
  solana: "SOL",
  cardano: "ADA",
  ripple: "XRP",
  dogecoin: "DOGE",
};

const CACHE_KEY = "ledger.prezzi.v1";
/** Chiave API CoinMarketCap — solo browser localStorage, mai committata. */
export const CMC_API_KEY_STORAGE = "ledger.cmcApiKey";
export const CMC_QUOTES_URL =
  "https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest";
/** TTL cache ultimo prezzo riuscito (ms). Default 10 min (range 5–15). */
export const PRICE_CACHE_TTL_MS = 10 * 60 * 1000;

type CacheEntry = { price: number; at: number; source: string };
type CacheStore = Record<string, CacheEntry>;

export type KvStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function browserStorage(): KvStorage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

/** Legge la chiave CMC (trim). Vuota se assente. */
export function readCmcApiKey(storage?: KvStorage | null): string {
  const s = storage === undefined ? browserStorage() : storage;
  if (!s) return "";
  try {
    return (s.getItem(CMC_API_KEY_STORAGE) ?? "").trim();
  } catch {
    return "";
  }
}

/** Salva o cancella (stringa vuota) la chiave CMC. */
export function writeCmcApiKey(key: string, storage?: KvStorage | null): void {
  const s = storage === undefined ? browserStorage() : storage;
  if (!s) return;
  try {
    const t = key.trim();
    if (!t) s.removeItem(CMC_API_KEY_STORAGE);
    else s.setItem(CMC_API_KEY_STORAGE, t);
  } catch {
    /* quota / private mode */
  }
}

export function clearCmcApiKey(storage?: KvStorage | null): void {
  writeCmcApiKey("", storage);
}

export function hasCmcApiKey(storage?: KvStorage | null): boolean {
  return readCmcApiKey(storage).length > 0;
}

export function maskCmcApiKey(key: string): string {
  const t = key.trim();
  if (!t) return "";
  if (t.length <= 4) return "••••";
  return `••••${t.slice(-4)}`;
}

/**
 * Risolve ticker o id CoinGecko libero (es. BTC → bitcoin, "chainlink" → chainlink).
 * Accetta anche id già in simbolo/note stile coingecko (slug a-z0-9-).
 */
export function coinGeckoId(simboloOrNote: string | undefined | null): string | null {
  if (typeof simboloOrNote !== "string") return null;
  const raw = simboloOrNote.trim().toLowerCase();
  if (!raw) return null;
  // Prefer explicit "id:slug" in note/simbolo
  const tagged = raw.match(/(?:^|\s)(?:id|coingecko)[=:\s]+([a-z0-9-]+)/);
  if (tagged?.[1]) return tagged[1];
  if (TICKER_TO_ID[raw]) return TICKER_TO_ID[raw];
  // bare slug (custom CoinGecko id)
  if (/^[a-z][a-z0-9-]{1,63}$/.test(raw)) return raw;
  return null;
}

/** Id numerico CMC esplicito in nota/simbolo (`cmc:1` / `cmcid=1027`). */
export function cmcNumericId(simboloOrNote: string | undefined | null): number | null {
  if (typeof simboloOrNote !== "string") return null;
  const m = simboloOrNote.trim().toLowerCase().match(/(?:^|\s)(?:cmc|cmcid)[=:\s]+(\d+)/);
  if (!m?.[1]) return null;
  const n = Number(m[1]);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Ticker EUR noto per fallback Binance/Coinbase/CMC symbol=, o null. */
export function fallbackTickerForId(id: string): string | null {
  const t = ID_TO_TICKER[id.trim().toLowerCase()];
  return t ?? null;
}

/** Simbolo CMC (BTC) per un id CoinGecko, o null. */
export function cmcSymbolForId(id: string): string | null {
  return fallbackTickerForId(id);
}

/** Valore mercato da prezzo EUR: quantità × prezzo se q>0, altrimenti 1 unità. */
export function valoreDaPrezzoMercato(
  quantita: number | undefined,
  priceEur: number,
): number {
  if (!Number.isFinite(priceEur) || priceEur < 0) return 0;
  const q =
    typeof quantita === "number" && Number.isFinite(quantita) && quantita > 0
      ? quantita
      : 1;
  return Math.round(q * priceEur * 100) / 100;
}

/**
 * Patch da prezzo live. Aggiorna sempre prezzoMercato; ricalcola `valore`
 * solo se quantità > 0 — altrimenti non sovrascrivere un valore manuale con 1×prezzo
 * (auto-refresh / Aggiorna prezzi).
 */
export function livePricePatch(
  quantita: number | undefined,
  priceEur: number,
  atIso: string,
): { prezzoMercato: number; prezzoAggiornatoAt: string; valore?: number } {
  const safe =
    typeof priceEur === "number" && Number.isFinite(priceEur) && priceEur >= 0
      ? priceEur
      : 0;
  const patch: { prezzoMercato: number; prezzoAggiornatoAt: string; valore?: number } = {
    prezzoMercato: safe,
    prezzoAggiornatoAt: atIso,
  };
  if (
    typeof quantita === "number" &&
    Number.isFinite(quantita) &&
    quantita > 0 &&
    safe > 0
  ) {
    patch.valore = valoreDaPrezzoMercato(quantita, safe);
  }
  return patch;
}

/**
 * Cosa cambia negli investimenti dopo un aggiornamento dei prezzi. Il prezzo si applica
 * sempre, e il valore segue la quantità di adesso (anche dopo un cambio di simbolo o di
 * quantità). L'ora è quella vera del prezzo: se arriva dalla copia salvata porta l'ora
 * della copia, non quella di adesso.
 */
export function patchDaPrezzi(
  invs: { id: string; quantita?: number }[],
  idPerInvestimento: Map<string, string>,
  risposta: Pick<PriceFetchResult, "prices" | "observedAt">,
  adesso = Date.now(),
): { id: string; patch: ReturnType<typeof livePricePatch> }[] {
  const out: { id: string; patch: ReturnType<typeof livePricePatch> }[] = [];
  for (const [invId, idPrezzo] of idPerInvestimento) {
    const prezzo = risposta.prices[idPrezzo];
    const inv = invs.find((x) => x.id === invId);
    if (prezzo === undefined || !inv) continue;
    const quando = risposta.observedAt?.[idPrezzo] ?? adesso;
    out.push({ id: invId, patch: livePricePatch(inv.quantita, prezzo, new Date(quando).toISOString()) });
  }
  return out;
}

export type PriceSource =
  | "coinmarketcap"
  | "coingecko"
  | "binance"
  | "coinbase"
  | "cache"
  | "mixed";

export function priceSourceChain(hasCmcKey: boolean): Exclude<PriceSource, "cache" | "mixed">[] {
  return hasCmcKey
    ? ["coinmarketcap", "coingecko", "binance", "coinbase"]
    : ["coingecko", "binance", "coinbase"];
}

export type PriceFetchResult = {
  prices: Record<string, number>;
  /** ids richiesti senza quotazione nella risposta */
  missing: string[];
  source: PriceSource;
  /** Messaggio tip UI (es. quale fonte ha risposto). */
  tip?: string;
  /**
   * Quando è stato letto davvero ogni prezzo (ms). Un prezzo dalla cache porta l'ora
   * della cache, non quella di adesso: così un prezzo vecchio non passa per nuovo.
   */
  observedAt?: Record<string, number>;
};

export type PriceErrorKind = "rate_limit" | "offline" | "unknown_symbol" | "empty" | "auth";

export class PriceFetchError extends Error {
  readonly kind: PriceErrorKind;
  constructor(kind: PriceErrorKind, message: string) {
    super(message);
    this.name = "PriceFetchError";
    this.kind = kind;
  }
}

export function italianPriceError(kind: PriceErrorKind, detail?: string): string {
  switch (kind) {
    case "rate_limit":
      return "Troppe richieste al listino: riprova tra qualche minuto. Resta il prezzo dell'ultimo aggiornamento.";
    case "offline":
      return "Niente connessione, o i listini non rispondono. Riprova tra poco.";
    case "unknown_symbol":
      return detail
        ? `Simbolo non trovato o non supportato: ${detail}`
        : "Simbolo non trovato o non supportato.";
    case "empty":
      return "Nessun prezzo aggiornato.";
    case "auth":
      return "La chiave del listino salvata su questo telefono non è valida: il prezzo resta quello di prima.";
    default:
      return "Errore durante l’aggiornamento prezzi.";
  }
}

export const CMC_NO_KEY_TIP = "Aggiungi chiave CMC per CoinMarketCap";

type FetchLike = typeof fetch;

export type LivePriceOpts = {
  /** undefined = leggi localStorage; "" / null = salta CMC. */
  cmcApiKey?: string | null;
  fetchImpl?: FetchLike;
  now?: number;
  skipCache?: boolean;
};

function readCache(): CacheStore {
  try {
    if (typeof localStorage === "undefined") return {};
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as CacheStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeCache(store: CacheStore): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(CACHE_KEY, JSON.stringify(store));
  } catch {
    /* quota / private mode */
  }
}

/** Pure: filtra cache fresca per gli id richiesti. */
export function pricesFromCache(
  ids: string[],
  store: CacheStore,
  now = Date.now(),
  ttlMs = PRICE_CACHE_TTL_MS,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of ids) {
    const e = store[id];
    if (
      e &&
      typeof e.price === "number" &&
      Number.isFinite(e.price) &&
      e.price >= 0 &&
      typeof e.at === "number" &&
      now - e.at <= ttlMs
    ) {
      out[id] = e.price;
    }
  }
  return out;
}

/** True se tutti gli id hanno un prezzo in cache ancora entro il TTL (~10 min). */
export function isPriceCacheFresh(
  ids: string[],
  now = Date.now(),
  ttlMs = PRICE_CACHE_TTL_MS,
): boolean {
  const unique = [...new Set(ids.map((x) => x.trim().toLowerCase()).filter(Boolean))];
  if (!unique.length) return true;
  const cached = pricesFromCache(unique, readCache(), now, ttlMs);
  return unique.every((id) => cached[id] !== undefined);
}

function rememberPrices(
  prices: Record<string, number>,
  source: string,
  now = Date.now(),
): void {
  if (!Object.keys(prices).length) return;
  const store = readCache();
  for (const [id, price] of Object.entries(prices)) {
    store[id] = { price, at: now, source };
  }
  writeCache(store);
}

type CmcQuoteRow = {
  id?: number;
  symbol?: string;
  slug?: string;
  quote?: { EUR?: { price?: number } };
};

export type CmcQuotesJson = {
  status?: { error_code?: number; error_message?: string | null };
  data?: Record<string, CmcQuoteRow | CmcQuoteRow[]>;
};

function cmcRowPrice(row: CmcQuoteRow | undefined): number | null {
  const p = row?.quote?.EUR?.price;
  return typeof p === "number" && Number.isFinite(p) && p >= 0 ? p : null;
}

function flattenCmcData(
  data: CmcQuotesJson["data"],
): CmcQuoteRow[] {
  if (!data || typeof data !== "object") return [];
  const rows: CmcQuoteRow[] = [];
  for (const v of Object.values(data)) {
    if (Array.isArray(v)) rows.push(...v);
    else if (v && typeof v === "object") rows.push(v);
  }
  return rows;
}

function rowMatchesId(row: CmcQuoteRow, id: string): boolean {
  const slug = typeof row.slug === "string" ? row.slug.trim().toLowerCase() : "";
  const sym = typeof row.symbol === "string" ? row.symbol.trim().toUpperCase() : "";
  const ticker = cmcSymbolForId(id);
  if (slug && slug === id) return true;
  if (ticker && sym === ticker) return true;
  return false;
}

/**
 * Pure: mappa la risposta CMC (symbol= / slug= / id=) sugli id CoinGecko richiesti.
 */
export function parseCmcQuotesLatest(
  json: unknown,
  requestedIds: string[],
): { prices: Record<string, number>; missing: string[] } {
  const unique = [...new Set(requestedIds.map((x) => x.trim().toLowerCase()).filter(Boolean))];
  const prices: Record<string, number> = {};
  const missing: string[] = [];
  if (!json || typeof json !== "object") {
    return { prices, missing: unique };
  }
  const body = json as CmcQuotesJson;
  const rows = flattenCmcData(body.data);
  const byKey = body.data && typeof body.data === "object" ? body.data : {};

  for (const id of unique) {
    const ticker = cmcSymbolForId(id);
    let price: number | null = null;
    const direct = ticker ? byKey[ticker] ?? byKey[ticker.toLowerCase()] : undefined;
    const slugDirect = byKey[id];
    const fromDirect = (entry: CmcQuoteRow | CmcQuoteRow[] | undefined): number | null => {
      if (!entry) return null;
      if (Array.isArray(entry)) {
        for (const r of entry) {
          const p = cmcRowPrice(r);
          if (p !== null) return p;
        }
        return null;
      }
      return cmcRowPrice(entry);
    };
    price = fromDirect(direct) ?? fromDirect(slugDirect);
    if (price === null) {
      const hit = rows.find((r) => rowMatchesId(r, id));
      price = cmcRowPrice(hit);
    }
    if (price !== null) prices[id] = price;
    else missing.push(id);
  }
  return { prices, missing };
}

export function cmcErrorKindFromStatus(errorCode: number | undefined, httpStatus: number): PriceErrorKind | null {
  if (httpStatus === 429) return "rate_limit";
  if (httpStatus === 401 || httpStatus === 403) return "auth";
  if (errorCode === 1008 || errorCode === 1009 || errorCode === 1010 || errorCode === 1011) {
    return "rate_limit";
  }
  if (errorCode === 1006 || errorCode === 1007 || errorCode === 4001) return "auth";
  if (typeof errorCode === "number" && errorCode !== 0) return "offline";
  if (!httpStatus || (httpStatus >= 200 && httpStatus < 300)) return null;
  return "offline";
}

function splitCmcQuery(ids: string[]): { symbols: string[]; slugs: string[] } {
  const symbols: string[] = [];
  const slugs: string[] = [];
  const seenSym = new Set<string>();
  const seenSlug = new Set<string>();
  for (const id of ids) {
    const ticker = cmcSymbolForId(id);
    if (ticker) {
      if (!seenSym.has(ticker)) {
        seenSym.add(ticker);
        symbols.push(ticker);
      }
    } else if (!seenSlug.has(id)) {
      seenSlug.add(id);
      slugs.push(id);
    }
  }
  return { symbols, slugs };
}

async function cmcRequest(
  params: URLSearchParams,
  apiKey: string,
  fetchImpl: FetchLike,
): Promise<{ json: unknown; status: number }> {
  const url = `${CMC_QUOTES_URL}?${params.toString()}`;
  let res: Response;
  try {
    res = await fetchImpl(url, {
      headers: {
        "X-CMC_PRO_API_KEY": apiKey,
        Accept: "application/json",
      },
    });
  } catch {
    throw new PriceFetchError("offline", italianPriceError("offline"));
  }
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  const code =
    json && typeof json === "object"
      ? (json as CmcQuotesJson).status?.error_code
      : undefined;
  const kind = cmcErrorKindFromStatus(code, res.status);
  if (kind === "rate_limit") {
    throw new PriceFetchError("rate_limit", italianPriceError("rate_limit"));
  }
  if (kind === "auth") {
    throw new PriceFetchError("auth", italianPriceError("auth"));
  }
  if (kind === "offline") {
    throw new PriceFetchError(
      "offline",
      `CoinMarketCap non risponde (${res.status})`,
    );
  }
  return { json, status: res.status };
}

/**
 * Fetch CMC quotes/latest convert=EUR. `symbol=` per ticker noti, `slug=` per gli altri.
 * Iniettabile per stress (nessuna rete).
 */
export async function fetchCoinMarketCapQuotesEur(
  ids: string[],
  apiKey: string,
  fetchImpl: FetchLike = fetch,
): Promise<PriceFetchResult> {
  const unique = [...new Set(ids.map((x) => x.trim().toLowerCase()).filter(Boolean))];
  if (!unique.length) return { prices: {}, missing: [], source: "coinmarketcap" };
  const key = apiKey.trim();
  if (!key) {
    throw new PriceFetchError("auth", italianPriceError("auth"));
  }

  const { symbols, slugs } = splitCmcQuery(unique);
  const chunks: { json: unknown }[] = [];
  if (symbols.length) {
    const params = new URLSearchParams({
      symbol: symbols.join(","),
      convert: "EUR",
    });
    chunks.push(await cmcRequest(params, key, fetchImpl));
  }
  if (slugs.length) {
    const params = new URLSearchParams({
      slug: slugs.join(","),
      convert: "EUR",
    });
    chunks.push(await cmcRequest(params, key, fetchImpl));
  }

  const prices: Record<string, number> = {};
  for (const c of chunks) {
    const parsed = parseCmcQuotesLatest(c.json, unique);
    Object.assign(prices, parsed.prices);
  }
  const missing = unique.filter((id) => prices[id] === undefined);
  return { prices, missing, source: "coinmarketcap" };
}

async function fetchCoinGeckoOnly(
  ids: string[],
  fetchImpl: FetchLike = fetch,
): Promise<PriceFetchResult> {
  const unique = [...new Set(ids.map((x) => x.trim().toLowerCase()).filter(Boolean))];
  if (!unique.length) return { prices: {}, missing: [], source: "coingecko" };
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(unique.join(","))}&vs_currencies=eur`;
  let res: Response;
  try {
    res = await fetchImpl(url);
  } catch {
    throw new PriceFetchError("offline", italianPriceError("offline"));
  }
  if (res.status === 429) {
    throw new PriceFetchError("rate_limit", italianPriceError("rate_limit"));
  }
  if (!res.ok) {
    throw new PriceFetchError(
      "offline",
      `CoinGecko non risponde (${res.status})`,
    );
  }
  const data = (await res.json()) as Record<string, { eur?: number }>;
  const prices: Record<string, number> = {};
  const missing: string[] = [];
  for (const id of unique) {
    const p = data?.[id]?.eur;
    if (typeof p === "number" && Number.isFinite(p) && p >= 0) prices[id] = p;
    else missing.push(id);
  }
  return { prices, missing, source: "coingecko" };
}

async function fetchBinanceEur(
  ticker: string,
  fetchImpl: FetchLike = fetch,
): Promise<number | null> {
  const symbol = `${ticker.toUpperCase()}EUR`;
  try {
    const res = await fetchImpl(
      `https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(symbol)}`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { price?: string };
    const n = Number(data?.price);
    return Number.isFinite(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

async function fetchCoinbaseEur(
  ticker: string,
  fetchImpl: FetchLike = fetch,
): Promise<number | null> {
  const pair = `${ticker.toUpperCase()}-EUR`;
  try {
    const res = await fetchImpl(
      `https://api.coinbase.com/v2/prices/${encodeURIComponent(pair)}/spot`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: { amount?: string } };
    const n = Number(data?.data?.amount);
    return Number.isFinite(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

/** Un id: Binance poi Coinbase. */
export async function fetchFallbackPriceEur(
  id: string,
  fetchImpl: FetchLike = fetch,
): Promise<{ price: number; source: "binance" | "coinbase" } | null> {
  const ticker = fallbackTickerForId(id);
  if (!ticker) return null;
  const fromBinance = await fetchBinanceEur(ticker, fetchImpl);
  if (fromBinance !== null) return { price: fromBinance, source: "binance" };
  const fromCoinbase = await fetchCoinbaseEur(ticker, fetchImpl);
  if (fromCoinbase !== null) return { price: fromCoinbase, source: "coinbase" };
  return null;
}

async function fillMissingViaFallback(
  missing: string[],
  fetchImpl: FetchLike = fetch,
): Promise<{ prices: Record<string, number>; sources: Set<string>; stillMissing: string[] }> {
  const prices: Record<string, number> = {};
  const sources = new Set<string>();
  const stillMissing: string[] = [];
  for (const id of missing) {
    const got = await fetchFallbackPriceEur(id, fetchImpl);
    if (got) {
      prices[id] = got.price;
      sources.add(got.source);
    } else {
      stillMissing.push(id);
    }
  }
  return { prices, sources, stillMissing };
}

function mergeSource(
  primary: PriceSource | null,
  extras: Set<string>,
): PriceSource {
  const all = new Set<string>();
  if (primary && primary !== "mixed") all.add(primary);
  for (const s of extras) all.add(s);
  if (all.size === 0) return "cache";
  if (all.size === 1) return [...all][0] as PriceSource;
  return "mixed";
}

/**
 * Fetch prezzi EUR: CMC (se chiave) → CoinGecko → Binance/Coinbase → cache.
 * Solo browser / UI — negli stress usa fetchImpl mock.
 */
export async function fetchLivePricesEur(
  ids: string[],
  opts: LivePriceOpts = {},
): Promise<PriceFetchResult> {
  const unique = [...new Set(ids.map((x) => x.trim().toLowerCase()).filter(Boolean))];
  const fetchImpl = opts.fetchImpl ?? fetch;
  const now = opts.now ?? Date.now();
  const key =
    opts.cmcApiKey === undefined ? readCmcApiKey() : (opts.cmcApiKey ?? "").trim();
  const hasKey = key.length > 0;

  if (!unique.length) {
    return {
      prices: {},
      missing: [],
      source: hasKey ? "coinmarketcap" : "coingecko",
      tip: hasKey ? undefined : CMC_NO_KEY_TIP,
    };
  }

  const cached = opts.skipCache ? {} : pricesFromCache(unique, readCache(), now);
  const need = unique.filter((id) => cached[id] === undefined);

  const quandoInCache = (lista: string[]) => {
    const store = readCache();
    const out: Record<string, number> = {};
    for (const id of lista) {
      const at = store[id]?.at;
      if (typeof at === "number" && Number.isFinite(at)) out[id] = at;
    }
    return out;
  };

  if (!need.length) {
    return {
      prices: cached,
      missing: [],
      observedAt: quandoInCache(Object.keys(cached)),
      source: "cache",
      tip: hasKey
        ? "Prezzi dalla cache locale (ultimo aggiornamento riuscito)."
        : `Prezzi dalla cache locale (ultimo aggiornamento riuscito). ${CMC_NO_KEY_TIP}.`,
    };
  }

  let cmcPrices: Record<string, number> = {};
  let cmcMissing = need;
  let cmcSource: PriceSource | null = null;
  let cmcFail: PriceFetchError | null = null;

  if (hasKey) {
    try {
      const cmc = await fetchCoinMarketCapQuotesEur(need, key, fetchImpl);
      cmcPrices = cmc.prices;
      cmcMissing = cmc.missing;
      cmcSource = "coinmarketcap";
    } catch (e) {
      if (e instanceof PriceFetchError) cmcFail = e;
      else cmcFail = new PriceFetchError("offline", italianPriceError("offline"));
      cmcMissing = need;
    }
  }

  let cgPrices: Record<string, number> = {};
  let cgMissing = cmcMissing;
  let cgSource: PriceSource | null = null;
  let cgFail: PriceFetchError | null = null;

  if (cmcMissing.length) {
    try {
      const cg = await fetchCoinGeckoOnly(cmcMissing, fetchImpl);
      cgPrices = cg.prices;
      cgMissing = cg.missing;
      cgSource = "coingecko";
    } catch (e) {
      if (e instanceof PriceFetchError) cgFail = e;
      else cgFail = new PriceFetchError("offline", italianPriceError("offline"));
      cgMissing = cmcMissing;
    }
  }

  const fb = await fillMissingViaFallback(cgMissing, fetchImpl);
  const prices: Record<string, number> = {
    ...cached,
    ...cmcPrices,
    ...cgPrices,
    ...fb.prices,
  };
  const missing = fb.stillMissing.filter((id) => prices[id] === undefined);

  const livePrices = { ...cmcPrices, ...cgPrices, ...fb.prices };
  if (Object.keys(livePrices).length) {
    rememberPrices(
      livePrices,
      mergeSource(cmcSource ?? cgSource, fb.sources),
      now,
    );
  }

  if (!Object.keys(prices).length) {
    const stale = readCache();
    const stalePrices: Record<string, number> = {};
    for (const id of unique) {
      const e = stale[id];
      if (e && typeof e.price === "number" && Number.isFinite(e.price) && e.price >= 0) {
        stalePrices[id] = e.price;
      }
    }
    if (Object.keys(stalePrices).length) {
      return {
        prices: stalePrices,
        missing: unique.filter((id) => stalePrices[id] === undefined),
        observedAt: quandoInCache(Object.keys(stalePrices)),
        source: "cache",
        tip: "API non disponibili: mostro l’ultimo prezzo in cache (può essere vecchio).",
      };
    }
    if (cmcFail?.kind === "rate_limit") throw cmcFail;
    if (cmcFail?.kind === "auth") throw cmcFail;
    if (cgFail?.kind === "rate_limit") throw cgFail;
    if (cmcFail?.kind === "offline") throw cmcFail;
    if (cgFail?.kind === "offline") throw cgFail;
    const noTicker = unique.filter((id) => !fallbackTickerForId(id));
    if (noTicker.length === unique.length) {
      throw new PriceFetchError(
        "unknown_symbol",
        italianPriceError("unknown_symbol", noTicker.join(", ")),
      );
    }
    throw new PriceFetchError("offline", italianPriceError("offline"));
  }

  const extras = new Set<string>(fb.sources);
  if (cgSource) extras.add(cgSource);
  const source = mergeSource(cmcSource, extras);
  const tips: string[] = [];
  if (!hasKey) tips.push(CMC_NO_KEY_TIP);
  if (cmcFail?.kind === "rate_limit") {
    tips.push("CoinMarketCap limitato (429): usati CoinGecko/Binance/Coinbase o cache.");
  } else if (cmcFail?.kind === "auth") {
    tips.push("Chiave CoinMarketCap non valida: usati CoinGecko/Binance/Coinbase o cache.");
  } else if (cmcFail?.kind === "offline") {
    tips.push("CoinMarketCap non raggiungibile: usati CoinGecko/Binance/Coinbase o cache.");
  }
  if (cgFail?.kind === "rate_limit") {
    tips.push("CoinGecko limitato (429): usati Binance/Coinbase o cache.");
  } else if (cgFail?.kind === "offline") {
    tips.push("CoinGecko non raggiungibile: usati Binance/Coinbase o cache.");
  }
  if (cmcSource && Object.keys(cmcPrices).length) {
    tips.push("Fonte: CoinMarketCap.");
  }
  if (fb.sources.has("binance") || fb.sources.has("coinbase")) {
    tips.push(
      `Fallback: ${[...fb.sources].filter((s) => s === "binance" || s === "coinbase").join(" + ")}.`,
    );
  }
  if (Object.keys(cached).length) tips.push("Parte dalla cache locale.");

  const observedAt: Record<string, number> = quandoInCache(Object.keys(cached));
  for (const id of Object.keys(livePrices)) observedAt[id] = now;
  return {
    prices,
    missing,
    observedAt,
    source:
      Object.keys(cached).length && (cmcSource || cgSource || fb.sources.size)
        ? "mixed"
        : source,
    tip: tips.length ? tips.join(" ") : undefined,
  };
}

/** @deprecated alias — usa fetchLivePricesEur (con fallback). */
export async function fetchCoinGeckoPricesEur(
  ids: string[],
  opts: LivePriceOpts = {},
): Promise<PriceFetchResult> {
  return fetchLivePricesEur(ids, opts);
}
