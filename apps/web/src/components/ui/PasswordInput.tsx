import { useState } from "react";
import type { InputHTMLAttributes } from "react";

const FIELD_CLASSES =
  "w-full rounded-md border border-border px-3 py-2 pr-16 text-sm text-gray-900 placeholder:text-muted focus:border-gray-400 focus:outline-none disabled:bg-gray-50 disabled:text-muted";

// Same label/DOM shape as Input.tsx, plus a show/hide toggle for secret
// values (Password, Bearer Token) that are write-only and never pre-filled.
export function PasswordInput({
  label,
  error,
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string | null }) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-gray-900">{label}</span>
      <div className="relative">
        <input {...rest} type={visible ? "text" : "password"} className={`${FIELD_CLASSES} ${className}`} />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer border-none bg-transparent text-xs font-medium text-gray-700"
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {error && <span className="mt-1 block text-xs text-error">{error}</span>}
    </label>
  );
}
