import { createFileRoute } from "@tanstack/react-router";
import { Archive, ArchiveRestore, FileUp, Link2, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Info } from "@/components/info";
import { AccordionGroup, AccordionItem } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, Cifra, Riga, Segmenti, Vuoto } from "@/components/ui/card";
import { Input, Label, parseNumberDraft } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import {
  dupKey,
  extentDate,
  fmtIt,
  isIsoDate,
  isVariabile,
  isoData,
  movKey,
  parseCsvMovimentiDetailed,
  partizionaCsv,
  todayIso,
  type Movimento,
  type MovimentoClassificato,
} from "@/lib/banca";
import { LOCKED_CATS, assegnabili, labelCat, opzioniCat } from "@/lib/categorie";
import { contiDelMese, movimentiClassificati } from "@/lib/conti";
import { VOCI } from "@/lib/nomi";
import { useQuadra } from "@/lib/store";
import { cn, money, plurale } from "@/lib/utils";

export const Route = createFileRoute("/banca")({ component: BancaPage });

const MESI = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];
const nomeMese = (yyyymm: string) => `${MESI[Number(yyyymm.slice(5, 7)) - 1] ?? yyyymm} ${yyyymm.slice(0, 4)}`;

/** Oltre questa soglia un gruppo aperto mostra «Mostra altri»: niente pagine da foglio Excel. */
const RIGHE_PER_GRUPPO = 25;

type Vista = "mese" | "categoria";

