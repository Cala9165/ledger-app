/**
 * localStorage adapter for Zustand persist.
 * Invalid JSON must never silently delete the live key: quarantine (move to .bak)
 * and surface a recovery notice. Prefer recover over wipe.
 */
export const PERSIST_NAME = "quadra-v1";

export type PersistKv = {
  getItem: (name: string) => string | null;
  setItem: (name: string, value: string) => void;
  removeItem: (name: string) => void;
};

export type PersistRecovery = {
  name: string;
  backupKey: string;
  timestampKey?: string;
  bytes: number;
  at: string;
  /** Live key still holds the raw blob; persist writes to it are blocked. */
  blocked: boolean;
  /**
   * «json»: il file non si legge. «caricamento»: si legge ma i dati non tornano.
   * «righe»: si legge, ma alcune righe non erano valide e sono rimaste fuori.
   */
  motivo?: "json" | "caricamento" | "righe";
  /** Con «righe»: quante, e in quali elenchi. */
  righe?: number;
  dove?: string[];
};

let persistRecovery: PersistRecovery | null = null;
let blockLiveWrites = false;
/** Banner dismissed while live key still holds the sole corrupt copy. */
let recoveryUiHidden = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

export function backupKeyFor(name: string): string {
  return `${name}.bak`;
}

export function noticeKeyFor(name: string): string {
  return `${name}.bak.notice`;
}

export function timestampedBackupKey(name: string, date = new Date()): string {
  const ts = date.toISOString().replace(/[:.]/g, "-");
  return `${name}.bak.${ts}`;
}

export function getPersistRecovery(): PersistRecovery | null {
  if (recoveryUiHidden) return null;
  return persistRecovery;
}

