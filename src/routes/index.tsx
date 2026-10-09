import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Pencil } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Info, InfoSheet } from "@/components/info";
import { Button } from "@/components/ui/button";
import { Card, Cifra } from "@/components/ui/card";
import { Label, NumberField } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { fmtIt } from "@/lib/banca";
import { contiDelMese, movimentiClassificati } from "@/lib/conti";
import { STIMA_NON_DELIBERA, VOCI } from "@/lib/nomi";
import { useQuadra } from "@/lib/store";
import { cn, money, plurale } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Home });

const MESI = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];

function Home() {
  const state = useQuadra();
  const hidden = state.nascostoSaldo;
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
  // Senza cedolini «Resta al mese» sarebbe solo meno spese: non lo mostro, come senza estratto.
  const calcolabile = c.haDalConto && state.cedolini.length > 0;
  const oggi = new Date();
  const saldo = state.patrimonio.saldoConto;
  const coperto = c.cuscinetto > 0 ? Math.max(0, Math.min(1, saldo / c.cuscinetto)) : 0;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="sr-only">Home</h1>
      <p className="px-1 text-sm text-muted">
        {MESI[oggi.getMonth()]} {oggi.getFullYear()}
      </p>

      <InConto saldo={saldo} hidden={hidden} coperto={coperto} cuscinetto={c.cuscinetto} />

      <Card tono="scuro">
        <p className="flex items-center gap-1.5 text-sm text-white/70">
          {VOCI.restaAlMese.nome}
        </p>
        <Cifra size="2xl" className={cn("mt-1", calcolabile && c.restaAlMese < 0 && "text-[#ff9b8f]")}>
          {calcolabile ? money(c.restaAlMese, hidden, 0) : "—"}
        </Cifra>
        {c.haDalConto && !state.cedolini.length ? (
          <p className="mt-1 text-sm text-white/70">
            Serve almeno un cedolino.{" "}
            <Link to="/cedolini" className="font-medium text-white underline underline-offset-2">
              Caricalo in Cedolini
            </Link>
          </p>
        ) : null}
        {!c.haDalConto ? (
          <p className="mt-1 text-sm text-white/70">
            Serve l'estratto conto di questo mese.{" "}
            <Link to="/banca" className="font-medium text-white underline underline-offset-2">
              Caricalo in Dal conto
            </Link>
          </p>
        ) : null}
        <div className="mt-4 flex flex-col divide-y divide-white/10 rounded-2xl bg-white/5 px-3">
          <Voce
            to="/cedolini"
            nome={VOCI.cedolini.nome}
            valore={state.cedolini.length ? money(c.cedolini, hidden, 0) : "Carica un cedolino"}
            segno={state.cedolini.length ? "+" : ""}
          />
          <Voce
            to="/fisse"
            nome={VOCI.speseFisse.nome}
            valore={state.fisse.length ? money(c.speseFisse, hidden, 0) : "Nessuna"}
            segno={state.fisse.length ? "−" : ""}
          />
          <Voce
            to="/banca"
            nome={VOCI.dalConto.nome}
            valore={c.haDalConto ? money(c.dalConto, hidden, 0) : "Nessun dato"}
            segno={c.haDalConto ? "−" : ""}
          />
        </div>
        <Origine
          tono="scuro"
          voce="restaAlMese"
          testo={
            c.haDalConto
              ? `Dal conto: ${plurale(c.periodo.n, "spesa", "spese")} dal ${fmtIt(c.dal)} a oggi, portate a un mese`
              : "Cedolini − spese fisse − media dal conto"
          }
        />
      </Card>

      <QuantoPuoiChiedere c={c} hidden={hidden} calcolabile={calcolabile} />
    </div>
  );
}

function Voce({
  to,
  nome,
  valore,
  segno,
}: {
  to: "/cedolini" | "/fisse" | "/banca";
  nome: string;
  valore: string;
  segno: string;
}) {
  return (
    <Link to={to} className="flex min-h-12 items-center gap-2 text-[15px]">
      <span className="flex-1 text-white/85">{nome}</span>
      <span className="tabular-nums font-medium">
        {segno ? <span className="mr-0.5 text-white/60">{segno}</span> : null}
        {valore}
      </span>
      <ChevronRight className="size-4 text-white/50" aria-hidden="true" />
    </Link>
  );
}

/** «Da dove arriva il numero»: una riga, il tocco apre la «i». */
function Origine({
  voce,
  testo,
  tono = "chiaro",
  children,
}: {
  voce: "restaAlMese" | "inConto" | "quantoPuoiChiedere";
  testo: string;
  tono?: "chiaro" | "scuro";
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const v = VOCI[voce];
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "mt-3 flex min-h-11 w-full items-center gap-2 text-left text-sm",
          tono === "scuro" ? "text-white/70" : "text-muted",
        )}
      >
        <span
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
            tono === "scuro" ? "bg-white/15 text-white/80" : "bg-paper-2 text-muted",
          )}
          aria-hidden="true"
        >
          i
        </span>
        <span className="min-w-0 flex-1 text-pretty">{testo}</span>
      </button>
      <InfoSheet
        open={open}
        onClose={() => setOpen(false)}
        titolo={v.nome}
        testo={v.riga}
        esempio={v.esempio}
        tecnico={"tecnico" in v ? v.tecnico : undefined}
      >
        {children}
      </InfoSheet>
    </>
  );
}