function BancaPage() {
  const state = useQuadra();
  const {
    csvMovimenti,
    csvMeta,
    setCsv,
    clearCsv,
    categorieCustom,
    categorieNascoste,
    nascostoSaldo: hidden,
  } = state;
  const classified = useMemo(
    () => movimentiClassificati(state),
    [
      state.csvMovimenti,
      state.regole,
      state.categorieNascoste,
      state.movimentiManuali,
      state.overrideCat,
      state.movimentiArchiviati,
    ],
  );
  const c = contiDelMese(state, classified);
  const oggi = c.oggi;
  const [vista, setVista] = useState<Vista>("mese");
  const [avviso, setAvviso] = useState("");
  const [errore, setErrore] = useState("");
  const [duplicati, setDuplicati] = useState<Movimento[]>([]);
  const [aperto, setAperto] = useState<MovimentoClassificato | null>(null);
  const [aMano, setAMano] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const attivi = classified.filter((m) => !m.archiviato);
  const archiviati = classified.filter((m) => m.archiviato);
  const daSistemare = attivi.filter((m) => m.cat === "da_classificare");

  const perMese = useMemo(() => {
    const map = new Map<string, MovimentoClassificato[]>();
    for (const m of attivi) {
      const d = isoData(m.data);
      const k = isIsoDate(d) ? d.slice(0, 7) : "????";
      map.set(k, [...(map.get(k) ?? []), m]);
    }
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([mese, righe]) => ({
        mese,
        righe: righe.sort((a, b) => isoData(b.data).localeCompare(isoData(a.data))),
        // Il mese in corso si conta fino a oggi, come «Questo mese» in alto.
        spese: righe
          .filter((m) => isVariabile(m) && isoData(m.data) <= oggi)
          .reduce((s, m) => s + m.importo, 0),
      }));
  }, [attivi, oggi]);

  const perCategoria = useMemo(() => {
    const map = new Map<string, MovimentoClassificato[]>();
    // «Da sistemare» ha già il suo gruppo in cima: qui non si ripete.
    for (const m of attivi) {
      if (m.cat === "da_classificare") continue;
      map.set(m.cat, [...(map.get(m.cat) ?? []), m]);
    }
    return [...map.entries()]
      .map(([cat, righe]) => ({
        cat,
        righe: righe.sort((a, b) => isoData(b.data).localeCompare(isoData(a.data))),
        tot: righe.reduce((s, m) => s + (m.segno === "uscita" ? m.importo : 0), 0),
      }))
      .sort((a, b) => Number(LOCKED_CATS.has(a.cat)) - Number(LOCKED_CATS.has(b.cat)) || b.tot - a.tot);
  }, [attivi]);

  function ingest(text: string, conDuplicati = false) {
    setErrore("");
    setAvviso("");
    if (conDuplicati) {
      const merged = [...csvMovimenti, ...duplicati];
      const ext = extentDate(merged);
      setCsv(merged, { dal: ext.min, al: ext.max, n: merged.length, when: todayIso() });
      setAvviso(`Aggiunti anche ${plurale(duplicati.length, "movimento doppio", "movimenti doppi")}.`);
      setDuplicati([]);
      return;
    }
    const { movimenti: letti, saltate } = parseCsvMovimentiDetailed(text);
    if (!letti.length) {
      setErrore(
        "Non ho trovato movimenti in questo file. Serve l'estratto conto in formato CSV (dall'app o dal sito della banca).",
      );
      return;
    }
    const { nuovi, duplicati: dup } = partizionaCsv(letti, csvMovimenti);
    setDuplicati(dup);
    if (!nuovi.length) {
      setAvviso(`Niente di nuovo: ${plurale(dup.length, "movimento c'era già", "movimenti c'erano già")}.`);
      return;
    }
    const merged = [...csvMovimenti, ...nuovi];
    const ext = extentDate(merged);
    setCsv(merged, { dal: ext.min, al: ext.max, n: merged.length, when: todayIso() });
    const extra = [
      dup.length ? (dup.length === 1 ? "1 c'era già" : `${dup.length} c'erano già`) : "",
      saltate ? plurale(saltate, "riga illeggibile saltata", "righe illeggibili saltate") : "",
    ].filter(Boolean);
    setAvviso(
      `Caricati ${plurale(nuovi.length, "movimento", "movimenti")} dal ${fmtIt(ext.min)} al ${fmtIt(ext.max)}.${extra.length ? ` (${extra.join(", ")})` : ""}`,
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-center gap-1.5">
          <h1 className="text-sm font-normal text-muted">{VOCI.dalConto.nome} · al mese</h1>
          <Info voce="dalConto" />
        </div>
        <Cifra size="2xl" className="mt-1">
          {c.haDalConto ? money(c.dalConto, hidden, 0) : "—"}
        </Cifra>
        <p className="mt-1 text-sm text-muted">
          {c.haDalConto
            ? `Questo mese: ${money(c.periodo.tot, hidden)} in ${plurale(c.periodo.giorni, "giorno", "giorni")}, ${plurale(c.periodo.n, "spesa", "spese")}.`
            : "Nessuna spesa caricata per questo mese: non la invento."}
        </p>
        <Button variant="primary" className="mt-4 w-full" onClick={() => fileRef.current?.click()}>
          <FileUp className="size-4" aria-hidden="true" />
          Carica estratto
        </Button>
        <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-muted">
          <Link2 className="size-3.5" aria-hidden="true" />
          Prossimamente: collega la banca
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            const r = new FileReader();
            r.onload = () => ingest(String(r.result ?? ""));
            r.readAsText(f);
          }}
        />
        <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => setAMano(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Aggiungi una spesa a mano
        </Button>
      </Card>

      {avviso || errore ? (
        <div
          className={cn("rounded-2xl p-4 text-sm", errore ? "bg-brick-2 text-brick" : "bg-pine-2 text-ink")}
          role={errore ? "alert" : "status"}
        >
          <p>{errore || avviso}</p>
          {!errore && duplicati.length > 0 ? (
            <Button variant="outline" size="sm" className="mt-2" onClick={() => ingest("", true)}>
              {duplicati.length === 1 ? "Aggiungi comunque il doppione" : `Aggiungi comunque i ${duplicati.length} doppi`}
            </Button>
          ) : null}
        </div>
      ) : null}

      {classified.length === 0 ? (
        <Vuoto>
          Nessun movimento. Scarica l'estratto conto in CSV dalla tua banca e caricalo qui: servono almeno i giorni
          di questo mese.
        </Vuoto>
      ) : (
        <>
          <Segmenti
            label="Raggruppa i movimenti"
            valore={vista}
            onChange={setVista}
            opzioni={[
              { id: "mese", label: "Per mese" },
              { id: "categoria", label: "Per categoria" },
            ]}
          />
          <AccordionGroup key={vista}>
            {daSistemare.length > 0 ? (
              <AccordionItem
                id="__sistemare"
                tono="attenzione"
                titolo="Da sistemare"
                sotto="Movimenti senza categoria"
                destra={<span className="font-medium text-amber">{daSistemare.length}</span>}
              >
                <DaSistemare righe={daSistemare} hidden={hidden} />
              </AccordionItem>
            ) : null}
            {vista === "mese"
              ? perMese.map((g) => (
                  <AccordionItem
                    key={g.mese}
                    id={g.mese}
                    titolo={g.mese === "????" ? "Senza data" : nomeMese(g.mese)}
                    sotto={plurale(g.righe.length, "movimento", "movimenti")}
                    destra={<span className="font-medium">{money(g.spese, hidden, 0)}</span>}
                  >
                    <p className="mb-1 text-xs text-muted">A destra: le spese di tutti i giorni del mese.</p>
                    <ElencoMovimenti righe={g.righe} hidden={hidden} onApri={setAperto} conCategoria />
                  </AccordionItem>
                ))
              : perCategoria.map((g) => (
                  <AccordionItem
                    key={g.cat}
                    id={g.cat}
                    titolo={labelCat(g.cat, categorieCustom, categorieNascoste)}
                    sotto={plurale(g.righe.length, "movimento", "movimenti")}
                    destra={<span className="font-medium">{money(g.tot, hidden, 0)}</span>}
                  >
                    <ElencoMovimenti righe={g.righe} hidden={hidden} onApri={setAperto} />
                    {categorieCustom.some((x) => x.id === g.cat) ? <GestisciCategoria id={g.cat} /> : null}
                  </AccordionItem>
                ))}
            {archiviati.length > 0 ? (
              <AccordionItem id="__archiviati" titolo="Archiviati" sotto="Non contano nella media">
                <ElencoMovimenti righe={archiviati} hidden={hidden} onApri={setAperto} conCategoria />
              </AccordionItem>
            ) : null}
            <AccordionItem id="__estratto" titolo="Estratto caricato" sotto={csvMeta ? plurale(csvMeta.n, "movimento", "movimenti") : "Strumenti"}>
              <StrumentiEstratto
                csvN={csvMovimenti.length}
                meta={csvMeta}
                onIncolla={(t) => ingest(t)}
                onSvuota={() => {
                  if (window.confirm(`Togliere ${csvMovimenti.length === 1 ? "il movimento caricato" : `i ${csvMovimenti.length} movimenti caricati`}? Le spese a mano restano.`)) {
                    clearCsv();
                    setDuplicati([]);
                    setAvviso("Estratto tolto. Le spese a mano restano.");
                  }
                }}
              />
            </AccordionItem>
          </AccordionGroup>
        </>
      )}

      {classified.length === 0 ? (
        <StrumentiEstratto csvN={0} meta={null} onIncolla={(t) => ingest(t)} onSvuota={() => {}} soloIncolla />
      ) : null}

      {aperto ? <SchedaMovimento m={aperto} onClose={() => setAperto(null)} /> : null}
      <ModuloManuale open={aMano} onClose={() => setAMano(false)} />
    </div>
  );
}

