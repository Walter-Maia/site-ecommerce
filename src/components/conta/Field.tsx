import clsx from "clsx";
import type { InputHTMLAttributes, ReactNode } from "react";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
  error?: string;
  hint?: ReactNode;
}

/** Campo com rótulo, dica e erro ligados por aria-describedby. */
export function Field({ label, name, error, hint, id, className, ...rest }: FieldProps) {
  const fieldId = id ?? `campo-${name.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const describedBy = [hint ? `${fieldId}-dica` : null, error ? `${fieldId}-erro` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <label htmlFor={fieldId} className="t-label mb-2 block text-ink-2">
        {label}
      </label>
      <input
        id={fieldId}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={clsx(
          "block min-h-12 w-full border bg-paper px-3 text-base text-ink outline-none transition-colors placeholder:text-mute focus:border-ink",
          error ? "border-signal" : "border-line",
        )}
        {...rest}
      />
      {hint ? (
        <p id={`${fieldId}-dica`} className="mt-1.5 text-xs text-mute">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${fieldId}-erro`} className="mt-1.5 text-sm text-signal">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function FormAlert({ children, tone = "error" }: { children: ReactNode; tone?: "error" | "ok" }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={clsx(
        "border px-4 py-3 text-sm",
        tone === "error" ? "border-signal/40 bg-signal/5 text-signal" : "border-line bg-sand text-ink",
      )}
    >
      {children}
    </p>
  );
}
