import type { ReactNode } from "react";

// Shared overlay shell for the existing Create/Edit modals — wrapper only.
// Each caller keeps its own field/validate/submit logic untouched.
export function Modal({ title, width = "420px", children }: { title: string; width?: string; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full rounded-lg border border-border bg-white p-5 shadow-lg" style={{ maxWidth: width }}>
        <h3 className="m-0 mb-4 text-base font-semibold text-gray-900">{title}</h3>
        {children}
      </div>
    </div>
  );
}