function ElencoMovimenti({
  righe,
  hidden,
  onApri,
  conCategoria,
}: {
  righe: MovimentoClassificato[];
  hidden: boolean;
  onApri: (m: MovimentoClassificato) => void;
  conCategoria?: boolean;
}) {
  const { categorieCustom, categorieNascoste } = useQuadra();
  const [tutte, setTutte] = useState(false);
  const visibili = tutte ? righe : righe.slice(0, RIGHE_PER_GRUPPO);
  return (
    <>
      <ul className="divide-y divide-border">
        {visibili.map((m, i) => (
          <li key={`${m.manualeId ?? m.rowKey ?? dupKey(m)}-${i}`}>
            <Riga
              titolo={m.descrizione}
              sotto={[
                fmtIt(m.data),
                conCategoria ? labelCat(m.cat, categorieCustom, categorieNascoste) : "",
                m.manualeId ? "a mano" : "",
              ]
                .filter(Boolean)
                .join(" · ")}
              importo={`${m.segno === "entrata" ? "+" : "−"}${money(m.importo, hidden)}`}
              tono={m.archiviato ? "spento" : m.segno === "entrata" ? "positivo" : undefined}
              onClick={() => onApri(m)}
            />
          </li>
        ))}
      </ul>
      {righe.length > visibili.length ? (
        <Button variant="soft" size="sm" className="mt-2 w-full" onClick={() => setTutte(true)}>
          Mostra altri {righe.length - visibili.length}
        </Button>
      ) : null}
    </>
  );
}

