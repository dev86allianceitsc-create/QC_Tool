import { UNKNOWN_VERSION, displayVersion, validateVersion } from "./version.util";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";

// REVISION 3C-R01 — Run API / Version Metadata (REQ-VER-001, UI-VER-01): API
// Version and Database Version are per-Run metadata, optional and declared
// independently — leaving one blank records it as UNKNOWN without blocking
// the other. Controlled via props so RunApiArea can share the same draft
// with Request Preview; persistence remains deferred (no Run model yet).
export function RunVersionMetadataPanel({
  apiVersion,
  dbVersion,
  onApiVersionChange,
  onDbVersionChange,
}: {
  apiVersion: string;
  dbVersion: string;
  onApiVersionChange: (value: string) => void;
  onDbVersionChange: (value: string) => void;
}) {
  return (
    <Card>
      <h3 className="m-0 mb-2 text-base font-semibold text-gray-900">Version Metadata</h3>
      <p className="m-0 mb-3 text-xs text-muted">
        Optional. Each field is declared independently for this Run; leaving one blank records it as {UNKNOWN_VERSION} and does not block the other.
      </p>
      <div className="flex flex-col gap-3">
        <Input
          label="API Version"
          value={apiVersion}
          onChange={(e) => onApiVersionChange(e.target.value)}
          placeholder={UNKNOWN_VERSION}
          error={validateVersion(apiVersion, "API Version")}
        />
        <Input
          label="Database Version"
          value={dbVersion}
          onChange={(e) => onDbVersionChange(e.target.value)}
          placeholder={UNKNOWN_VERSION}
          error={validateVersion(dbVersion, "Database Version")}
        />
        {/* VER-AC-02/03 and AC-UI-3C-05: what the Run would record has to be
            visible before the Run, including the UNKNOWN case. */}
        <p className="m-0 text-xs text-muted">
          Will be recorded as — API Version: <span className="font-mono text-gray-900">{displayVersion(apiVersion)}</span>, Database Version:{" "}
          <span className="font-mono text-gray-900">{displayVersion(dbVersion)}</span>
        </p>
      </div>
    </Card>
  );
}
