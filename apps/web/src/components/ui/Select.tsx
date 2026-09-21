import type { ReactNode, SelectHTMLAttributes } from "react";

export function Select({
  label,
  error,
  children,
  className = "",
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string | null; children: ReactNode }) {
  const field = (
    <select
      {...rest}
      className={`w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none disabled:bg-gray-50 disabled:text-muted ${className}`}
    >
      {children}
    </select>
  );
  if (!label) return field;
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-gray-900">{label}</span>
      {field}
      {error && <span className="mt-1 block text-xs text-error">{error}</span>}
    </label>
  );
}