function useAssegna() {
  const { updateMovimento, setOverride } = useQuadra();
  return (m: MovimentoClassificato, cat: string) => {
    if (m.manualeId) {
      updateMovimento(m.manualeId, { cat });
      return;
    }
    setOverride(movKey(m), cat, cat === "da_classificare" ? undefined : m.descrizione);
  };
}

function DaSistemare({ righe, hidden }: { righe: MovimentoClassificato[]; hidden: boolean }) {
  const { categorieCustom, categorieNascoste } = useQuadra();
  const assegna = useAssegna();
  const chips = assegnabili(categorieCustom, categorieNascoste);
  const [nuova, setNuova] = useState(false);
  return (
    <div className="flex flex-col gap-3 pt-2">
      <p className="text-xs text-muted">
        Tocca una categoria: la prossima volta i movimenti dello stesso negozio vanno lì da soli.
      </p>
      {righe.slice(0, 10).map((m, i) => (
        <div key={`${m.rowKey ?? m.manualeId ?? i}`} className="rounded-2xl bg-paper p-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="min-w-0 break-words text-[15px] font-medium">{m.descrizione}</p>
            <p className="shrink-0 tabular-nums">{money(m.importo, hidden)}</p>
          </div>
          <p className="text-xs text-muted">{fmtIt(m.data)}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {chips.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => assegna(m, cat.id)}
                className="min-h-11 rounded-full bg-surface px-3 text-sm shadow-[var(--shadow-border)]"
              >
                {cat.label}
              </button>
            ))}
            {(["fissa", "prelievo", "entrata"] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => assegna(m, id)}
                className="min-h-11 rounded-full px-3 text-sm text-muted shadow-[var(--shadow-border)]"
              >
                {labelCat(id)}
              </button>
            ))}
          </div>
        </div>
      ))}
      {righe.length > 10 ? <p className="text-xs text-muted">E altri {righe.length - 10}: sistemali un po' alla volta.</p> : null}
      <Button variant="soft" size="sm" onClick={() => setNuova(true)}>
        <Plus className="size-4" aria-hidden="true" />
        Nuova categoria
      </Button>
      <NuovaCategoria open={nuova} onClose={() => setNuova(false)} />
    </div>
  );
}

function NuovaCategoria({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addCategoria = useQuadra((s) => s.addCategoria);
  const [nome, setNome] = useState("");
  const [err, setErr] = useState("");
  function salva() {
    if (!nome.trim()) return setErr("Scrivi un nome.");
    addCategoria(nome);
    setNome("");
    setErr("");
    onClose();
  }
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Nuova categoria"
      footer={
        <Button variant="primary" className="w-full" onClick={salva}>
          Aggiungi
        </Button>
      }
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          salva();
        }}
      >
        <Label htmlFor="bcat">Nome</Label>
        <Input id="bcat" value={nome} placeholder="Es. Regali, Sport" onChange={(e) => setNome(e.target.value)} />
        {err ? (
          <p className="mt-2 text-sm text-brick" role="alert">
            {err}
          </p>
        ) : null}
      </form>
    </Sheet>
  );
}