function InConto({
  saldo,
  hidden,
  coperto,
  cuscinetto,
}: {
  saldo: number;
  hidden: boolean;
  coperto: number;
  cuscinetto: number;
}) {
  const setPatrimonio = useQuadra((s) => s.setPatrimonio);
  const [modifica, setModifica] = useState(false);
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{VOCI.inConto.nome}</p>
          <Cifra size="xl" className="mt-1">
            {money(saldo, hidden)}
          </Cifra>
        </div>
        <Button variant="soft" size="sm" onClick={() => setModifica(true)}>
          <Pencil className="size-3.5" aria-hidden="true" />
          Modifica
        </Button>
      </div>
      {cuscinetto > 0 ? (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-muted">
            <span className="inline-flex items-center gap-1.5">
              {VOCI.cuscinetto.nome}: 6 mesi di spese fisse <Info voce="cuscinetto" />
            </span>
            <span className="tabular-nums">{hidden ? "••" : `${Math.round(coperto * 100)} %`}</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-paper-2">
            <div
              className={cn("h-full rounded-full", coperto >= 1 ? "bg-pine" : "bg-amber")}
              style={{ width: `${Math.round(coperto * 100)}%` }}
            />
          </div>
        </div>
      ) : null}
      <Origine voce="inConto" testo="Lo scrivi tu, dal saldo che vedi in banca" />
      <Sheet
        open={modifica}
        onClose={() => setModifica(false)}
        title={VOCI.inConto.nome}
        footer={
          <Button className="w-full" onClick={() => setModifica(false)}>
            Fatto
          </Button>
        }
      >
        <Label htmlFor="saldo-conto">Saldo del conto oggi (€)</Label>
        <NumberField
          id="saldo-conto"
          value={saldo}
          onCommit={(n) => setPatrimonio({ saldoConto: n })}
        />
        <p className="mt-2 text-sm text-muted">Copialo dall'app della tua banca. Può anche essere negativo.</p>
      </Sheet>
    </Card>
  );
}

function QuantoPuoiChiedere({
  c,
  hidden,
  calcolabile,
}: {
  c: ReturnType<typeof contiDelMese>;
  hidden: boolean;
  calcolabile: boolean;
}) {
  const [open, setOpen] = useState(false);
  const v = VOCI.quantoPuoiChiedere;
  const limitaLaCassa = calcolabile && c.restaAlMese < c.limiteBanca;
  return (
    <Card>
      <button type="button" onClick={() => setOpen(true)} className="block w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-muted">{v.nome}</p>
            <p className="text-xs text-muted/80">{STIMA_NON_DELIBERA}</p>
          </div>
          <ChevronRight className="mt-1 size-4 shrink-0 text-muted" aria-hidden="true" />
        </div>
        <Cifra size="xl" className="mt-2">
          {calcolabile ? (
            <>
              {money(c.quantoPuoiChiedere, hidden, 0)}
              <span className="ml-1 text-base font-normal text-muted">di rata al mese</span>
            </>
          ) : (
            "—"
          )}
        </Cifra>
        <p className="mt-2 text-sm">
          <span className="text-muted">A cosa serve: </span>
          la rata più alta di un prestito nuovo che reggi.
        </p>
      </button>
      <Origine
        voce="quantoPuoiChiedere"
        testo={
          c.cedolini > 0
            ? `Il più basso fra quanto ti resta e il 33 % dei cedolini meno le rate`
            : "Servono i cedolini e l'estratto conto"
        }
      />
      <InfoSheet
        open={open}
        onClose={() => setOpen(false)}
        titolo={v.nome}
        testo="Non è quanto ti resta al mese: è la rata che una banca potrebbe accettare, e non va mai oltre quello che ti avanza davvero."
      >
        <dl className="flex flex-col divide-y divide-border rounded-2xl bg-paper px-4">
          <div className="flex justify-between py-3">
            <dt>{VOCI.restaAlMese.nome}</dt>
            <dd className="tabular-nums font-medium">{calcolabile ? money(c.restaAlMese, hidden, 0) : "—"}</dd>
          </div>
          <div className="flex justify-between py-3">
            <dt>Limite della banca</dt>
            <dd className="tabular-nums font-medium">{money(c.limiteBanca, hidden, 0)}</dd>
          </div>
          <div className="flex justify-between py-3 font-semibold">
            <dt>Il più basso dei due</dt>
            <dd className="tabular-nums">{calcolabile ? money(c.quantoPuoiChiedere, hidden, 0) : "—"}</dd>
          </div>
        </dl>
        <p className="mt-3 text-muted">
          Limite della banca: il 33 % di {money(c.cedolini, hidden, 0)} di cedolini meno{" "}
          {money(c.rateInCorso, hidden, 0)} di rate già in corso
          {limitaLaCassa ? "; qui però ti ferma quello che ti resta." : "."}
        </p>
        <p className="mt-3 rounded-2xl bg-amber-2 p-3 text-amber">
          La banca può dire di no: guarda anche il contratto di lavoro, l'età, gli altri debiti e le garanzie.
        </p>
      </InfoSheet>
    </Card>
  );
}
