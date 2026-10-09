import { Download, RefreshCw, Trash2, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { AccordionGroup, AccordionItem } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input, Label, NumberField, parseNumberDraft } from "@/components/ui/input";
import { fmtIt, isIsoDate, todayIso } from "@/lib/banca";
import {
  applyFonteSnapshotToPatrimonio,
  buildFonteSnapshot,
  fetchFonteQuotaUfficiale,
  FONTE_COMPARTI,
  FONTE_CONTRIBUTI_TIPI,
  FONTE_CSV_TEMPLATE,
  FONTE_QUOTA_INDEX_URL,
  FONTE_QUOTA_URL,
  FONTE_STATI,
  fonteBreakdown,
  fonteCsvFilename,
  FonteQuotaError,
  fonteLastUpdate,
  fontePosizione,
  italianFonteQuotaError,
  labelFonteComparto,
  latestFonteSnapshot,
  parseFonteCsv,
  partizionaFonteContributi,
  partizionaFonteSnapshots,
  type FonteComparto,
  type FonteContributo,
  type FonteOrigine,
  type FontePdfExtract,
  type FonteQuotaPubblica,
  type FonteSnapshot,
} from "@/lib/fonte";
import { fonteMese } from "@/lib/quadra";
import { useQuadra } from "@/lib/store";
import { eur, money, periodoLeggibile, plurale } from "@/lib/utils";
import { nuovoId } from "@/lib/id";

