import * as React from 'react';
import { cn } from '../utils/cn';

/**
 * Composants de formulaire aux tokens brand-* (tunnel de demande P05).
 * Compatibles react-hook-form (forwardRef) et accessibles (label, erreurs en
 * français avec role="alert", focus visible).
 */

const fieldBase =
  'w-full rounded-xl border bg-brand-surface px-4 py-3 text-sm font-medium text-brand-text placeholder:text-brand-text-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-1';

const fieldState = (invalid?: boolean) =>
  invalid
    ? 'border-brand-accent ring-1 ring-brand-accent/40'
    : 'border-brand-border hover:border-brand-border-dark';

/* --------------------------------- Field ---------------------------------- */

interface FieldProps {
  label: string;
  htmlFor: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

export function Field({ label, htmlFor, required, hint, error, children, className }: FieldProps) {
  // Liaison accessible : le contrôle est décrit par son hint et/ou son erreur.
  const hintId = `${htmlFor}-hint`;
  const errorId = `${htmlFor}-error`;
  const describedBy = [error ? errorId : null, hint && !error ? hintId : null]
    .filter(Boolean)
    .join(' ') || undefined;

  const control = React.isValidElement(children)
    ? React.cloneElement(
        children as React.ReactElement<Record<string, unknown> & { id?: string }>,
        { 'aria-describedby': describedBy },
      )
    : children;

  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-brand-text mb-2">
        {label}
        {required && <span className="text-brand-accent ml-1" aria-hidden="true">*</span>}
      </label>
      {control}
      {hint && !error && <p id={hintId} className="mt-1.5 text-xs text-brand-text-muted">{hint}</p>}
      {error && (
        <p id={errorId} className="mt-1.5 text-sm font-medium text-brand-accent" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/* --------------------------------- Inputs --------------------------------- */

interface BaseFieldProps {
  invalid?: boolean;
}

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & BaseFieldProps
>(({ className, invalid, type = 'text', ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    aria-invalid={invalid || undefined}
    className={cn(fieldBase, fieldState(invalid), className)}
    {...props}
  />
));
Input.displayName = 'Input';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & BaseFieldProps
>(({ className, invalid, rows = 4, ...props }, ref) => (
  <textarea
    ref={ref}
    rows={rows}
    aria-invalid={invalid || undefined}
    className={cn(fieldBase, fieldState(invalid), 'resize-none', className)}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & BaseFieldProps
>(({ className, invalid, children, ...props }, ref) => (
  <select
    ref={ref}
    aria-invalid={invalid || undefined}
    className={cn(fieldBase, fieldState(invalid), 'appearance-none cursor-pointer bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%236B6661%27 stroke-width=%272%27%3E%3Cpath d=%27m6 9 6 6 6-6%27/%3E%3C/svg%3E")] bg-[length:14px] bg-[right_1rem_center] bg-no-repeat pr-10', className)}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = 'Select';

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: React.ReactNode;
  description?: string;
  invalid?: boolean;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, invalid, className, id, ...props }, ref) => (
    <label
      htmlFor={id}
      className={cn(
        'flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors',
        invalid ? 'border-brand-accent bg-brand-accent/5' : 'border-brand-border bg-brand-bg hover:border-brand-border-dark',
        className,
      )}
    >
      <input
        ref={ref}
        id={id}
        type="checkbox"
        aria-invalid={invalid || undefined}
        className="mt-0.5 h-4 w-4 rounded border-brand-border-dark text-brand-accent accent-brand-accent focus-visible:ring-2 focus-visible:ring-brand-accent shrink-0 cursor-pointer"
        {...props}
      />
      <span className="text-sm leading-relaxed">
        <span className="font-semibold text-brand-text block">{label}</span>
        {description && <span className="text-brand-text-muted block mt-0.5">{description}</span>}
      </span>
    </label>
  ),
);
Checkbox.displayName = 'Checkbox';
