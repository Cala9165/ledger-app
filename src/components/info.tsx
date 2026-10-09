import { useState, type ReactNode } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { VOCI, type IdVoce, type Voce } from "@/lib/nomi";
import { cn } from "@/lib/utils";

/**
 * La «i» delle app di banca: tocchi, sale un foglio con il nome, una frase,
 * un esempio in euro e basta. Il termine inglese, se serve, viene dopo.
 */
export function Info({
  voce,
  titolo,
  testo,
  esempio,
  tecnico,
  children,
  className,
  tono = "chiaro",
}: {
  /** Voce del glossario: nome, frase ed esempio arrivano da lì. */
  voce?: IdVoce;
  titolo?: string;
  testo?: ReactNode;
  esempio?: ReactNode;
  tecnico?: string;
  /** Righe in più (i tuoi numeri), dopo l'esempio. */
  children?: ReactNode;
  className?: string;
  /** «scuro» per la «i» su una card scura. */
  tono?: "chiaro" | "scuro";
}) {
  const [open, setOpen] = useState(false);
  const v: Partial<Voce> = voce ? VOCI[voce] : {};
  const t = titolo ?? v.nome ?? "Info";
  return (
    <>
      <button
        type="button"
        aria-label={`Cos'è: ${t}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={cn(
          // 20px a vedersi, 44px sotto il dito.
          "relative inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold before:absolute before:-inset-3 before:content-['']",
          tono === "scuro" ? "bg-white/15 text-white/80" : "bg-paper-2 text-muted",
          className,
        )}
      >
        <span aria-hidden="true">i</span>
      </button>
      <InfoSheet
        open={open}
        onClose={() => setOpen(false)}
        titolo={t}
        testo={testo ?? v.riga}
        esempio={esempio ?? v.esempio}
        tecnico={tecnico ?? v.tecnico}
      >
        {children}
      </InfoSheet>
    </>
  );
}

export function InfoSheet({
  open,
  onClose,
  titolo,
  testo,
  esempio,
  tecnico,
  children,
}: {
  open: boolean;
  onClose: () => void;
  titolo: string;
  testo?: ReactNode;
  esempio?: ReactNode;
  tecnico?: string;
  children?: ReactNode;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={titolo}
      footer={
        <Button variant="default" className="w-full" onClick={onClose}>
          Ho capito
        </Button>
      }
    >
      {testo ? <p className="text-[15px] leading-relaxed">{testo}</p> : null}
      {esempio ? (
        <div className="mt-4 rounded-2xl bg-paper p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Esempio</p>
          <p className="mt-1 text-[15px] leading-relaxed tabular-nums">{esempio}</p>
        </div>
      ) : null}
      {children ? <div className="mt-4 text-sm leading-relaxed">{children}</div> : null}
      {tecnico ? (
        <p className="mt-4 text-xs text-muted">
          In inglese o in banca: <span className="font-medium text-ink">{tecnico}</span>
        </p>
      ) : null}
    </Sheet>
  );
}

/** Etichetta + «i» affiancate. */
export function Etichetta({
  voce,
  label,
  className,
  tono,
}: {
  voce: IdVoce;
  label?: string;
  className?: string;
  tono?: "chiaro" | "scuro";
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span>{label ?? VOCI[voce].nome}</span>
      <Info voce={voce} tono={tono} />
    </span>
  );
}
