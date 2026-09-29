import type { ReactNode } from 'react';

import type { ApiError } from '@shared/schemas';

/* -------------------------------------------------------------------------- */
/* Layout                                                                      */
/* -------------------------------------------------------------------------- */

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#eef2ed]">
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-brand focus:px-5 focus:py-2.5 focus:text-[13px] focus:font-extrabold focus:text-white"
      >
        Skip to dashboard
      </a>
      {children}
    </div>
  );
}

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-[16px] border border-line bg-white p-6 ${className}`}>
      {children}
    </div>
  );
}

export function SectionTitle({
  title,
  count,
  description,
}: {
  title: string;
  count?: number;
  description?: string;
}) {
  return (
    <div className="mb-5">
      <h2 className="flex items-center gap-2 text-[15px] font-extrabold tracking-[0.16em] uppercase">
        {title}
        {count !== undefined ? <span className="text-muted">({count})</span> : null}
      </h2>
      {description ? <p className="mt-1.5 text-sm text-muted">{description}</p> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Tabs                                                                        */
/* -------------------------------------------------------------------------- */

export interface TabDefinition {
  id: string;
  label: string;
}

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: TabDefinition[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Dashboard sections"
      className="flex flex-wrap gap-2 border-b border-line pb-3"
    >
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`panel-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className={`rounded-full px-4 py-2 text-[13px] font-extrabold transition ${
              selected
                ? 'bg-brand text-white'
                : 'bg-white text-brand-900 border border-line hover:border-brand'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Tab panels are all mounted and hidden with `hidden` rather than unmounted, so
 * switching tabs does not discard an in-progress form.
 */
export function TabPanel({
  id,
  active,
  children,
}: {
  id: string;
  active: string;
  children: ReactNode;
}) {
  return (
    <div
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={`tab-${id}`}
      hidden={id !== active}
      tabIndex={0}
      className="pt-6 focus-visible:shadow-[0_0_0_3px_rgba(22,76,61,.35)]"
    >
      {id === active ? children : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Form controls                                                              */
/* -------------------------------------------------------------------------- */

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-extrabold">
        {label}
      </label>
      {children}
      {hint && !error ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
      {error ? (
        <p id={`${htmlFor}-error`} className="mt-1 text-xs font-bold text-coral">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const inputClass =
  'w-full rounded-[10px] border border-line bg-white px-3.5 py-2.5 text-[15px] outline-none transition focus:border-brand focus:shadow-[0_0_0_3px_rgba(22,76,61,.14)]';

export function TextInput({
  id,
  value,
  onChange,
  invalid,
  ...rest
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id' | 'value' | 'onChange'>) {
  return (
    <input
      id={id}
      value={value}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? `${id}-error` : undefined}
      onChange={(event) => onChange(event.target.value)}
      className={`${inputClass} ${invalid ? 'border-coral' : ''}`}
      {...rest}
    />
  );
}

export function TextArea({
  id,
  value,
  onChange,
  invalid,
  rows = 3,
  ...rest
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  rows?: number;
} & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'id' | 'value' | 'onChange' | 'rows'>) {
  return (
    <textarea
      id={id}
      rows={rows}
      value={value}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? `${id}-error` : undefined}
      onChange={(event) => onChange(event.target.value)}
      className={`${inputClass} resize-y ${invalid ? 'border-coral' : ''}`}
      {...rest}
    />
  );
}

export function Select({
  id,
  value,
  onChange,
  options,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  invalid?: boolean;
}) {
  return (
    <select
      id={id}
      value={value}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? `${id}-error` : undefined}
      onChange={(event) => onChange(event.target.value)}
      className={`${inputClass} ${invalid ? 'border-coral' : ''}`}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function NumberInput({
  id,
  value,
  onChange,
  invalid,
  ...rest
}: {
  id: string;
  value: number;
  onChange: (value: number) => void;
  invalid?: boolean;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id' | 'value' | 'onChange'>) {
  return (
    <input
      id={id}
      type="number"
      value={value}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? `${id}-error` : undefined}
      onChange={(event) => onChange(Number(event.target.value))}
      className={`${inputClass} ${invalid ? 'border-coral' : ''}`}
      {...rest}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Buttons and feedback                                                        */
/* -------------------------------------------------------------------------- */

export function Button({
  children,
  variant = 'primary',
  ...rest
}: {
  children: ReactNode;
  variant?: 'primary' | 'ghost' | 'danger';
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const tone =
    variant === 'primary'
      ? 'bg-brand text-white hover:bg-[#0f3629] disabled:bg-muted'
      : variant === 'danger'
        ? 'border border-coral/50 bg-white text-coral hover:bg-coral/8 disabled:opacity-50'
        : 'border border-line bg-white text-brand-900 hover:border-brand disabled:opacity-50';

  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-extrabold transition disabled:cursor-not-allowed ${tone}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function ErrorBanner({ error }: { error: ApiError | null }) {
  if (!error) return null;
  return (
    <p
      role="alert"
      className="rounded-[10px] border border-coral/45 bg-coral/8 px-4 py-3 text-sm font-bold text-brand-900"
    >
      {error.message}
    </p>
  );
}

export function SuccessBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="status"
      className="rounded-[10px] border border-moss/45 bg-moss/12 px-4 py-3 text-sm font-bold text-brand-900"
    >
      {message}
    </p>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-[12px] border border-dashed border-line bg-white/60 px-5 py-6 text-sm leading-relaxed text-muted">
      {children}
    </p>
  );
}

/** Per-record action row, so every list item exposes the same affordances. */
export function RowActions({
  onEdit,
  onDelete,
  deleteLabel,
  disabled,
}: {
  onEdit: () => void;
  onDelete: () => void;
  deleteLabel: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex shrink-0 gap-2">
      <Button variant="ghost" onClick={onEdit} disabled={disabled}>
        Edit
      </Button>
      <Button
        variant="danger"
        onClick={onDelete}
        disabled={disabled}
        aria-label={deleteLabel}
      >
        Delete
      </Button>
    </div>
  );
}
