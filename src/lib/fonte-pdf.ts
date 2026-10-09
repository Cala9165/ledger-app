/**
 * Estrazione testo PDF Fon.Te — solo browser, solo in memoria.
 * Non persistiamo il file né il testo grezzo: solo i campi parsati dopo conferma.
 */
import type { FontePdfExtract } from "./fonte";
import { parseFontePdfText } from "./fonte";

export async function extractFontePdf(file: File): Promise<FontePdfExtract> {
  if (!(file instanceof File)) {
    return {
      snapshot: null,
      contributi: [],
      confidence: "nessuna",
      avvisi: ["Nessun file."],
    };
  }
  const name = file.name.toLowerCase();
  if (!name.endsWith(".pdf") && file.type !== "application/pdf") {
    return {
      snapshot: null,
      contributi: [],
      confidence: "nessuna",
      avvisi: ["Serve un PDF (prospetto Fon.Te)."],
    };
  }
  if (file.size > 8 * 1024 * 1024) {
    return {
      snapshot: null,
      contributi: [],
      confidence: "nessuna",
      avvisi: ["PDF troppo grande (>8 MB). Esporta un prospetto testo, non una scansione pesante."],
    };
  }

  const buf = await file.arrayBuffer();
  try {
    const pdfjs = await import("pdfjs-dist");
    const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const doc = await pdfjs.getDocument({ data: buf }).promise;
    const pages: string[] = [];
    const n = Math.min(doc.numPages, 12);
    for (let i = 1; i <= n; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const line = content.items
        .map((it) => ("str" in it && typeof it.str === "string" ? it.str : ""))
        .filter(Boolean)
        .join(" ");
      pages.push(line);
    }
    return parseFontePdfText(pages.join("\n"));
  } catch (e) {
    return {
      snapshot: null,
      contributi: [],
      confidence: "nessuna",
      avvisi: [
        "Non riesco a leggere questo PDF. Scrivi i numeri a mano o usa la tabella CSV.",
      ],
    };
  }
}