export function subscribePersistRecovery(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

export function persistLiveWritesBlocked(): boolean {
  return blockLiveWrites;
}

export function resetPersistRuntime(): void {
  persistRecovery = null;
  blockLiveWrites = false;
  recoveryUiHidden = false;
  listeners.clear();
}

function safeGet(storage: PersistKv, name: string): string | null {
  try {
    return storage.getItem(name);
  } catch {
    return null;
  }
}

function safeSet(storage: PersistKv, name: string, value: string): boolean {
  try {
    storage.setItem(name, value);
    return safeGet(storage, name) === value;
  } catch {
    return false;
  }
}

function safeRemove(storage: PersistKv, name: string): void {
  try {
    storage.removeItem(name);
  } catch {
    /* ignore */
  }
}

function saveNotice(storage: PersistKv, recovery: PersistRecovery): void {
  persistRecovery = recovery;
  blockLiveWrites = recovery.blocked;
  recoveryUiHidden = false;
  safeSet(storage, noticeKeyFor(recovery.name), JSON.stringify(recovery));
  emit();
}

function hydrateNotice(name: string, storage: PersistKv): void {
  if (persistRecovery) return;
  const raw = safeGet(storage, noticeKeyFor(name));
  if (raw == null) return;
  try {
    const parsed = JSON.parse(raw) as PersistRecovery;
    if (!parsed || typeof parsed !== "object" || typeof parsed.backupKey !== "string") {
      safeRemove(storage, noticeKeyFor(name));
      return;
    }
    const bak = safeGet(storage, parsed.backupKey);
    const live = parsed.blocked ? safeGet(storage, parsed.name ?? name) : null;
    if (bak == null && live == null) {
      safeRemove(storage, noticeKeyFor(name));
      return;
    }
    persistRecovery = {
      name: parsed.name || name,
      backupKey: parsed.backupKey,
      timestampKey: typeof parsed.timestampKey === "string" ? parsed.timestampKey : undefined,
      bytes: typeof parsed.bytes === "number" ? parsed.bytes : (bak ?? live ?? "").length,
      at: typeof parsed.at === "string" ? parsed.at : new Date().toISOString(),
      blocked: !!parsed.blocked,
      // Riaprendo l'app l'avviso deve restare quello giusto, non diventare «danneggiato».
      motivo: parsed.motivo === "json" || parsed.motivo === "caricamento" || parsed.motivo === "righe" ? parsed.motivo : undefined,
      righe: typeof parsed.righe === "number" ? parsed.righe : undefined,
      dove: Array.isArray(parsed.dove) ? parsed.dove.filter((x): x is string => typeof x === "string") : undefined,
    };
    blockLiveWrites = persistRecovery.blocked;
    recoveryUiHidden = false;
  } catch {
    safeRemove(storage, noticeKeyFor(name));
  }
}

function logQuarantine(recovery: PersistRecovery, ok: boolean): void {
  const dest = recovery.backupKey;
  if (ok) {
    console.error(
      `[Ledger] Salvataggio «${recovery.name}» non è JSON valido. Dati spostati in «${dest}» (non cancellati). Esporta dal banner in app o da localStorage.`,
    );
  } else {
    console.error(
      `[Ledger] Salvataggio «${recovery.name}» non è JSON valido e non è stato possibile spostarlo (spazio pieno?). Chiave originale intatta. Esporta subito dal banner — non sovrascrivo i dati.`,
    );
  }
}

/**
 * Move corrupt raw off the live key into `name.bak` (and a timestamped copy of
 * any previous backup). Never delete the raw string without a confirmed backup.
 * If even a move fails (quota), restore the live key and block further writes.
 */
export function quarantineCorruptPersist(
  name: string,
  raw: string,
  storage: PersistKv,
  now = new Date(),
): PersistRecovery {
  const bak = backupKeyFor(name);
  let timestampKey: string | undefined;
  const prev = safeGet(storage, bak);
  if (prev != null && prev !== raw) {
    const stamped = timestampedBackupKey(name, now);
    if (safeSet(storage, stamped, prev)) timestampKey = stamped;
  }

  const recoveryBase = {
    name,
    backupKey: bak,
    timestampKey,
    bytes: raw.length,
    at: now.toISOString(),
  };

  // Copy first (live stays until backup is confirmed).
  if (safeSet(storage, bak, raw)) {
    safeRemove(storage, name);
    const recovery: PersistRecovery = { ...recoveryBase, blocked: false };
    saveNotice(storage, recovery);
    logQuarantine(recovery, true);
    return recovery;
  }

  // Quota: move (free the live slot, then write bak).
  safeRemove(storage, name);
  if (safeSet(storage, bak, raw)) {
    const recovery: PersistRecovery = { ...recoveryBase, blocked: false };
    saveNotice(storage, recovery);
    logQuarantine(recovery, true);
    return recovery;
  }

  // Restore live — do not leave the user with neither key.
  const restored = safeSet(storage, name, raw);
  const recovery: PersistRecovery = {
    ...recoveryBase,
    backupKey: restored ? name : bak,
    blocked: true,
  };
  saveNotice(storage, recovery);
  logQuarantine(recovery, false);
  return recovery;
}

export function readPersistedRaw(name: string, storage: PersistKv): string | null {
  hydrateNotice(name, storage);
  const raw = safeGet(storage, name);
  if (raw == null) return null;
  try {
    JSON.parse(raw);
    return raw;
  } catch {
    quarantineCorruptPersist(name, raw, storage);
    return null;
  }
}

/** Dove sta la copia del salvataggio con le righe lasciate fuori: una sola, sempre la stessa. */
export function copiaRigheKeyFor(name: string): string {
  return `${name}.righe`;
}

/**
 * Il salvataggio si legge, ma alcune righe non erano valide e restano fuori. Prima che
 * la prossima scrittura le cancelli si tiene una copia dell'originale e si avvisa; l'app
 * va avanti coi dati buoni. Non blocca mai le scritture: se il telefono è pieno e la
 * copia non entra, l'avviso chiede di scaricare subito. La copia ha un posto suo (non
 * tocca le copie di un salvataggio danneggiato) e non si rifà a ogni avvio.
 */
export function segnalaRighePerse(
  name: string,
  righe: number,
  dove: string[],
  storage: PersistKv = lazyLocalStorage(),
  now = new Date(),
): void {
  if (!(righe > 0)) return;
  hydrateNotice(name, storage);
  const raw = safeGet(storage, name);
  if (raw == null) return;
  // Un avviso più grave è già aperto (file illeggibile, caricamento fallito): resta quello.
  if (persistRecovery && persistRecovery.motivo !== "righe") return;
  const copia = copiaRigheKeyFor(name);
  // Copia già tenuta per questo stesso contenuto: l'app è stata riaperta senza salvare.
  if (safeGet(storage, copia) === raw) return;
  const base = { name, bytes: raw.length, at: now.toISOString(), motivo: "righe" as const, righe, dove };
  if (safeSet(storage, copia, raw)) {
    saveNotice(storage, { ...base, backupKey: copia, blocked: false });
    console.warn(`[Ledger] ${righe} righe non valide lasciate fuori da «${name}»: copia in «${copia}».`);
    return;
  }
  // Niente spazio per la copia: si scarica la chiave viva, finché non cambia.
  saveNotice(storage, { ...base, backupKey: name, blocked: false });
  console.warn(`[Ledger] ${righe} righe non valide in «${name}» e nessuno spazio per la copia: scaricala subito.`);
}

/** Tutte le scritture ferme: serve prima di rimettere una copia e ricaricare la pagina. */
let scrittureFerme = false;
export function fermaScritture(): void {
  scrittureFerme = true;
}
/** Se il ripristino non riesce la pagina resta viva: le scritture devono ripartire. */
export function riprendiScritture(): void {
  scrittureFerme = false;
}

/**
 * Il salvataggio c'è ma non si riesce a caricarlo: l'app resta vuota in memoria e
 * non deve scriverci sopra. Si blocca la chiave e si mostra l'avviso con «Scarica».
 */
export function segnalaCaricamentoFallito(name: string, error: unknown, storage: PersistKv = lazyLocalStorage()): void {
  const raw = safeGet(storage, name);
  if (raw == null) return;
  persistRecovery = {
    name,
    backupKey: name,
    bytes: raw.length,
    at: new Date().toISOString(),
    blocked: true,
    motivo: "caricamento",
  };
  blockLiveWrites = true;
  recoveryUiHidden = false;
  console.error(`[Ledger] Salvataggio «${name}» non caricato: scritture bloccate, i dati restano intatti.`, error);
  emit();
}

export function writePersistedRaw(name: string, value: string, storage: PersistKv): void {
  if (scrittureFerme) return;
  if (blockLiveWrites && name === persistRecovery?.name) {
    console.warn(
      `[Ledger] Scrittura su «${name}» bloccata: JSON originale ancora in quella chiave. Esporta il backup prima di sovrascrivere.`,
    );
    return;
  }
  safeSet(storage, name, value);
}

export function removePersistedRaw(name: string, storage: PersistKv): void {
  if (scrittureFerme) return;
  if (blockLiveWrites && name === persistRecovery?.name) {
    console.warn(`[Ledger] Rimozione di «${name}» bloccata: JSON originale ancora lì.`);
    return;
  }
  safeRemove(storage, name);
}

export function dismissPersistRecovery(storage: PersistKv): void {
  const rec = persistRecovery;
  if (rec) safeRemove(storage, noticeKeyFor(rec.name));
  if (rec?.blocked) {
    // Sole copy still on the live key — hide banner but never unlock overwrite.
    recoveryUiHidden = true;
    emit();
    return;
  }
  persistRecovery = null;
  blockLiveWrites = false;
  recoveryUiHidden = false;
  emit();
}

export function readBackupRaw(
  storage: PersistKv,
  recovery: PersistRecovery | null = persistRecovery,
): string | null {
  if (!recovery) return null;
  const fromBak = safeGet(storage, recovery.backupKey);
  if (fromBak != null) return fromBak;
  if (recovery.blocked) return safeGet(storage, recovery.name);
  return null;
}

export function downloadPersistBackup(storage: PersistKv): boolean {
  const raw = readBackupRaw(storage);
  const recovery = persistRecovery;
  if (raw == null || !recovery) return false;
  try {
    const blob = new Blob([raw], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const day = recovery.at.slice(0, 10) || "backup";
    a.download = `ledger-${recovery.name}-${day}.json`;
    a.rel = "noopener";
    a.click();
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}

function lazyLocalStorage(): PersistKv {
  return {
    getItem: (n) => {
      try {
        return localStorage.getItem(n);
      } catch {
        return null;
      }
    },
    setItem: (n, v) => {
      localStorage.setItem(n, v);
    },
    removeItem: (n) => {
      localStorage.removeItem(n);
    },
  };
}

/** Zustand `createJSONStorage(() => …)` adapter. */
export function createQuadraPersistKv(storage: PersistKv = lazyLocalStorage()): PersistKv {
  return {
    getItem: (name) => readPersistedRaw(name, storage),
    setItem: (name, value) => writePersistedRaw(name, value, storage),
    removeItem: (name) => removePersistedRaw(name, storage),
  };
}

export function browserPersistKv(): PersistKv {
  return lazyLocalStorage();
}
