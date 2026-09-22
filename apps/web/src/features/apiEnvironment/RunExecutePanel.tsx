import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";

// REVISION 3C-R01 — Run API / Execute: "Chỉ kích hoạt khi Group Run triển
// khai đúng contract/gates" — deferred, no fake execution. This is an honest
// placeholder, not a disabled button standing in for a feature that looks
// almost-ready; Run/Result/Snapshot/Comparison are out of scope here.
export function RunExecutePanel({ runBlockers }: { runBlockers: string[] }) {
  return (
    <Card>
      <h3 className="m-0 mb-2 text-base font-semibold text-gray-900">Execute</h3>
      <p className="m-0 mb-3 text-sm text-muted">
        Execution not available yet. Running this API, and viewing its Result, Snapshot, or Comparison, is implemented in a later release.
      </p>
      <Button variant="secondary" disabled title="Run execution is not part of this release.">
        Execute
      </Button>
      {runBlockers.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <p className="m-0 mb-1 text-xs font-semibold text-gray-900">Even once available, a Run could not proceed yet:</p>
          <ul className="m-0 list-disc pl-5 text-xs text-muted">
            {runBlockers.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
