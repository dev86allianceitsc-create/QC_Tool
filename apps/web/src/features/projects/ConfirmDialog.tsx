// Generic confirmation overlay for new PRJ actions (Activate/Deactivate,
// Soft Delete, Remove Member). Modeled visually on App.tsx's existing Cancel
// Invitation overlay, but kept as its own component so that existing modal
// is left completely untouched.
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancel",
  danger,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-[400px] rounded-lg border border-border bg-white p-5 text-center shadow-lg">
        <h3 className="m-0 mb-2 text-base font-semibold text-gray-900">{title}</h3>
        <p className="m-0 mb-4 text-sm text-muted">{message}</p>
        <div className="flex gap-2.5">
          <button
            onClick={onCancel}
            className="flex-1 cursor-pointer rounded-md border border-border bg-white px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 cursor-pointer rounded-md border px-3 py-2 text-sm font-medium ${
              danger ? "border-error text-error hover:bg-error-light" : "border-primary bg-primary text-white hover:bg-primary-hover"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