function GestisciCategoria({ id }: { id: string }) {
  const { categorieCustom, renameCategoria, removeCategoria } = useQuadra();
  const cat = categorieCustom.find((c) => c.id === id);
  const [rinomina, setRinomina] = useState(false);
  const [nome, setNome] = useState(cat?.label ?? "");
  if (!cat) return null;
  return (
    <div className="mt-2 flex gap-2">
      <Button variant="soft" size="sm" className="flex-1" onClick={() => setRinomina(true)}>
        <Pencil className="size-3.5" aria-hidden="true" />
        Rinomina
      </Button>
      <Button
        variant="dangerSoft"
        size="sm"
        aria-label={`Elimina la categoria ${cat.label}`}
        onClick={() => {
          if (window.confirm(`Eliminare «${cat.label}»? I movimenti tornano da sistemare.`)) removeCategoria(id);
        }}
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </Button>
      <Sheet
        open={rinomina}
        onClose={() => setRinomina(false)}
        title="Rinomina categoria"
        footer={
          <Button
            variant="primary"
            className="w-full"
            onClick={() => {
              renameCategoria(id, nome);
              setRinomina(false);
            }}
          >
            Salva
          </Button>
        }
      >
        <Label htmlFor="rcat">Nome</Label>
        <Input id="rcat" value={nome} onChange={(e) => setNome(e.target.value)} />
      </Sheet>
    </div>
  );
}

