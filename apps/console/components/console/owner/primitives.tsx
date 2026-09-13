'use client';

import type { ReactNode } from 'react';

/**
 * Shared pieces for the owner dashboard.
 *
 * Kept deliberately plain. This page is where someone decides how much of their
 * money an autonomous agent may spend, so every control states what it will do
 * before it does it, and nothing is styled to look more finished than it is.
 */

export function Panel({
  title,
  step,
  children,
  note,
  done,
}: {
  title: string;
  step?: number;
  children: ReactNode;
  note?: string;
  done?: boolean;
}) {
  return (
    <section className="border border-hairline rounded-doc bg-harbor">
      <header className="flex items-baseline gap-3 px-5 py-3 border-b border-hairline">
        {step !== undefined && (
          <span
            className={`font-mono text-small w-6 h-6 grid place-items-center rounded-full border ${
              done
                ? 'border-seal text-seal'
                : 'border-hairline text-manifest/40'
            }`}
            aria-label={done ? 'done' : `step ${step}`}
          >
            {done ? '✓' : step}
          </span>
        )}
        <h2 className="font-mono text-small uppercase tracking-wide text-manifest">{title}</h2>
      </header>
      <div className="px-5 py-4">
        {note && <p className="text-small text-manifest/50 mb-4 max-w-2xl">{note}</p>}
        {children}
      </div>
    </section>
  );
}

export function Field({ label, value, mono = true }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 border-b border-hairline/50 last:border-0">
      <span className="text-small text-manifest/50 shrink-0">{label}</span>
      <span className={`text-small text-manifest text-right break-all ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
    </div>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  tone = 'default',
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: 'default' | 'primary' | 'danger';
  type?: 'button' | 'submit';
}) {
  const tones = {
    default: 'border-hairline text-manifest hover:bg-deepwater',
    primary: 'border-manifest bg-manifest text-harbor hover:opacity-90',
    danger: 'border-stamp text-stamp hover:bg-stamp/5',
  } as const;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`font-mono text-small px-3 py-1.5 rounded-control border transition
        disabled:opacity-40 disabled:cursor-not-allowed ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

export function Input({
  value,
  onChange,
  placeholder,
  label,
  hint,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      {label && <span className="block text-small text-manifest/50 mb-1">{label}</span>}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full font-mono text-small px-3 py-1.5 rounded-control border border-hairline
          bg-harbor text-manifest placeholder:text-manifest/30
          focus:outline-none focus:border-manifest/40"
      />
      {hint && <span className="block text-small text-manifest/40 mt-1">{hint}</span>}
    </label>
  );
}

/** Outcome-coloured status line. seal/stamp/hold stay reserved for verdicts. */
export function Status({ kind, children }: { kind: 'ok' | 'error' | 'pending'; children: ReactNode }) {
  const tones = { ok: 'text-seal', error: 'text-stamp', pending: 'text-hold' } as const;
  return <p className={`text-small font-mono mt-3 ${tones[kind]}`}>{children}</p>;
}

/** Shorten an address for display without hiding it — the full value is the title. */
export function Addr({ value }: { value: string }) {
  return (
    <a
      href={`https://testnet.arcscan.app/address/${value}`}
      target="_blank"
      rel="noreferrer"
      title={value}
      className="font-mono underline decoration-hairline hover:decoration-manifest"
    >
      {value.slice(0, 6)}…{value.slice(-4)}
    </a>
  );
}

export function TxLink({ hash, children }: { hash: string; children?: ReactNode }) {
  return (
    <a
      href={`https://testnet.arcscan.app/tx/${hash}`}
      target="_blank"
      rel="noreferrer"
      className="underline decoration-hairline hover:decoration-manifest"
    >
      {children ?? `${hash.slice(0, 10)}…`}
    </a>
  );
}
