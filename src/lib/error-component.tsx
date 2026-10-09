import type { ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

const MESSAGGIO_DI_RIPIEGO = "Errore imprevisto.";

function messaggioErrore(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return MESSAGGIO_DI_RIPIEGO;
}

export function AppErrorComponent({ error }: ErrorComponentProps) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-paper px-6 text-center text-ink">
      <span className="text-brick" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="font-display text-xl font-medium">Qualcosa si è rotto</h1>
      <p className="max-w-md text-sm leading-relaxed text-muted">
        I tuoi dati sono al sicuro: restano nel browser, non li tocca nessuno. Ricarica la pagina;
        se ricapita, il messaggio qui sotto dice cosa è andato storto.
      </p>
      <p className="max-w-md font-mono text-xs break-words text-muted">{messaggioErrore(error)}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-2 h-11 rounded-lg bg-ink px-4 text-sm font-medium text-paper"
      >
        Ricarica
      </button>
    </main>
  );
}
