/**
 * Un identificativo nuovo per una riga (spesa, casa, versamento…).
 *
 * crypto.randomUUID esiste solo in un contesto sicuro (https o localhost). Dal telefono
 * l'app si apre in http sull'IP del PC, e lì non c'è: senza questo ripiego ogni «Salva»
 * che crea qualcosa si fermava con un errore. getRandomValues invece c'è ovunque.
 */
export function nuovoId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (typeof c?.randomUUID === "function") return c.randomUUID();
  const b = new Uint8Array(16);
  if (typeof c?.getRandomValues === "function") c.getRandomValues(b);
  else for (let i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256);
  // Forma di un UUID v4, come quelli già salvati.
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
