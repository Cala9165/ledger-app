import { createFileRoute } from "@tanstack/react-router";
import { FileUp, Plus, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Info } from "@/components/info";
import { AccordionGroup, AccordionItem } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, Cifra, Riga, Vuoto } from "@/components/ui/card";
import { Input, Label, parseNumberDraft } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { todayIso } from "@/lib/banca";
import { VOCI } from "@/lib/nomi";
import { extraCedolino, guessCedolinoMese, type Cedolino } from "@/lib/quadra";
import { useQuadra } from "@/lib/store";
import { money } from "@/lib/utils";

export const Route = createFileRoute("/cedolini")({ component: CedoliniPage });

const MESI = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

function nomeMese(yyyymm: string): string {
  const m = Number(yyyymm.slice(5, 7));
  return `${MESI[m - 1] ?? yyyymm} ${yyyymm.slice(0, 4)}`;
}

function CedoliniPage() {
  const { cedolini, redditoMensile, nascostoSaldo: hidden } = useQuadra();
  const [modulo, setModulo] = useState<Cedolino | "nuovo" | null>(null);
  const perAnno = useMemo(() => {
    const map = new Map<string, Cedolino[]>();
    for (const c of [...cedolini].sort((a, b) => b.mese.localeCompare(a.mese))) {
      const y = c.mese.slice(0, 4);
      map.set(y, [...(map.get(y) ?? []), c]);
    }
    return [...map.entries()];
  }, [cedolini]);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-center gap-1.5">
          <h1 className="text-sm font-normal text-muted">{VOCI.cedolini.nome} · media al mese</h1>
          <Info voce="cedolini" />
        </div>
        <Cifra size="2xl" className="mt-1">
          {cedolini.length ? money(redditoMensile, hidden, 0) : "—"}
        </Cifra>
        <p className="mt-1 text-sm text-muted">
          {cedolini.length
            ? `Media di ${cedolini.length === 1 ? "1 cedolino caricato" : `${cedolini.length} cedolini caricati`}. Stipendio e 13ª/14ª già nel netto.`
            : "Stipendio e 13ª/14ª già nel netto."}
        </p>
        <Button variant="primary" className="mt-4 w-full" onClick={() => setModulo("nuovo")}>
          <Plus className="size-4" aria-hidden="true" />
          Carica un cedolino
        </Button>
      </Card>

      {cedolini.length === 0 ? (
        <Vuoto>Nessun cedolino. Metti il netto di almeno un mese: la media parte da lì.</Vuoto>
      ) : (
        <AccordionGroup iniziale={perAnno[0]?.[0] ?? null}>
          {perAnno.map(([anno, righe]) => (
            <AccordionItem
              key={anno}
              id={anno}
              titolo={anno}
              sotto={righe.length === 1 ? "1 cedolino" : `${righe.length} cedolini`}
            >
              <ul className="divide-y divide-border">
                {righe.map((c) => {
                  const extra = extraCedolino(c);
                  return (
                    <li key={c.id}>
                      <Riga
                        titolo={nomeMese(c.mese)}
                        sotto={
                          extra > 0
                            ? `di cui ${money(extra, hidden, 0)} di 730, fuori media`
                            : c.nota || undefined
                        }
                        importo={money(c.netto, hidden, 0)}
                        onClick={() => setModulo(c)}
                      />
                    </li>
                  );
                })}
              </ul>
            </AccordionItem>
          ))}
        </AccordionGroup>
      )}

      {modulo ? (
        <ModuloCedolino
          key={modulo === "nuovo" ? "nuovo" : modulo.id}
          iniziale={modulo === "nuovo" ? null : modulo}
          altri={cedolini}
          onClose={() => setModulo(null)}
        />
      ) : null}
    </div>
  );
}

function ModuloCedolino({
  iniziale,
  altri,
  onClose,
}: {
  iniziale: Cedolino | null;
  altri: Cedolino[];
  onClose: () => void;
}) {
  const { addCedolino, updateCedolino, removeCedolino } = useQuadra();
  const [mese, setMese] = useState(iniziale?.mese ?? todayIso().slice(0, 7));
  const [netto, setNetto] = useState(iniziale ? String(iniziale.netto).replace(".", ",") : "");
  const [nota, setNota] = useState(iniziale?.nota ?? "");
  const [fileName, setFileName] = useState(iniziale?.fileName ?? "");
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function salva() {
    if (!/^\d{4}-\d{2}$/.test(mese)) {
      setErr("Scegli il mese del cedolino.");
      return;
    }
    const n = parseNumberDraft(netto);
    if (n === null || n < 0) {
      setErr(n !== null && n < 0 ? "Il netto non può essere negativo." : "Scrivi il netto, per esempio 1.950,00.");
      return;
    }
    const doppione = altri.find((c) => c.mese === mese && c.id !== iniziale?.id);
    if (doppione && iniziale) {
      setErr(`C'è già il cedolino di ${nomeMese(mese)}. Cambia mese o cancella quello.`);
      return;
    }
    const dati = { mese, netto: Math.round(n * 100) / 100, nota: nota.trim(), fileName: fileName || undefined };
    if (iniziale) updateCedolino(iniziale.id, dati);
    else addCedolino(dati);
    onClose();
  }

  const doppioneNuovo = !iniziale && altri.some((c) => c.mese === mese);

  return (
    <Sheet
      open
      onClose={onClose}
      title={iniziale ? nomeMese(iniziale.mese) : "Nuovo cedolino"}
      footer={
        <div className="flex gap-2">
          {iniziale ? (
            <Button
              variant="dangerSoft"
              aria-label="Elimina cedolino"
              onClick={() => {
                if (window.confirm(`Eliminare il cedolino di ${nomeMese(iniziale.mese)}?`)) {
                  removeCedolino(iniziale.id);
                  onClose();
                }
              }}
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          ) : null}
          <Button variant="primary" className="flex-1" onClick={salva}>
            Salva
          </Button>
        </div>
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
        {!iniziale ? (
          <>
          <Button type="button" variant="soft" onClick={() => fileRef.current?.click()}>
            <FileUp className="size-4" aria-hidden="true" />
            {fileName ? fileName : "Scegli il PDF o la foto (facoltativo)"}
          </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setFileName(f.name);
                const g = guessCedolinoMese(f.name);
                if (g) setMese(g);
              }}
            />
          </>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="cedo-mese">Mese</Label>
            <Input id="cedo-mese" type="month" value={mese} onChange={(e) => setMese(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="cedo-netto">Netto in busta €</Label>
            <Input
              id="cedo-netto"
              inputMode="decimal"
              placeholder="1.950,00"
              value={netto}
              onChange={(e) => {
                setNetto(e.target.value);
                if (err) setErr("");
              }}
            />
          </div>
        </div>
        {doppioneNuovo ? (
          <p className="text-sm text-amber">C'è già un cedolino di {nomeMese(mese)}: lo sostituisco.</p>
        ) : null}
        <div>
          <Label htmlFor="cedo-nota">Nota</Label>
          <Input
            id="cedo-nota"
            placeholder="Es. di cui 500 € 730"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
          />
          <p className="mt-1 text-xs text-muted">
            Se nel netto c'è un rimborso 730, scrivilo qui: non entra nella media.
          </p>
        </div>
        {fileName ? <p className="text-xs text-muted">Il file non viene letto né salvato: il netto lo scrivi tu.</p> : null}
        {err ? (
          <p className="text-sm text-brick" role="alert">
            {err}
          </p>
        ) : null}
      </form>
    </Sheet>
  );
}
