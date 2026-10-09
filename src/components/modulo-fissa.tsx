import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, parseNumberDraft } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { rataDi, hasPiano, splitChiude } from "@/lib/piano";
import {
  FREQUENZE,
  VOCI_CASA,
  categorieFisse,
  type Fissa,
  type Frequenza,
  type VoceCasa,
} from "@/lib/quadra";
import { todayIso } from "@/lib/banca";
import { useQuadra } from "@/lib/store";
import { eur } from "@/lib/utils";

export const MESI_BREVI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

/** «Mensile, il 15» · «Annuale, 5 set». */
export function quandoEsce(f: Fissa): string {
  const freq = FREQUENZE.find((x) => x.id === (f.frequenza ?? "mensile"))?.label ?? "Mensile";
  if ((f.frequenza ?? "mensile") === "mensile") return `${freq}, il ${f.giorno}`;
  return `${freq}, ${f.giorno} ${MESI_BREVI[(f.mese ?? 1) - 1] ?? ""}`;
}

type Bozza = {
  nome: string;
  importo: string;
  frequenza: Frequenza;
  giorno: string;
  mese: string;
  categoria: string;
  immobileId: string;
  voce: VoceCasa;
  note: string;
};

/**
 * Nuova spesa o modifica di una esistente. Da Casa arriva con la casa già
 * scelta (e la voce, se l'utente ha toccato «Condominio», «IMU»…).
 */