export function FonteSync() {
  const {
    patrimonio,
    fonteSnapshots,
    fonteContributi,
    applyFonteSnapshot,
    addFonteSnapshots,
    addFonteContributi,
    removeFonteSnapshot,
    removeFonteContributo,
  } = useQuadra();
  const hidden = useQuadra((s) => s.nascostoSaldo);
  const pensione = fonteMese(patrimonio);
  const last = latestFonteSnapshot(fonteSnapshots);
  const br = useMemo(() => fonteBreakdown(fonteContributi), [fonteContributi]);
  const lastUp = fonteLastUpdate(fonteSnapshots, fonteContributi);

  const [data, setData] = useState(todayIso());
  const [comparto, setComparto] = useState<FonteComparto>(last?.comparto ?? "dinamico");
  const [custom, setCustom] = useState(last?.compartoCustom ?? "");
  const [quote, setQuote] = useState(last?.numeroQuote ?? 0);
  const [nav, setNav] = useState(last?.valoreQuota ?? 0);
  const [formErr, setFormErr] = useState("");
  const pos = fontePosizione(quote, nav);

  const [quotaStatus, setQuotaStatus] = useState("");
  const [quotaErr, setQuotaErr] = useState("");
  const [quotaPub, setQuotaPub] = useState<FonteQuotaPubblica | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [manualNavDraft, setManualNavDraft] = useState("");

  const [csvPaste, setCsvPaste] = useState("");
  const [csvPreview, setCsvPreview] = useState<ReturnType<typeof parseFonteCsv> | null>(null);
  const [csvMsg, setCsvMsg] = useState("");
  const [csvErr, setCsvErr] = useState("");
  const csvFileRef = useRef<HTMLInputElement>(null);

  const [pdfMsg, setPdfMsg] = useState("");
  const [pdfErr, setPdfErr] = useState("");
  const [pdfPreview, setPdfPreview] = useState<FontePdfExtract | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const pdfFileRef = useRef<HTMLInputElement>(null);

  function applyManual() {
    if (!isIsoDate(data)) {
      setFormErr("Scegli la data dell'estratto.");
      return;
    }
    if (!(quote > 0) || !(nav > 0)) {
      setFormErr("Servono il numero di quote e il valore di una quota.");
      return;
    }
    setFormErr("");
    applyFonteSnapshot(
      buildFonteSnapshot({
        data,
        comparto,
        compartoCustom: custom,
        numeroQuote: quote,
        valoreQuota: nav,
        fonte: "manuale",
      }),
    );
  }

  function downloadTemplate() {
    const blob = new Blob([FONTE_CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fonteCsvFilename();
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function previewCsv(text: string) {
    const parsed = parseFonteCsv(text);
    setCsvPreview(parsed);
    setCsvErr("");
    if (!parsed.snapshots.length && !parsed.contributi.length) {
      setCsvErr(parsed.motivi.join(" · ") || "Non ho trovato righe utili.");
    }
  }

  function confirmCsv(includeDups: boolean) {
    if (!csvPreview) return;
    const snaps = partizionaFonteSnapshots(csvPreview.snapshots, fonteSnapshots);
    const cons = partizionaFonteContributi(csvPreview.contributi, fonteContributi);
    const snapTake = includeDups ? csvPreview.snapshots : snaps.nuovi;
    const conTake = includeDups ? [...cons.nuovi, ...cons.duplicati] : cons.nuovi;
    if (snapTake.length) addFonteSnapshots(snapTake);
    if (conTake.length) addFonteContributi(conTake, includeDups);
    const latest = [...snapTake].sort((a, b) => b.data.localeCompare(a.data))[0];
    if (latest) {
      setComparto(latest.comparto);
      setCustom(latest.compartoCustom ?? "");
      setQuote(latest.numeroQuote);
      setNav(latest.valoreQuota);
      setData(latest.data);
    }
    setCsvMsg(
      `Salvati ${plurale(snapTake.length, "aggiornamento", "aggiornamenti")} e ${plurale(conTake.length, "versamento", "versamenti")}` +
        (snaps.duplicati.length || cons.duplicati.length
          ? ` · ${snaps.duplicati.length + cons.duplicati.length} doppi saltati`
          : "") +
        (csvPreview.saltate ? ` · ${csvPreview.saltate} righe saltate` : "") +
        ".",
    );
    setCsvPreview(null);
    setCsvPaste("");
  }

  async function tryOfficialNav() {
    setQuotaErr("");
    setQuotaStatus("");
    setQuotaLoading(true);
    try {
      const got = await fetchFonteQuotaUfficiale(comparto);
      setQuotaPub(got);
      setQuotaStatus(
        `Valore pubblicato per ${periodoLeggibile(got.periodo)}. Tocca «Usa questo valore» per salvarlo.`,
      );
    } catch (e) {
      if (e instanceof FonteQuotaError) setQuotaErr(e.message);
      else if (e instanceof TypeError) setQuotaErr(italianFonteQuotaError("cors"));
      else setQuotaErr(italianFonteQuotaError("offline"));
      setQuotaPub(null);
    } finally {
      setQuotaLoading(false);
    }
  }

  function applyPublicOrManualNav(valore: number, origine: FonteOrigine) {
    if (!(valore > 0)) {
      setQuotaErr("Scrivi un valore valido.");
      return;
    }
    if (!(quote > 0)) {
      setNav(valore);
      setQuotaStatus(
        `Valore ${valore.toLocaleString("it-IT", { minimumFractionDigits: 3 })} € pronto. Scrivi il numero di quote e salva: senza quote non cambio il saldo.`,
      );
      setQuotaErr("");
      return;
    }
    const snap = buildFonteSnapshot({
      data: todayIso(),
      comparto,
      compartoCustom: custom,
      numeroQuote: quote,
      valoreQuota: valore,
      fonte: origine,
    });
    applyFonteSnapshot(snap);
    setNav(valore);
    setQuotaErr("");
    setQuotaStatus(
      `Salvato: ${quote.toLocaleString("it-IT")} × ${valore.toLocaleString("it-IT", { minimumFractionDigits: 3 })} = ${eur(snap.posizione)}.`,
    );
  }

  async function onPdf(file: File) {
    setPdfErr("");
    setPdfMsg("");
    setPdfPreview(null);
    setPdfLoading(true);
    try {
      const { extractFontePdf } = await import("@/lib/fonte-pdf");
      const extracted = await extractFontePdf(file);
      setPdfPreview(extracted);
      if (extracted.confidence === "nessuna") {
        setPdfErr(
          extracted.avvisi.join(" ") ||
            "Non riesco a leggere questo PDF. Scrivi i numeri a mano o usa la tabella CSV.",
        );
      } else {
        setPdfMsg(
          "Ecco cosa ho letto. Controlla e conferma: il file non viene salvato.",
        );
      }
    } catch {
      setPdfErr(
        "Non riesco a leggere questo PDF. Scrivi i numeri a mano o usa la tabella CSV.",
      );
    } finally {
      setPdfLoading(false);
      if (pdfFileRef.current) pdfFileRef.current.value = "";
    }
  }

  function confirmPdf() {
    if (!pdfPreview) return;
    if (pdfPreview.snapshot) {
      applyFonteSnapshot({
        ...pdfPreview.snapshot,
        id: nuovoId(),
        data: pdfPreview.snapshot.data || todayIso(),
      });
      setComparto(pdfPreview.snapshot.comparto);
      setCustom(pdfPreview.snapshot.compartoCustom ?? "");
      setQuote(pdfPreview.snapshot.numeroQuote);
      setNav(pdfPreview.snapshot.valoreQuota);
      if (pdfPreview.snapshot.data) setData(pdfPreview.snapshot.data);
    }
    if (pdfPreview.contributi.length) {
      addFonteContributi(pdfPreview.contributi.map((c) => ({ ...c, data: c.data || todayIso(), id: "" })));
    }
    setPdfMsg("Salvato. Il PDF non è stato conservato.");
    setPdfPreview(null);
  }

  const officialUrl = FONTE_QUOTA_URL[comparto] ?? FONTE_QUOTA_INDEX_URL;
  const credited = br.accreditato + br.quotato;
  const nextPat = last ? applyFonteSnapshotToPatrimonio(patrimonio, last) : patrimonio;

  return (
    <AccordionGroup>
      <AccordionItem
        id="fonte-quote"
        titolo="Aggiorna quote e valore"
        sotto={last ? `Ultimo aggiornamento ${lastUp ? fmtIt(lastUp) : "—"} · ${labelFonteComparto(last)}` : "Dal tuo estratto Fon.Te"}
        destra={<span className="font-medium">{money(nextPat.fonteInvestito, hidden, 0)}</span>}
      >
        <p className="pt-2 text-sm text-muted">
          Valore = numero di quote × valore di una quota. Li trovi nell'estratto del fondo. Niente password: scrivi
          tu i numeri.
        </p>
        <form
          className="mt-3 grid gap-3"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            applyManual();
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="fs-data">Data</Label>
              <Input id="fs-data" type="date" value={data} onChange={(e) => e.target.value && setData(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="fs-comp">Linea</Label>
              <select
                id="fs-comp"
                value={comparto}
                onChange={(e) => setComparto(e.target.value as FonteComparto)}
                className="h-12 w-full rounded-xl bg-paper px-3 text-[15px] shadow-[inset_0_0_0_1px_var(--color-border)]"
              >
                {FONTE_COMPARTI.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {comparto === "custom" && (
            <Input aria-label="Nome della linea" placeholder="Nome della linea" value={custom} onChange={(e) => setCustom(e.target.value)} />
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="fonte-campo-1">Numero di quote</Label>
              <NumberField id="fonte-campo-1" value={quote} digits={4} min={0} emptyCommitsZero onCommit={setQuote} />
            </div>
            <div>
              <Label htmlFor="fonte-campo-2">Valore di una quota €</Label>
              <NumberField id="fonte-campo-2" value={nav} digits={4} min={0} emptyCommitsZero onCommit={setNav} />
            </div>
          </div>
          <p className="text-sm">
            Fa <b className="tabular-nums">{eur(pos)}</b>
          </p>
          {formErr ? (
            <p className="text-sm text-brick" role="alert">
              {formErr}
            </p>
          ) : null}
          <Button type="submit" variant="primary">
            Salva questi numeri
          </Button>
        </form>
        <div className="mt-4 border-t border-border pt-3">
          <p className="text-sm font-medium">Valore della quota di oggi</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="soft"
              disabled={quotaLoading || comparto === "custom"}
              onClick={() => void tryOfficialNav()}
            >
              <RefreshCw className={`size-4 ${quotaLoading ? "animate-spin" : ""}`} aria-hidden="true" />
              {quotaLoading ? "Leggo…" : "Leggi dal sito del fondo"}
            </Button>
            <a
              href={officialUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-pine underline"
            >
              Apri il sito
            </a>
          </div>
          {quotaPub ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span>
                {periodoLeggibile(quotaPub.periodo)}:{" "}
                {quotaPub.valore.toLocaleString("it-IT", { minimumFractionDigits: 3, maximumFractionDigits: 4 })} €
              </span>
              <Button type="button" size="sm" variant="primary" onClick={() => applyPublicOrManualNav(quotaPub.valore, "manuale")}>
                Usa questo valore
              </Button>
            </div>
          ) : null}
          {quotaStatus ? <p className="mt-2 text-sm text-pine">{quotaStatus}</p> : null}
          {quotaErr ? (
            <p className="mt-2 text-sm text-brick" role="alert">
              {quotaErr}
            </p>
          ) : null}
          <div className="mt-2 grid grid-cols-[1fr_auto] items-end gap-2">
            <div>
              <Label htmlFor="fs-nav">O scrivilo tu €</Label>
              <Input
                id="fs-nav"
                inputMode="decimal"
                placeholder="es. 12,345"
                value={manualNavDraft}
                onChange={(e) => setManualNavDraft(e.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="soft"
              onClick={() => {
                const n = parseNumberDraft(manualNavDraft);
                if (n === null || n <= 0) {
                  setQuotaErr("Scrivi un valore valido, per esempio 12,345.");
                  return;
                }
                applyPublicOrManualNav(n, "manuale");
                setManualNavDraft("");
              }}
            >
              Usa
            </Button>
          </div>
        </div>
      </AccordionItem>

      <AccordionItem
        id="fonte-contributi"
        titolo="Versamenti"
        sotto="Quanto doveva arrivare e quanto è arrivato"
        destra={<span className="font-medium">{money(credited, hidden, 0)}</span>}
      >
        <dl className="grid grid-cols-2 gap-3 pt-2 text-sm">
          <Mini label="Tuoi" value={money(br.lavoratore, hidden)} />
          <Mini label="Del datore" value={money(br.datore, hidden)} />
          <Mini label="TFR" value={money(br.tfr, hidden)} />
          <Mini label="Volontari" value={money(br.volontario, hidden)} />
          <Mini label="Dovrebbe arrivare al mese" value={money(pensione.totale, hidden)} />
          <Mini label="Arrivato (righe caricate)" value={money(credited, hidden)} />
        </dl>
        <p className="mt-2 text-xs text-muted">
          Differenza fra busta paga e versamenti caricati: {money(pensione.totale - credited, hidden)}
          {br.altro ? ` · altro ${money(br.altro, hidden)}` : ""}.
        </p>
        {fonteContributi.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-1">
            {[...fonteContributi]
              .sort((a, b) => b.data.localeCompare(a.data) || a.fonte.localeCompare(b.fonte))
              .slice(0, 12)
              .map((c) => (
                <ContributoRow
                  key={c.id}
                  c={c}
                  hidden={hidden}
                  onRemove={() => {
                    if (window.confirm(`Eliminare il versamento del ${c.data ? fmtIt(c.data) : "giorno senza data"}?`)) removeFonteContributo(c.id);
                  }}
                />
              ))}
          </ul>
        ) : null}
      </AccordionItem>

      <AccordionItem id="fonte-file" titolo="Carica dal file" sotto="Estratto PDF o tabella CSV">
        <div className="flex flex-col gap-3 pt-2">
          <Button type="button" variant="primary" disabled={pdfLoading} onClick={() => pdfFileRef.current?.click()}>
            <Upload className="size-4" aria-hidden="true" />
            {pdfLoading ? "Leggo il PDF…" : "Carica l'estratto PDF"}
          </Button>
            <input
              ref={pdfFileRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              disabled={pdfLoading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onPdf(f);
              }}
            />
          <p className="text-xs text-muted">Letto qui sul telefono e poi scartato: salvo solo i numeri che confermi.</p>
          {pdfErr ? (
            <p className="text-sm text-brick" role="alert">
              {pdfErr}
            </p>
          ) : null}
          {pdfMsg ? <p className="text-sm text-pine">{pdfMsg}</p> : null}
          {pdfPreview ? (
            <div className="rounded-2xl bg-paper p-3">
              <p className="text-xs text-muted">
                Quanto sono sicuro della lettura: {pdfPreview.confidence}
                {pdfPreview.avvisi.length ? ` · ${pdfPreview.avvisi.join(" ")}` : ""}
              </p>
              {pdfPreview.snapshot ? (
                <p className="mt-2 text-sm">
                  {pdfPreview.snapshot.data ? fmtIt(pdfPreview.snapshot.data) : "senza data"} · {labelFonteComparto(pdfPreview.snapshot)} ·{" "}
                  {pdfPreview.snapshot.numeroQuote.toLocaleString("it-IT")} quote ×{" "}
                  {pdfPreview.snapshot.valoreQuota.toLocaleString("it-IT", { minimumFractionDigits: 3 })} ={" "}
                  {eur(pdfPreview.snapshot.posizione)}
                </p>
              ) : (
                <p className="mt-2 text-sm text-muted">Non ho trovato quote e valore in modo affidabile.</p>
              )}
              {pdfPreview.contributi.length > 0 && (
                <ul className="mt-2 text-xs">
                  {pdfPreview.contributi.map((c, i) => (
                    <li key={`${c.fonte}-${i}`}>
                      {FONTE_CONTRIBUTI_TIPI.find((x) => x.id === c.fonte)?.label ?? c.fonte} {eur(c.importo)}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  variant="primary"
                  className="flex-1"
                  disabled={!pdfPreview.snapshot && !pdfPreview.contributi.length}
                  onClick={confirmPdf}
                >
                  Conferma e salva
                </Button>
                <Button type="button" variant="soft" onClick={() => setPdfPreview(null)}>
                  Annulla
                </Button>
              </div>
            </div>
          ) : null}

          <details className="rounded-2xl bg-paper p-3">
            <summary className="-m-3 block cursor-pointer p-3 text-sm font-medium">Tabella CSV</summary>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="soft" onClick={downloadTemplate}>
                <Download className="size-4" aria-hidden="true" />
                Scarica il modello
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => csvFileRef.current?.click()}>
                <Upload className="size-4" aria-hidden="true" />
                Carica
              </Button>
                <input
                  ref={csvFileRef}
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const reader = new FileReader();
                    reader.onload = () => previewCsv(String(reader.result ?? ""));
                    reader.readAsText(f);
                    e.target.value = "";
                  }}
                />
            </div>
            <textarea
              aria-label="Testo della tabella"
              className="mt-2 h-24 w-full rounded-xl bg-surface p-3 text-xs shadow-[inset_0_0_0_1px_var(--color-border)]"
              placeholder="Oppure incolla qui il testo"
              value={csvPaste}
              onChange={(e) => setCsvPaste(e.target.value)}
            />
            <Button
              type="button"
              size="sm"
              variant="soft"
              className="mt-2"
              onClick={() => (csvPaste.trim() ? previewCsv(csvPaste) : setCsvErr("Incolla o carica una tabella."))}
            >
              Guarda prima di salvare
            </Button>
            {csvErr ? (
              <p className="mt-2 text-sm text-brick" role="alert">
                {csvErr}
              </p>
            ) : null}
            {csvMsg ? <p className="mt-2 text-sm text-pine">{csvMsg}</p> : null}
            {csvPreview && (csvPreview.snapshots.length > 0 || csvPreview.contributi.length > 0) ? (
              <CsvPreview
                parsed={csvPreview}
                existingS={fonteSnapshots}
                existingC={fonteContributi}
                onConfirm={(dups) => confirmCsv(dups)}
                onCancel={() => setCsvPreview(null)}
              />
            ) : null}
          </details>
        </div>
      </AccordionItem>

      {fonteSnapshots.length > 0 ? (
        <AccordionItem id="fonte-storico" titolo="Storico" sotto={plurale(fonteSnapshots.length, "aggiornamento salvato", "aggiornamenti salvati")}>
          <ul className="flex flex-col gap-1 pt-2">
            {[...fonteSnapshots]
              .sort((a, b) => b.data.localeCompare(a.data))
              .slice(0, 12)
              .map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 rounded-xl bg-paper px-3 py-1.5 text-sm">
                  <span className="min-w-0 truncate">
                    {s.data ? fmtIt(s.data) : "—"} · {labelFonteComparto(s)} · {money(s.posizione, hidden)}
                  </span>
                  <button
                    type="button"
                    aria-label="Elimina questo aggiornamento"
                    className="flex size-11 items-center justify-center text-brick"
                    onClick={() => {
                      const ultimo = latestFonteSnapshot(fonteSnapshots)?.id === s.id;
                      if (
                        window.confirm(
                          `Eliminare l'aggiornamento del ${s.data ? fmtIt(s.data) : "giorno senza data"}?${ultimo ? " È il più recente: cambia anche il saldo del fondo." : ""}`,
                        )
                      )
                        removeFonteSnapshot(s.id);
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
          </ul>
        </AccordionItem>
      ) : null}
    </AccordionGroup>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function ContributoRow({
  c,
  hidden,
  onRemove,
}: {
  c: FonteContributo;
  hidden: boolean;
  onRemove: () => void;
}) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-xl bg-paper px-3 py-1.5 text-sm">
      <span className="min-w-0 truncate">
        {c.data ? fmtIt(c.data) : "—"}
        {c.trimestre ? ` · ${periodoLeggibile(c.trimestre)}` : ""} ·{" "}
        {FONTE_CONTRIBUTI_TIPI.find((x) => x.id === c.fonte)?.label ?? c.fonte} ·{" "}
        {FONTE_STATI.find((x) => x.id === c.stato)?.label ?? c.stato} · {money(c.importo, hidden)}
      </span>
      <button
        type="button"
        aria-label="Elimina versamento"
        className="flex size-11 items-center justify-center text-brick"
        onClick={onRemove}
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </button>
    </li>
  );
}

function CsvPreview({
  parsed,
  existingS,
  existingC,
  onConfirm,
  onCancel,
}: {
  parsed: ReturnType<typeof parseFonteCsv>;
  existingS: FonteSnapshot[];
  existingC: FonteContributo[];
  onConfirm: (includeDups: boolean) => void;
  onCancel: () => void;
}) {
  const snaps = partizionaFonteSnapshots(parsed.snapshots, existingS);
  const cons = partizionaFonteContributi(parsed.contributi, existingC);
  return (
    <div className="mt-3 rounded-2xl bg-surface p-3">
      <p className="text-sm">
        Da salvare: {plurale(snaps.nuovi.length, "aggiornamento", "aggiornamenti")}
        {snaps.duplicati.length ? ` (${snaps.duplicati.length === 1 ? "1 c'era già" : `${snaps.duplicati.length} c'erano già`})` : ""} e {plurale(cons.nuovi.length, "versamento", "versamenti")}
        {cons.duplicati.length ? ` (${cons.duplicati.length} doppi)` : ""}.
      </p>
      {parsed.motivi.length ? <p className="mt-1 text-xs text-muted">{parsed.motivi.join(" · ")}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="primary" size="sm" onClick={() => onConfirm(false)}>
          Salva i nuovi
        </Button>
        {snaps.duplicati.length + cons.duplicati.length > 0 && (
          <Button type="button" variant="soft" size="sm" onClick={() => onConfirm(true)}>
            Anche i doppi
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Annulla
        </Button>
      </div>
    </div>
  );
}
