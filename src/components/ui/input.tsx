import { useState, type InputHTMLAttributes, type LabelHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-12 w-full rounded-xl bg-paper px-3 text-[15px] text-ink shadow-[inset_0_0_0_1px_var(--color-border)]",
        "placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine",
        "tabular-nums",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1 block text-sm font-medium text-muted", className)}
      {...props}
    />
  );
}

/** Parse IT/EN amount draft: "1.234,56" | "1,234.56" | "1,234" | "12,5" | "−15" | "15,00-" | "(12,5)". */
export function parseNumberDraft(raw: string): number | null {
  // Align with parseAmount: unicode minus, spaces, euro, apostrophe, trailing sign, paren
  const cleaned = raw
    .trim()
    .replace(/\u2212/g, "-")
    .replace(/\s/g, "")
    .replace(/€/g, "");
  const parenNeg = /^\(.*\)$/.test(cleaned);
  const t = cleaned.replace(/[^\d,.\-+]/g, "");
  if (!t || t === "-" || t === "+" || t === "," || t === ".") return null;
  const lead = t[0] === "-" || t[0] === "+" ? t[0] : "";
  const trail =
    !lead && (t.endsWith("-") || t.endsWith("+")) ? t.slice(-1) : "";
  const neg = parenNeg || lead === "-" || trail === "-";
  const body = lead ? t.slice(1) : trail ? t.slice(0, -1) : t;
  // Residual sign → invalid (same as parseAmount double-sign guard)
  if (!body || /[+-]/.test(body)) return null;
  let n: number;
  if (body.includes(",") && body.includes(".")) {
    // Ultimo separatore = decimali (IT 1.234,56 o EN 1,234.56) — allineato a parseAmount
    const lastComma = body.lastIndexOf(",");
    const lastDot = body.lastIndexOf(".");
    if (lastComma > lastDot) {
      n = Number(body.replace(/\./g, "").replace(",", "."));
    } else {
      n = Number(body.replace(/,/g, ""));
    }
  } else if (/^\d{1,3}(,\d{3})+$/.test(body)) {
    n = Number(body.replace(/,/g, ""));
  } else if (body.includes(",")) {
    const parts = body.split(",");
    if (parts.length === 2 && parts[1].length <= 2) {
      n = Number(parts[0].replace(/\./g, "") + "." + parts[1]);
    } else {
      n = Number(body.replace(",", "."));
    }
  } else if (/^\d{1,3}(\.\d{3})+$/.test(body)) {
    n = Number(body.replace(/\./g, ""));
  } else {
    n = Number(body);
  }
  if (!Number.isFinite(n)) return null;
  return neg ? -Math.abs(n) : n;
}

function defaultRangeMessage(min?: number, max?: number): string {
  if (min === 0 && max === undefined) return "Il valore non può essere negativo";
  if (min !== undefined && max !== undefined) {
    return `Il valore deve essere tra ${min} e ${max}`;
  }
  if (min !== undefined) return `Il valore deve essere almeno ${min}`;
  if (max !== undefined) return `Il valore deve essere al massimo ${max}`;
  return "Valore fuori intervallo";
}

/** Result of resolving a NumberField draft on blur (pure — used by UI + stress). */
export type NumberCommitResult =
  | { ok: true; n: number }
  | { ok: false; error: string; keepDraft: boolean };

export function resolveNumberCommit(
  raw: string,
  opts: {
    value: number;
    digits?: number;
    /** Money fields: empty → Italian error + restore previous (never silent 0). */
    emptyAsZero?: boolean;
    /**
     * Casa mq etc.: empty blur commits 0 (no "Inserisci un importo").
     * Takes precedence over emptyAsZero when the field is empty.
     */
    emptyCommitsZero?: boolean;
    min?: number;
    max?: number;
    rangeMessage?: string;
    emptyMessage?: string;
  },
): NumberCommitResult {
  const digits = opts.digits ?? 2;
  const emptyAsZero = opts.emptyAsZero ?? true;
  const emptyCommitsZero = opts.emptyCommitsZero ?? false;
  const trimmed = raw.trim();
  const parsed = parseNumberDraft(raw);
  if (parsed === null) {
    if (!trimmed) {
      if (emptyCommitsZero) {
        const n = 0;
        const { min, max } = opts;
        if (min !== undefined && n < min) {
          return {
            ok: false,
            error: opts.rangeMessage ?? defaultRangeMessage(min, max),
            keepDraft: true,
          };
        }
        if (max !== undefined && n > max) {
          return {
            ok: false,
            error: opts.rangeMessage ?? defaultRangeMessage(min, max),
            keepDraft: true,
          };
        }
        return { ok: true, n };
      }
      if (emptyAsZero) {
        return {
          ok: false,
          error: opts.emptyMessage ?? "Inserisci un importo",
          keepDraft: false,
        };
      }
      // Day/month etc.: restore previous, no silent rewrite.
      return { ok: false, error: "", keepDraft: false };
    }
    return { ok: false, error: "Numero non valido", keepDraft: false };
  }
  const n =
    digits === 0
      ? Math.round(parsed)
      : Math.round(parsed * 10 ** digits) / 10 ** digits;
  const { min, max } = opts;
  if (min !== undefined && n < min) {
    return {
      ok: false,
      error: opts.rangeMessage ?? defaultRangeMessage(min, max),
      keepDraft: true,
    };
  }
  if (max !== undefined && n > max) {
    return {
      ok: false,
      error: opts.rangeMessage ?? defaultRangeMessage(min, max),
      keepDraft: true,
    };
  }
  return { ok: true, n };
}

type NumberFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type" | "onBlur" | "onFocus" | "min" | "max"
> & {
  value: number;
  onCommit: (n: number) => void;
  /**
   * Live parse while typing (null = empty/invalid or draft cleared).
   * Lets parents keep labels in sync before blur commit.
   */
  onDraft?: (n: number | null) => void;
  /** Digits when idle (not focused). Default 2. */
  digits?: number;
  /**
   * Money-style empty blur: show "Inserisci un importo" and restore previous
   * (never silently commit 0). Default true. Day fields pass false.
   */
  emptyAsZero?: boolean;
  /** Empty blur commits 0 (Casa mq etc.). Overrides emptyAsZero on empty. */
  emptyCommitsZero?: boolean;
  /** Inclusive lower bound; out-of-range keeps typed value + error (no overwrite). */
  min?: number;
  /** Inclusive upper bound; out-of-range keeps typed value + error (no overwrite). */
  max?: number;
  /** Override range message (e.g. day 1–31). */
  rangeMessage?: string;
};

/**
 * Number input as text so IT decimals (12,34) work; commits on blur.
 * Avoids type=number rejecting commas and mid-edit snap-back to 0.
 * Recalc on blur is intentional — title documents it.
 */
export function NumberField({
  value,
  onCommit,
  onDraft,
  digits = 2,
  emptyAsZero = true,
  emptyCommitsZero = false,
  min,
  max,
  rangeMessage,
  className,
  onKeyDown,
  ...props
}: NumberFieldProps) {
  const format = (n: number) => {
    if (!Number.isFinite(n)) return "";
    if (digits === 0) return String(Math.round(n));
    if (Number.isInteger(n) && digits > 0) return String(n);
    return n.toFixed(digits);
  };

  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState("");
  const display = draft !== null ? draft : format(value);

  // Surface range errors for committed-but-invalid values (e.g. giorno 0 in store).
  const idleRangeError =
    draft === null &&
    Number.isFinite(value) &&
    ((min !== undefined && value < min) || (max !== undefined && value > max))
      ? (rangeMessage ?? defaultRangeMessage(min, max))
      : "";
  const shownError = error || idleRangeError;

  function emitDraft(raw: string | null) {
    if (!onDraft) return;
    if (raw === null) {
      onDraft(null);
      return;
    }
    onDraft(parseNumberDraft(raw));
  }

  function commit(raw: string) {
    const result = resolveNumberCommit(raw, {
      value,
      digits,
      emptyAsZero,
      emptyCommitsZero,
      min,
      max,
      rangeMessage,
    });
    if (!result.ok) {
      setError(result.error);
      if (!result.keepDraft) {
        setDraft(null);
        emitDraft(null);
      }
      return;
    }
    setError("");
    onCommit(result.n);
    setDraft(null);
    emitDraft(null);
  }

  return (
    <>
      <Input
        {...props}
        type="text"
        inputMode={digits === 0 ? "numeric" : "decimal"}
        title="Si salva quando esci dal campo. Va bene la virgola: 12,34"
        aria-invalid={shownError ? true : undefined}
        className={className}
        value={display}
        onChange={(e) => {
          setDraft(e.target.value);
          emitDraft(e.target.value);
          if (error) setError("");
        }}
        onFocus={(e) => {
          const next =
            e.target.value === "0" || e.target.value === "0.00" ? "" : e.target.value;
          setDraft(next);
          emitDraft(next);
        }}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
      />
      {shownError ? (
        <p className="mt-1 text-xs text-brick" role="alert">
          {shownError}
        </p>
      ) : null}
    </>
  );
}
