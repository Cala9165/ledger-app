export type Categoria = { id: string; label: string };

export const SPESA_CATS: Categoria[] = [
  { id: "gatto", label: "Animali" },
  { id: "spesa", label: "Spesa" },
  { id: "bar", label: "Bar" },
  { id: "ristoranti", label: "Ristoranti" },
  { id: "libreria", label: "Libreria" },
  { id: "mobilita", label: "Mobilità" },
  { id: "salute", label: "Salute" },
  { id: "abbonamenti", label: "Abbonamenti" },
  { id: "prelievo", label: "Prelievo" },
  { id: "fissa", label: "Fissa" },
  { id: "entrata", label: "Entrata" },
  { id: "da_classificare", label: "Da sistemare" },
];

export const LOCKED_CATS = new Set(["prelievo", "fissa", "entrata", "da_classificare"]);

export type Regola = { needle: string; cat: string };

/** Regole generiche, valide per chiunque. Quelle personali stanno nelle regole dell utente. */
export const REGOLE_DEFAULT: Regola[] = [
  { needle: "zooplus", cat: "gatto" },
  { needle: "arcaplanet", cat: "gatto" },
  { needle: "aldi", cat: "spesa" },
  { needle: "coop", cat: "spesa" },
  { needle: "frutta", cat: "spesa" },
  { needle: "alimentari", cat: "spesa" },
  { needle: "justeat", cat: "ristoranti" },
  { needle: "ristorante", cat: "ristoranti" },
  { needle: "trattoria", cat: "ristoranti" },
  { needle: "pizz", cat: "ristoranti" },
  { needle: "gelateria", cat: "ristoranti" },
  { needle: "forno", cat: "ristoranti" },
  { needle: "fornetto", cat: "ristoranti" },
  { needle: "libreria", cat: "libreria" },
  { needle: "mondadori", cat: "libreria" },
  { needle: "feltrinelli", cat: "libreria" },
  { needle: "pasticceria", cat: "bar" },
  { needle: "bar ", cat: "bar" },
  { needle: "bar", cat: "bar" },
  { needle: "caffe", cat: "bar" },
  { needle: "caffè", cat: "bar" },
  { needle: "cafe ", cat: "bar" },
  { needle: "mobilita", cat: "mobilita" },
  { needle: "farmacia", cat: "salute" },
  { needle: "netflix", cat: "fissa" },
  { needle: "google one", cat: "abbonamenti" },
  { needle: "prel.", cat: "prelievo" },
  { needle: "prelievo", cat: "prelievo" },
  { needle: "vers. cont", cat: "entrata" },
];

export function merchantKey(descrizione: string): string {
  return descrizione
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9àèéìòù *&'.#-]+/g, " ")
    .trim()
    .slice(0, 40);
}

export function slugCat(label: string): string {
  const s = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return s || `cat-${Date.now().toString(36)}`;
}

/** Built-in category ids (incl. locked). */
export function builtinCatIds(): Set<string> {
  return new Set(SPESA_CATS.map((c) => c.id));
}

/**
 * Slug for a new category label.
 * Reuses built-in / existing custom ids (caller unhides).
 * If the slug is taken by a *different* custom label intent is impossible to
 * distinguish — we still reuse. Only mint -2/-3 when base is free of builtins
 * but somehow reserved (should not happen with current store).
 */
export function allocCatId(label: string, existingCustom: Categoria[]): string {
  const base = slugCat(label);
  if (builtinCatIds().has(base)) return base;
  if (existingCustom.some((c) => c.id === base)) return base;
  return base;
}


export function isLocked(id: string): boolean {
  return LOCKED_CATS.has(id);
}

export function tutteCategorie(extra: Categoria[] = [], nascoste: string[] = []): Categoria[] {
  const hide = new Set(nascoste);
  const seen = new Set(SPESA_CATS.map((c) => c.id));
  const more = extra.filter((c) => !seen.has(c.id) && !hide.has(c.id));
  const lock = SPESA_CATS.filter((c) => LOCKED_CATS.has(c.id));
  const open = SPESA_CATS.filter((c) => !LOCKED_CATS.has(c.id) && !hide.has(c.id));
  return [...open, ...more, ...lock];
}

export function assegnabili(extra: Categoria[] = [], nascoste: string[] = []): Categoria[] {
  return tutteCategorie(extra, nascoste).filter((c) => !LOCKED_CATS.has(c.id));
}

/** Categorie nel menu a tendina: quelle tue + togli/fissa/prelievo. */
export function opzioniCat(extra: Categoria[] = [], nascoste: string[] = []): Categoria[] {
  return [
    ...assegnabili(extra, nascoste),
    { id: "fissa", label: "Fissa" },
    { id: "prelievo", label: "Prelievo" },
    { id: "entrata", label: "Entrata" },
    { id: "da_classificare", label: "Nessuna categoria (da sistemare)" },
  ];
}

export function classifica(
  descrizione: string,
  segno: "uscita" | "entrata",
  extra: Regola[] = [],
  nascoste: string[] = [],
): string {
  if (segno === "entrata") return "entrata";
  const d = descrizione.toLowerCase();
  const hide = new Set(nascoste);
  for (const r of extra) {
    if (hide.has(r.cat)) continue;
    if (d.includes(r.needle.toLowerCase())) return r.cat;
  }
  for (const r of REGOLE_DEFAULT) {
    if (hide.has(r.cat)) continue;
    if (d.includes(r.needle.toLowerCase())) return r.cat;
  }
  return "da_classificare";
}

export function labelCat(id: string, extra: Categoria[] = [], nascoste: string[] = []): string {
  return tutteCategorie(extra, nascoste).find((c) => c.id === id)?.label ?? id;
}