function SchedaMovimento({ m, onClose }: { m: MovimentoClassificato; onClose: () => void }) {
  const { categorieCustom, categorieNascoste, setManualeArchiviato, setCsvArchiviato, removeMovimento, nascostoSaldo } =
    useQuadra();
  const assegna = useAssegna();
  const opzioni = opzioniCat(categorieCustom, categorieNascoste);
  const [cat, setCat] = useState(m.cat);
  function archivia(v: boolean) {
    if (m.manualeId) setManualeArchiviato(m.manualeId, v);
    else setCsvArchiviato(m.rowKey ?? dupKey(m), v);
    onClose();
  }
  return (
    <Sheet
      open
      onClose={onClose}
      title={m.descrizione}
      footer={
        <div className="flex gap-2">
          {m.manualeId ? (
            <Button
              variant="dangerSoft"
              aria-label="Elimina"
              onClick={() => {
                if (window.confirm("Eliminare questa spesa scritta a mano?")) {
                  removeMovimento(m.manualeId!);
                  onClose();
                }
              }}
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          ) : null}
          <Button variant="soft" className="flex-1" onClick={() => archivia(!m.archiviato)}>
            {m.archiviato ? (
              <ArchiveRestore className="size-4" aria-hidden="true" />
            ) : (
              <Archive className="size-4" aria-hidden="true" />
            )}
            {m.archiviato ? "Rimetti nei conti" : "Archivia"}
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            onClick={() => {
              if (cat !== m.cat) assegna(m, cat);
              onClose();
            }}
          >
            Salva
          </Button>
        </div>
      }
    >
      <p className="text-3xl font-semibold tabular-nums">
        {m.segno === "entrata" ? "+" : "−"}
        {money(m.importo, nascostoSaldo)}
      </p>
      <p className="mt-1 text-sm text-muted">
        {fmtIt(m.data)} · {m.manualeId ? "scritta a mano" : "dall'estratto"}
        {m.archiviato ? " · archiviata, non conta" : ""}
      </p>
      <div className="mt-5">
        <Label htmlFor="mcat">Categoria</Label>
        <select
          id="mcat"
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          className="h-12 w-full rounded-xl bg-paper px-3 text-[15px] shadow-[inset_0_0_0_1px_var(--color-border)]"
        >
          {opzioni.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs text-muted">
          «Fissa», «Prelievo» ed «Entrata» non contano nelle spese di tutti i giorni. Archivia per toglierla dai conti
          senza cancellarla.
        </p>
      </div>
    </Sheet>
  );
}

function ModuloManuale({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { categorieCustom, categorieNascoste, addMovimento } = useQuadra();
  const chips = assegnabili(categorieCustom, categorieNascoste);
  const [data, setData] = useState(todayIso());
  const [descrizione, setDescrizione] = useState("");
  const [importo, setImporto] = useState("");
  // Si parte da «da sistemare»: una categoria vera scelta da sola sarebbe inventata.
  const [catScelta, setCat] = useState("da_classificare");
  const cat = catScelta === "da_classificare" || chips.some((c) => c.id === catScelta) ? catScelta : "da_classificare";
  const [err, setErr] = useState("");
  function salva() {
    if (!descrizione.trim()) return setErr("Scrivi cosa hai comprato.");
    if (!isIsoDate(data)) return setErr("Scegli una data.");
    const n = parseNumberDraft(importo);
    if (n === null || n <= 0) return setErr("Scrivi l'importo, per esempio 12,50.");
    addMovimento({ data, descrizione: descrizione.trim(), importo: Math.round(n * 100) / 100, segno: "uscita", cat });
    setDescrizione("");
    setImporto("");
    setErr("");
    onClose();
  }
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Spesa a mano"
      footer={
        <Button variant="primary" className="w-full" onClick={salva}>
          Salva
        </Button>
      }
    >
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          salva();
        }}
      >
        <div>
          <Label htmlFor="md">Cosa</Label>
          <Input id="md" value={descrizione} placeholder="Es. Mercato" onChange={(e) => setDescrizione(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="mdata">Quando</Label>
            <Input id="mdata" type="date" value={data} onChange={(e) => e.target.value && setData(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="mimp">Importo €</Label>
            <Input id="mimp" inputMode="decimal" placeholder="12,50" value={importo} onChange={(e) => setImporto(e.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor="mcat2">Categoria</Label>
          <select
            id="mcat2"
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            className="h-12 w-full rounded-xl bg-paper px-3 text-[15px] shadow-[inset_0_0_0_1px_var(--color-border)]"
          >
            <option value="da_classificare">Nessuna categoria (da sistemare)</option>
            {chips.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-muted">Resta anche quando carichi un estratto nuovo.</p>
        {err ? (
          <p className="text-sm text-brick" role="alert">
            {err}
          </p>
        ) : null}
      </form>
    </Sheet>
  );
}

function StrumentiEstratto({
  csvN,
  meta,
  onIncolla,
  onSvuota,
  soloIncolla,
}: {
  csvN: number;
  meta: { dal: string; al: string; n: number } | null;
  onIncolla: (t: string) => void;
  onSvuota: () => void;
  soloIncolla?: boolean;
}) {
  const [testo, setTesto] = useState("");
  return (
    <div className="flex flex-col gap-3 pt-2">
      {!soloIncolla && meta ? (
        <p className="text-sm text-muted">
          {plurale(meta.n, "movimento", "movimenti")} dal {fmtIt(meta.dal)} al {fmtIt(meta.al)}. I doppi (stessa data, descrizione e importo)
          non vengono ricaricati.
        </p>
      ) : null}
      <details className="rounded-2xl bg-paper p-3">
        <summary className="-m-3 block cursor-pointer p-3 text-sm font-medium">Incolla il testo dell'estratto</summary>
        <textarea
          aria-label="Testo dell'estratto conto"
          className="mt-2 h-24 w-full rounded-xl bg-surface p-3 text-xs shadow-[inset_0_0_0_1px_var(--color-border)]"
          value={testo}
          onChange={(e) => setTesto(e.target.value)}
        />
        <Button
          variant="soft"
          size="sm"
          className="mt-2"
          disabled={!testo.trim()}
          onClick={() => {
            onIncolla(testo);
            setTesto("");
          }}
        >
          Leggi
        </Button>
      </details>
      {!soloIncolla && csvN > 0 ? (
        <Button variant="dangerSoft" size="sm" onClick={onSvuota}>
          Togli l'estratto caricato ({csvN})
        </Button>
      ) : null}
    </div>
  );
}
