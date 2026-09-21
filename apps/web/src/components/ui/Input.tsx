import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

const FIELD_CLASSES =
  "w-full rounded-md border border-border px-3 py-2 text-sm text-gray-900 placeholder:text-muted focus:border-gray-400 focus:outline-none disabled:bg-gray-50 disabled:text-muted";

// Label wraps a <span> immediately followed by the field, so the DOM shape
// (`getByText(label).nextElementSibling`) existing tests rely on keeps working.
export function Input({
  label,
  error,
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string | null }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-gray-900">{label}</span>
      <input {...rest} className={`${FIELD_CLASSES} ${className}`} />
      {error && <span className="mt-1 block text-xs text-error">{error}</span>}
    </label>
  );
}

export function Textarea({
  label,
  error,
  className = "",
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string | null }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-gray-900">{label}</span>
      <textarea {...rest} className={`${FIELD_CLASSES} min-h-[60px] resize-y ${className}`} />
      {error && <span className="mt-1 block text-xs text-error">{error}</span>}
    </label>
  );
}
