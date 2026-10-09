import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { FonteSync } from "@/components/fonte-sync";
import { Info } from "@/components/info";
import { AccordionGroup, AccordionItem } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, Cifra, Riga, Segmenti, Vuoto } from "@/components/ui/card";
import { Input, Label, NumberField, parseNumberDraft } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { fmtIt, isIsoDate, todayIso } from "@/lib/banca";
import { equityCasa, valoreEffettivo, withImmobile } from "@/lib/casa";
import { VOCI } from "@/lib/nomi";
import {
  coinGeckoId,
  fetchLivePricesEur,
  isPriceCacheFresh,
  italianPriceError,
  patchDaPrezzi,
  PriceFetchError,
} from "@/lib/prezzi";
import {
  capitaleVersato,
  debitoCapitale,
  equity,
  fonteMese,
  invTransazioni,
  pnlLatente,
  type Investimento,
  type InvTransazione,
  type InvTransazioneTipo,
} from "@/lib/quadra";
import { useQuadra } from "@/lib/store";
import { eur, money, pct } from "@/lib/utils";

export const Route = createFileRoute("/patrimonio")({ component: QuantoHaiPage });

const TIPI: { id: Investimento["tipo"]; label: string }[] = [
  { id: "azioni", label: "Azioni" },
  { id: "crypto", label: "Cripto" },
  { id: "altro", label: "Altro" },
];

const TXN_TIPI: { id: InvTransazioneTipo; label: string }[] = [
  { id: "acquisto", label: "Acquisto" },
  { id: "vendita", label: "Vendita" },
  { id: "versamento", label: "Versamento" },
  { id: "prelievo", label: "Prelievo" },
];

function nomeFonte(n?: string) {
  return n && n.trim() ? n.trim() : "Fon.Te";
}

function useAggiornaPrezzi() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const busy = useRef(false);
  const aggiorna = useCallback(async (mode: "manual" | "auto" = "manual") => {
    const auto = mode === "auto";
    if (busy.current) return;
    const { investimenti: invs, updateInvestimento: patchInv } = useQuadra.getState();
    const idByInv = new Map<string, string>();
    for (const i of invs) {
      if (i.tipo !== "crypto" && i.tipo !== "azioni") continue;
      const id = coinGeckoId(i.simbolo) || coinGeckoId(i.note) || coinGeckoId(i.nome);
      if (id) idByInv.set(i.id, id);
    }
    if (!idByInv.size) {
      if (!auto) setErr("Per aggiornare il prezzo serve il simbolo (es. BTC) e la quantità.");
      return;
    }
    const ids = [...new Set(idByInv.values())];
    if (auto && isPriceCacheFresh(ids)) return;
    busy.current = true;
    if (!auto) {
      setErr("");
      setOk("");
      setLoading(true);
    }
    try {
      const risposta = await fetchLivePricesEur(ids);
      const { missing, source } = risposta;
      const patch = patchDaPrezzi(invs, idByInv, risposta);
      for (const { id, patch: p } of patch) patchInv(id, p);
      const n = patch.length;
      if (n === 0) setErr(missing.length ? italianPriceError("unknown_symbol", missing.join(", ")) : italianPriceError("empty"));
      else if (!auto && source === "cache")
        setOk("I listini non rispondono: restano i prezzi dell'ultimo aggiornamento riuscito, con la loro data.");
      else if (!auto) setOk(`Prezzi aggiornati${missing.length ? ` · non trovati: ${missing.join(", ")}` : ""}.`);
    } catch (e) {
      if (!auto) setErr(e instanceof PriceFetchError ? e.message : italianPriceError("offline"));
    } finally {
      busy.current = false;
      if (!auto) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void aggiorna("auto");
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void aggiorna("auto");
    }, 7 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [aggiorna]);
  return { aggiorna, loading, err, ok };
}

