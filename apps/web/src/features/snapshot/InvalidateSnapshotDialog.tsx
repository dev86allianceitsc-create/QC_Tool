import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Textarea } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { SNAPSHOT_INVALIDATION_REASON_MAX_LENGTH } from "./snapshot.constants";
import { useInvalidateSnapshot } from "./useInvalidateSnapshot";
import type { InvalidateSnapshotResult } from "./snapshot.types";

// AnD UI §5 Invalidate flow — ADMIN-only, one-time, reason-required,
// irreversible (there is no un-invalidate). The reason is validated
// client-side (non-blank, capped length) as UX only; the backend remains
// authoritative and this dialog surfaces its error message verbatim on
// failure (e.g. a 409 when another Admin already invalidated the same
// Snapshot first), keeping the entered reason so the user doesn't retype it.
export function InvalidateSnapshotDialog({
  projectId,
  snapshotId,
  accessToken,
  onCancel,
  onSuccess,
}: {
  projectId: string;
  snapshotId: string;
  accessToken: string | null;
  onCancel: () => void;
  onSuccess: (result: InvalidateSnapshotResult) => void;
}) {
  const [reason, setReason] = useState("");
  const { state, error, submit, resetError } = useInvalidateSnapshot(projectId, snapshotId, accessToken);

  const trimmed = reason.trim();
  const isSubmitting = state === "submitting";
  const canSubmit = trimmed.length > 0 && trimmed.length <= SNAPSHOT_INVALIDATION_REASON_MAX_LENGTH && !isSubmitting;

  async function handleConfirm() {
    if (!canSubmit) return;
    const result = await submit(trimmed);
    if (result) {
      onSuccess(result);
    }
  }

  return (
    <Modal title="Invalidate Snapshot" width="480px">
      <p className="m-0 mb-3 text-sm text-gray-700">
        This marks the Snapshot as Invalidated. It stays in Snapshot History for audit purposes but is flagged as no
        longer reliable. This action cannot be undone.
      </p>
      <Textarea
        label="Reason *"
        value={reason}
        onChange={(e) => {
          setReason(e.target.value);
          if (error) resetError();
        }}
        maxLength={SNAPSHOT_INVALIDATION_REASON_MAX_LENGTH}
        placeholder="Explain why this Snapshot is no longer valid…"
        disabled={isSubmitting}
        rows={4}
      />
      {error && <p className="m-0 mt-2 text-xs text-error">{error}</p>}
      <div className="mt-4 flex gap-2.5">
        <Button variant="secondary" className="flex-1" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button variant="danger" className="flex-1" onClick={handleConfirm} disabled={!canSubmit}>
          {isSubmitting ? "Invalidating…" : "Invalidate Snapshot"}
        </Button>
      </div>
    </Modal>
  );
}