export function ModuloFissa({
  fissa,
  onClose,
  preset,
}: {
  fissa: Fissa | null;
  onClose: () => void;
  preset?: Partial<Pick<Fissa, "categoria" | "immobileId" | "voce" | "nome">>;
}) {
  const { addFissa, updateFissa, removeFissa, fisseCategorie, immobili } = useQuadra();
  const cats = categorieFisse(fisseCategorie);
  const daPiano = hasPiano(fissa);
  const rata = fissa ? rataDi(fissa, todayIso()) : undefined;
  const [b, setB] = useState<Bozza>(() => ({
    nome: fissa?.nome ?? preset?.nome ?? "",
    importo: fissa ? String(fissa.importo).replace(".", ",") : "",
    frequenza: fissa?.frequenza ?? "mensile",
    giorno: String(fissa?.giorno ?? 1),
    mese: String(fissa?.mese ?? new Date().getMonth() + 1),
    categoria: fissa?.categoria ?? preset?.categoria ?? (preset?.immobileId ? "casa" : "vita"),
    immobileId: fissa?.immobileId ?? preset?.immobileId ?? "",
    voce: fissa?.voce ?? preset?.voce ?? "altro",
    note: fissa?.note ?? "",
  }));
  const [err, setErr] = useState("");
  const set = (p: Partial<Bozza>) => {
    setB((x) => ({ ...x, ...p }));
    if (err) setErr("");
  };

  function salva() {
    if (!b.nome.trim()) {
      setErr("Dai un nome alla spesa.");
      return;
    }
    const imp = daPiano ? (fissa?.importo ?? 0) : parseNumberDraft(b.importo);
    if (imp === null || imp < 0) {
      setErr(imp !== null && imp < 0 ? "L'importo non può essere negativo." : "Scrivi l'importo, per esempio 12,50.");
      return;
    }
    const g = parseNumberDraft(b.giorno);
    if (g === null || g < 1 || g > 31) {
      setErr("Il giorno va da 1 a 31.");
      return;
    }
    const m = parseNumberDraft(b.mese);
    if (b.frequenza !== "mensile" && (m === null || m < 1 || m > 12)) {
      setErr("Il mese va da 1 a 12.");
      return;
    }
    const dati: Omit<Fissa, "id"> = {
      nome: b.nome.trim(),
      importo: Math.round(imp * 100) / 100,
      frequenza: daPiano ? "mensile" : b.frequenza,
      giorno: Math.round(g),
      mese: Math.round(m ?? 1),
      categoria: daPiano ? "debito" : b.categoria,
      note: b.note,
      immobileId: b.immobileId || undefined,
      voce: b.immobileId ? (fissa?.voce === "mutuo" ? "mutuo" : b.voce) : undefined,
    };
    if (fissa) updateFissa(fissa.id, dati);
    else addFissa(dati);
    onClose();
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={fissa ? fissa.nome || "Spesa" : "Nuova spesa fissa"}
      footer={
        <div className="flex gap-2">
          {fissa ? (
            <Button
              variant="dangerSoft"
              aria-label={`Elimina ${fissa.nome}`}
              onClick={() => {
                if (window.confirm(`Eliminare «${fissa.nome}»?`)) {
                  removeFissa(fissa.id);
                  onClose();
                }
              }}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Elimina
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
        <div>
          <Label htmlFor="f-nome">Nome</Label>
          <Input id="f-nome" value={b.nome} placeholder="Es. Palestra" onChange={(e) => set({ nome: e.target.value })} />
        </div>
        {daPiano ? (
          <div className="rounded-2xl bg-paper p-4 text-sm">
            <p className="font-medium">Rata dal piano della banca</p>
            {rata ? (
              <p className="mt-1 tabular-nums">
                Questo mese {eur(rata.r)}: interessi {eur(rata.i)}, capitale {eur(rata.c)}
                {splitChiude(rata) ? "" : `, spese ${eur(rata.r - rata.i - rata.c)}`}. Debito dopo la rata{" "}
                {eur(rata.k)}.
              </p>
            ) : (
              <p className="mt-1 text-muted">Il piano non ha una rata questo mese: uso {eur(fissa?.importo ?? 0)}.</p>
            )}
            <p className="mt-1 text-xs text-muted">L'importo segue il piano e non si modifica a mano.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="f-imp">Importo €</Label>
              <Input
                id="f-imp"
                inputMode="decimal"
                placeholder="12,50"
                value={b.importo}
                onChange={(e) => set({ importo: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="f-freq">Ogni quanto</Label>
              <select
                id="f-freq"
                value={b.frequenza}
                onChange={(e) => set({ frequenza: e.target.value as Frequenza })}
                className="h-12 w-full rounded-xl bg-paper px-3 text-[15px] shadow-[inset_0_0_0_1px_var(--color-border)]"
              >
                {FREQUENZE.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="f-g">Giorno dell'addebito</Label>
            <Input id="f-g" inputMode="numeric" value={b.giorno} onChange={(e) => set({ giorno: e.target.value })} />
          </div>
          {b.frequenza !== "mensile" && !daPiano ? (
            <div>
              <Label htmlFor="f-m">Mese (1–12)</Label>
              <Input id="f-m" inputMode="numeric" value={b.mese} onChange={(e) => set({ mese: e.target.value })} />
            </div>
          ) : (
            <div>
              <Label htmlFor="f-cat">Categoria</Label>
              <select
                id="f-cat"
                value={daPiano ? "debito" : b.categoria}
                disabled={daPiano}
                onChange={(e) => set({ categoria: e.target.value })}
                className="h-12 w-full rounded-xl bg-paper px-3 text-[15px] shadow-[inset_0_0_0_1px_var(--color-border)] disabled:text-muted"
              >
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        {b.frequenza !== "mensile" && !daPiano ? (
          <div>
            <Label htmlFor="f-cat2">Categoria</Label>
            <select
              id="f-cat2"
              value={b.categoria}
              onChange={(e) => set({ categoria: e.target.value })}
              className="h-12 w-full rounded-xl bg-paper px-3 text-[15px] shadow-[inset_0_0_0_1px_var(--color-border)]"
            >
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {immobili.length > 0 && fissa?.voce !== "mutuo" ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="f-casa">È di una casa?</Label>
              <select
                id="f-casa"
                value={b.immobileId}
                onChange={(e) => set({ immobileId: e.target.value })}
                className="h-12 w-full rounded-xl bg-paper px-3 text-[15px] shadow-[inset_0_0_0_1px_var(--color-border)]"
              >
                <option value="">No</option>
                {immobili.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nome || "Casa senza nome"}
                  </option>
                ))}
              </select>
            </div>
            {b.immobileId ? (
              <div>
                <Label htmlFor="f-voce">Che spesa è</Label>
                <select
                  id="f-voce"
                  value={b.voce}
                  onChange={(e) => set({ voce: e.target.value as VoceCasa })}
                  className="h-12 w-full rounded-xl bg-paper px-3 text-[15px] shadow-[inset_0_0_0_1px_var(--color-border)]"
                >
                  {VOCI_CASA.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
        ) : null}
        <div>
          <Label htmlFor="f-note">Nota</Label>
          <Input id="f-note" value={b.note} placeholder="Facoltativa" onChange={(e) => set({ note: e.target.value })} />
        </div>
        {err ? (
          <p className="text-sm text-brick" role="alert">
            {err}
          </p>
        ) : null}
      </form>
    </Sheet>
  );
}