function QuantoHaiPage() {
  const { patrimonio, setPatrimonio, investimenti, immobili, nascostoSaldo: hidden } = useQuadra();
  const eq = equity(patrimonio, immobili, investimenti);
  const fondi = investimenti.filter((i) => i.tipo === "fondo");
  const altri = investimenti.filter((i) => i.tipo !== "fondo");
  const fonteOn = patrimonio.fonteAttivo === true;
  const totFondi = fondi.reduce((s, i) => s + i.valore, 0) + (fonteOn ? patrimonio.fonteTotale : 0);
  const nFondi = fondi.length + (fonteOn ? 1 : 0);
  const totAltri = altri.reduce((s, i) => s + i.valore, 0);
  const caseTot = immobili.reduce((s, i) => s + valoreEffettivo(withImmobile(patrimonio, i)), 0);
  const debiti = debitoCapitale(patrimonio, immobili);
  const prezzi = useAggiornaPrezzi();
  const [nuovo, setNuovo] = useState<Investimento["tipo"] | null>(null);
  const [apri, setApri] = useState<Investimento | null>(null);
  const [fonteAperta, setFonteAperta] = useState(false);
  const [sceltaFondo, setSceltaFondo] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <Card tono="scuro">
        <div className="flex items-center gap-1.5">
          <h1 className="text-sm font-normal text-white/70">{VOCI.quantoHai.nome}</h1>
          <Info voce="quantoHai" tono="scuro" />
        </div>
        <Cifra size="2xl" className="mt-1">
          {money(eq, hidden, 0)}
        </Cifra>
        <p className="mt-1 text-sm text-white/70">Tutto quello che hai, meno tutti i debiti. Non sono soldi da spendere.</p>
      </Card>

      <AccordionGroup>
        <AccordionItem id="conto" titolo={VOCI.inConto.nome} destra={<span className="font-medium">{money(patrimonio.saldoConto, hidden, 0)}</span>}>
          <div className="pt-2">
            <Label htmlFor="qh-conto">Saldo del conto oggi €</Label>
            <NumberField id="qh-conto" value={patrimonio.saldoConto} onCommit={(n) => setPatrimonio({ saldoConto: n })} />
          </div>
        </AccordionItem>

        <AccordionItem
          id="case"
          titolo="Case"
          sotto={immobili.length ? `${immobili.length === 1 ? "1 casa" : `${immobili.length} case`} · valore` : "Nessuna"}
          destra={<span className="font-medium">{money(caseTot, hidden, 0)}</span>}
        >
          {immobili.length ? (
            <ul className="divide-y divide-border">
              {immobili.map((i) => {
                const p = withImmobile(patrimonio, i);
                return (
                  <li key={i.id}>
                    <Riga
                      titolo={i.nome || "Casa"}
                      sotto={i.capitaleMutuo > 0 ? `Tua ${money(equityCasa(p), hidden, 0)} tolto il mutuo` : "Senza mutuo"}
                      importo={money(valoreEffettivo(p), hidden, 0)}
                    />
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="pt-2 text-sm text-muted">Nessuna casa.</p>
          )}
          <Link to="/casa" className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-pine">
            Apri Casa
          </Link>
        </AccordionItem>

        <AccordionItem
          id="fondi"
          titolo="Fondi"
          sotto={nFondi === 0 ? "Nessuno" : nFondi === 1 ? "1 fondo" : `${nFondi} fondi`}
          destra={<span className="font-medium">{money(totFondi, hidden, 0)}</span>}
        >
          <ul className="divide-y divide-border">
            {fonteOn ? (
              <li>
                <Riga
                  titolo={nomeFonte(patrimonio.fonteNome)}
                  sotto="Fondo pensione"
                  importo={money(patrimonio.fonteTotale, hidden, 0)}
                  onClick={() => setFonteAperta(true)}
                />
              </li>
            ) : null}
            {fondi.map((i) => (
              <li key={i.id}>
                <Riga titolo={i.nome} sotto="Fondo" importo={money(i.valore, hidden, 0)} onClick={() => setApri(i)} />
              </li>
            ))}
          </ul>
          {!fonteOn && !fondi.length ? <p className="pt-2 text-sm text-muted">Nessun fondo.</p> : null}
          <Button variant="soft" size="sm" className="mt-2 w-full" onClick={() => setSceltaFondo(true)}>
            <Plus className="size-4" aria-hidden="true" />
            Aggiungi un fondo
          </Button>
        </AccordionItem>

        <AccordionItem
          id="investimenti"
          titolo="Investimenti"
          sotto={altri.length === 0 ? "Nessuno" : altri.length === 1 ? "1 investimento" : `${altri.length} tra azioni, cripto e altro`}
          destra={<span className="font-medium">{money(totAltri, hidden, 0)}</span>}
        >
          {altri.length ? (
            <ul className="divide-y divide-border">
              {altri.map((i) => (
                <li key={i.id}>
                  <Riga
                    titolo={i.nome}
                    sotto={[
                      TIPI.find((t) => t.id === i.tipo)?.label,
                      i.prezzoAggiornatoAt ? `prezzo del ${fmtIt(i.prezzoAggiornatoAt.slice(0, 10))}` : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    importo={money(i.valore, hidden, 0)}
                    onClick={() => setApri(i)}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="pt-2 text-sm text-muted">Nessun investimento.</p>
          )}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button variant="soft" size="sm" onClick={() => setNuovo("azioni")}>
              <Plus className="size-4" aria-hidden="true" />
              Aggiungi
            </Button>
            <Button variant="soft" size="sm" disabled={prezzi.loading} onClick={() => void prezzi.aggiorna("manual")}>
              <RefreshCw className={`size-4 ${prezzi.loading ? "animate-spin" : ""}`} aria-hidden="true" />
              {prezzi.loading ? "Aggiorno…" : "Prezzi"}
            </Button>
          </div>
          {prezzi.err ? (
            <p className="mt-2 text-sm text-brick" role="alert">
              {prezzi.err}
            </p>
          ) : null}
          {prezzi.ok ? <p className="mt-2 text-sm text-pine">{prezzi.ok}</p> : null}
          <p className="mt-2 text-xs text-muted">
            I prezzi arrivano da listini pubblici. Nessuna chiave, nessun accesso al tuo conto: la quantità la scrivi tu.
          </p>
        </AccordionItem>

        <AccordionItem id="debiti" titolo="Debiti" sotto="Mutui e prestiti, quanto manca" destra={<span className="font-medium text-brick">−{money(debiti, hidden, 0)}</span>}>
          <ul className="divide-y divide-border">
            {immobili
              .filter((i) => i.capitaleMutuo > 0)
              .map((i) => (
                <li key={i.id}>
                  <Riga titolo={`Mutuo ${i.nome}`} sotto="Si cambia in Casa" importo={money(i.capitaleMutuo, hidden, 0)} />
                </li>
              ))}
          </ul>
          <div className="pt-2">
            <Label htmlFor="qh-prest">Altri prestiti, quanto manca €</Label>
            <NumberField
              id="qh-prest"
              value={patrimonio.capitalePrestito}
              min={0}
              onCommit={(n) => setPatrimonio({ capitalePrestito: n })}
            />
          </div>
        </AccordionItem>
      </AccordionGroup>

      {!immobili.length && !investimenti.length && !fonteOn ? (
        <Vuoto>Qui si somma tutto: conto, case, fondi, investimenti, meno i debiti. Aggiungi quello che hai.</Vuoto>
      ) : null}

      <Sheet open={sceltaFondo} onClose={() => setSceltaFondo(false)} title="Che fondo?">
        <div className="flex flex-col gap-2">
          {!fonteOn ? (
            <button
              type="button"
              className="flex min-h-16 flex-col justify-center rounded-2xl bg-paper px-4 text-left"
              onClick={() => {
                setPatrimonio({ fonteAttivo: true });
                setSceltaFondo(false);
                setFonteAperta(true);
              }}
            >
              <span className="font-medium">Fon.Te, il fondo pensione del commercio</span>
              <span className="text-sm text-muted">Con quote, versamenti dalla busta e TFR</span>
            </button>
          ) : null}
          <button
            type="button"
            className="flex min-h-16 flex-col justify-center rounded-2xl bg-paper px-4 text-left"
            onClick={() => {
              setSceltaFondo(false);
              setNuovo("fondo");
            }}
          >
            <span className="font-medium">Un altro fondo</span>
            <span className="text-sm text-muted">Fondo pensione, fondo comune, ETF: scrivi il valore</span>
          </button>
        </div>
      </Sheet>

      {fonteAperta ? <SchedaFonte onClose={() => setFonteAperta(false)} /> : null}
      {nuovo ? <NuovoInvestimento tipo={nuovo} onClose={() => setNuovo(null)} /> : null}
      {apri ? <SchedaInvestimento inv={apri} onClose={() => setApri(null)} /> : null}
    </div>
  );
}

function SchedaFonte({ onClose }: { onClose: () => void }) {
  const { patrimonio: p, setPatrimonio, removeFonte, nascostoSaldo: hidden } = useQuadra();
  const busta = fonteMese(p);
  const [nome, setNome] = useState(nomeFonte(p.fonteNome));
  return (
    <Sheet
      open
      onClose={onClose}
      title={nomeFonte(p.fonteNome)}
      footer={
        <div className="flex gap-2">
          <Button
            variant="dangerSoft"
            onClick={() => {
              if (window.confirm(`Togliere ${nomeFonte(p.fonteNome)}? Si cancellano saldo, busta paga e storico del fondo.`)) {
                removeFonte();
                onClose();
              }
            }}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Togli
          </Button>
          <Button className="flex-1" onClick={onClose}>
            Fatto
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <Label htmlFor="fo-nome">Nome</Label>
          <Input
            id="fo-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onBlur={() => setPatrimonio({ fonteNome: nome.trim() })}
          />
        </div>
        <div className="rounded-2xl bg-paper p-4">
          <p className="text-sm text-muted">Nel fondo</p>
          <p className="text-2xl font-semibold tabular-nums">{money(p.fonteTotale, hidden, 0)}</p>
          <p className="mt-1 text-xs text-muted">
            Investito {money(p.fonteInvestito, hidden, 0)} · in attesa di investimento {money(p.fonteAttesa, hidden, 0)} · TFR
            già dentro {money(p.tfrAccantonato ?? 0, hidden, 0)}
          </p>
          <p className="mt-2 text-xs text-muted">Resta vincolato fino alla pensione, salvo anticipi previsti dalla legge.</p>
        </div>
        <details className="rounded-2xl bg-paper p-3">
          <summary className="-m-3 block cursor-pointer p-3 text-sm font-medium">Modifica i saldi a mano</summary>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Campo label="Totale €" value={p.fonteTotale} onCommit={(n) => setPatrimonio({ fonteTotale: n })} />
            <Campo label="Investito €" value={p.fonteInvestito} onCommit={(n) => setPatrimonio({ fonteInvestito: n })} />
            <Campo label="In attesa €" value={p.fonteAttesa} onCommit={(n) => setPatrimonio({ fonteAttesa: n })} />
            <Campo label="TFR già dentro €" value={p.tfrAccantonato ?? 0} onCommit={(n) => setPatrimonio({ tfrAccantonato: n })} />
          </div>
        </details>
        <details className="rounded-2xl bg-paper p-3">
          <summary className="-m-3 block cursor-pointer p-3 text-sm font-medium">
            Dalla busta paga: {money(busta.totale, hidden)} al mese nel fondo
          </summary>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Campo
                label="Retribuzione su cui si calcola (dalla busta) €"
                value={p.retribuzioneUtile}
                onCommit={(n) => setPatrimonio({ retribuzioneUtile: n })}
              />
            </div>
            <Campo label="% tua" value={p.fonteLavPct * 100} onCommit={(n) => setPatrimonio({ fonteLavPct: n / 100 })} />
            <Campo label="% del datore" value={p.fonteDatPct * 100} onCommit={(n) => setPatrimonio({ fonteDatPct: n / 100 })} />
          </div>
          <p className="mt-2 text-sm tabular-nums">
            Tu {money(busta.lavoratore, hidden)} ({pct(p.fonteLavPct, 2)}) · datore {money(busta.datore, hidden)} (
            {pct(p.fonteDatPct, 2)}) · TFR {money(busta.tfr, hidden)}
          </p>
          <p className="mt-1 text-xs text-muted">
            La tua parte è già tolta dal netto dei cedolini. Datore e TFR vanno nel fondo senza passare dal conto.
          </p>
        </details>
        <FonteSync />
      </div>
    </Sheet>
  );
}

function Campo({ label, value, onCommit }: { label: string; value: number; onCommit: (n: number) => void }) {
  const id = useId();
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <NumberField id={id} value={value} min={0} onCommit={onCommit} />
    </div>
  );
}

function NuovoInvestimento({ tipo: tipo0, onClose }: { tipo: Investimento["tipo"]; onClose: () => void }) {
  const addInvestimento = useQuadra((s) => s.addInvestimento);
  const [tipo, setTipo] = useState<Investimento["tipo"]>(tipo0);
  const [nome, setNome] = useState("");
  const [valore, setValore] = useState("");
  const [simbolo, setSimbolo] = useState("");
  const [quantita, setQuantita] = useState("");
  const [err, setErr] = useState("");
  const conPrezzo = tipo === "crypto" || tipo === "azioni";
  function salva() {
    if (!nome.trim()) return setErr("Dai un nome, per esempio «ETF mondo».");
    const v = valore.trim() ? parseNumberDraft(valore) : 0;
    if (v === null || v < 0) return setErr("Scrivi il valore di oggi, per esempio 1.200.");
    const q = quantita.trim() ? parseNumberDraft(quantita) : undefined;
    if (q === null || (q !== undefined && q < 0)) return setErr("Quantità non valida.");
    addInvestimento({
      nome: nome.trim(),
      tipo,
      valore: Math.round((v ?? 0) * 100) / 100,
      note: "",
      transazioni: [],
      ...(conPrezzo && simbolo.trim() ? { simbolo: simbolo.trim() } : {}),
      ...(conPrezzo && q !== undefined ? { quantita: q } : {}),
    });
    onClose();
  }
  return (
    <Sheet
      open
      onClose={onClose}
      title={tipo0 === "fondo" ? "Nuovo fondo" : "Nuovo investimento"}
      footer={
        <Button variant="primary" className="w-full" onClick={salva}>
          Salva
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {tipo0 !== "fondo" ? <Segmenti label="Tipo" valore={tipo} onChange={setTipo} opzioni={TIPI} /> : null}
        <div>
          <Label htmlFor="ni-nome">Nome</Label>
          <Input id="ni-nome" value={nome} placeholder={tipo === "fondo" ? "Es. Fondo pensione aperto" : "Es. ETF mondo"} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="ni-val">Valore di oggi €</Label>
          <Input id="ni-val" inputMode="decimal" value={valore} onChange={(e) => setValore(e.target.value)} />
        </div>
        {conPrezzo ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ni-sym">Simbolo</Label>
              <Input id="ni-sym" value={simbolo} placeholder="Es. BTC" onChange={(e) => setSimbolo(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ni-q">Quantità</Label>
              <Input id="ni-q" inputMode="decimal" value={quantita} onChange={(e) => setQuantita(e.target.value)} />
            </div>
            <p className="col-span-2 text-xs text-muted">Con simbolo e quantità il valore si aggiorna dal listino pubblico.</p>
          </div>
        ) : null}
        {err ? (
          <p className="text-sm text-brick" role="alert">
            {err}
          </p>
        ) : null}
      </div>
    </Sheet>
  );
}

function SchedaInvestimento({ inv: inv0, onClose }: { inv: Investimento; onClose: () => void }) {
  const { investimenti, updateInvestimento, removeInvestimento, addInvTransazione, removeInvTransazione, nascostoSaldo: hidden } =
    useQuadra();
  const inv = investimenti.find((x) => x.id === inv0.id) ?? inv0;
  const txns = invTransazioni(inv);
  const conPrezzo = inv.tipo === "crypto" || inv.tipo === "azioni";
  const [op, setOp] = useState(false);
  return (
    <Sheet
      open
      onClose={onClose}
      title={inv.nome || "Investimento"}
      footer={
        <div className="flex gap-2">
          <Button
            variant="dangerSoft"
            onClick={() => {
              if (window.confirm(`Togliere «${inv.nome}»?`)) {
                removeInvestimento(inv.id);
                onClose();
              }
            }}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Togli
          </Button>
          <Button className="flex-1" onClick={onClose}>
            Fatto
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <Label htmlFor="si-nome">Nome</Label>
          <Input id="si-nome" value={inv.nome} onChange={(e) => updateInvestimento(inv.id, { nome: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="si-val">Valore di oggi €</Label>
          <NumberField id="si-val" value={inv.valore} min={0} onCommit={(n) => updateInvestimento(inv.id, { valore: n })} />
          {inv.prezzoAggiornatoAt ? (
            <p className="mt-1 text-xs text-muted">
              Prezzo di mercato {inv.prezzoMercato != null ? eur(inv.prezzoMercato) : "—"} del {fmtIt(inv.prezzoAggiornatoAt.slice(0, 10))}
            </p>
          ) : null}
        </div>
        {conPrezzo ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="si-sym">Simbolo</Label>
              <Input id="si-sym" value={inv.simbolo ?? ""} placeholder="Es. BTC" onChange={(e) => updateInvestimento(inv.id, { simbolo: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="si-q">Quantità</Label>
              <NumberField id="si-q" value={inv.quantita ?? 0} digits={8} min={0} emptyCommitsZero onCommit={(n) => updateInvestimento(inv.id, { quantita: n })} />
            </div>
          </div>
        ) : null}
        <div className="rounded-2xl bg-paper p-3">
          <p className="text-sm font-medium">Operazioni</p>
          {txns.length ? (
            <>
              <p className="mt-1 text-sm tabular-nums">
                Messi {money(capitaleVersato(inv), hidden)} · guadagno sulla carta{" "}
                <b className={pnlLatente(inv) >= 0 ? "text-pine" : "text-brick"}>{money(pnlLatente(inv), hidden)}</b>
              </p>
              <ul className="mt-2 divide-y divide-border">
                {[...txns]
                  .sort((a, b) => b.data.localeCompare(a.data))
                  .map((t) => (
                    <li key={t.id} className="flex items-center gap-2">
                      <Riga
                        className="flex-1"
                        titolo={TXN_TIPI.find((x) => x.id === t.tipo)?.label ?? t.tipo}
                        sotto={`${fmtIt(t.data)}${t.commissione ? ` · commissione ${eur(t.commissione)}` : ""}${t.note ? ` · ${t.note}` : ""}`}
                        importo={money(t.importo, hidden)}
                      />
                      <button
                        type="button"
                        aria-label="Elimina operazione"
                        className="flex size-11 items-center justify-center text-brick"
                        onClick={() => {
                          if (window.confirm(`Eliminare l'operazione del ${fmtIt(t.data)} da ${eur(t.importo)}?`)) removeInvTransazione(inv.id, t.id);
                        }}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
              </ul>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted">Nessuna. Servono solo se vuoi sapere quanto ci hai messo.</p>
          )}
          {op ? (
            <NuovaOperazione
              onAdd={(t) => {
                addInvTransazione(inv.id, t);
                setOp(false);
              }}
              onCancel={() => setOp(false)}
            />
          ) : (
            <Button variant="soft" size="sm" className="mt-2 w-full" onClick={() => setOp(true)}>
              <Plus className="size-4" aria-hidden="true" />
              Aggiungi operazione
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  );
}

function NuovaOperazione({ onAdd, onCancel }: { onAdd: (t: Omit<InvTransazione, "id">) => void; onCancel: () => void }) {
  const [data, setData] = useState(todayIso());
  const [tipo, setTipo] = useState<InvTransazioneTipo>("acquisto");
  const [importo, setImporto] = useState("");
  const [commissione, setCommissione] = useState("");
  const [err, setErr] = useState("");
  return (
    <div className="mt-3 flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Input aria-label="Data" type="date" value={data} onChange={(e) => e.target.value && setData(e.target.value)} />
        <select
          aria-label="Tipo di operazione"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as InvTransazioneTipo)}
          className="h-12 rounded-xl bg-surface px-3 text-[15px] shadow-[inset_0_0_0_1px_var(--color-border)]"
        >
          {TXN_TIPI.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <Input aria-label="Importo" inputMode="decimal" placeholder="Importo €" value={importo} onChange={(e) => setImporto(e.target.value)} />
        <Input aria-label="Commissione" inputMode="decimal" placeholder="Commissione €" value={commissione} onChange={(e) => setCommissione(e.target.value)} />
      </div>
      {err ? (
        <p className="text-sm text-brick" role="alert">
          {err}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button
          variant="primary"
          size="sm"
          className="flex-1"
          onClick={() => {
            if (!isIsoDate(data)) return setErr("Scegli una data.");
            const n = parseNumberDraft(importo);
            if (n === null || n < 0) return setErr("Scrivi l'importo.");
            const f = commissione.trim() ? parseNumberDraft(commissione) : 0;
            if (f === null || f < 0) return setErr("Commissione non valida.");
            onAdd({ data, tipo, importo: Math.round(n * 100) / 100, commissione: Math.round(f * 100) / 100, note: "" });
          }}
        >
          Salva
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Annulla
        </Button>
      </div>
    </div>
  );
}
