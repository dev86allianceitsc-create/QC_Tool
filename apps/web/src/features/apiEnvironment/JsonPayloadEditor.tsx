import { useRef, useState } from "react";
import { JsonHighlight } from "../../components/ui/JsonHighlight";

// UI-INP-07/REQ-INP-005 support: syntax-only JSON validation for a manually
// entered Run payload (REQ-INP-004). No schema validation, no size limits,
// no forced object-root — any valid JSON value is accepted. Empty input is a
// neutral "not yet entered" state, not an error and not coerced to {}/null.
//
// The colored layer is a <pre> mirror stacked behind the real <textarea>,
// which renders its own text transparent (only the caret stays visible) —
// the classic overlay technique, since a native <textarea> can't color
// individual characters. Both layers share the same font/padding/border/
// wrapping so glyphs line up exactly, and scroll position is synced on
// every scroll event.
export function JsonPayloadEditor({ value, onChange, autoFocus }: { value: string; onChange: (value: string) => void; autoFocus?: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const preRef = useRef<HTMLPreElement>(null);

  function validate(next: string) {
    if (next.trim() === "") {
      setError(null);
      return;
    }
    try {
      JSON.parse(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid JSON");
    }
  }

  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-gray-900" htmlFor="json-payload-editor">
        JSON Payload
      </label>
      <div className="relative">
        <pre
          ref={preRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 m-0 overflow-hidden whitespace-pre-wrap break-all rounded-md border border-transparent p-2 font-mono text-xs leading-5 text-gray-900"
        >
          <JsonHighlight value={value} />
          {"\n"}
        </pre>
        <textarea
          id="json-payload-editor"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            validate(e.target.value);
          }}
          onBlur={(e) => validate(e.target.value)}
          onScroll={(e) => {
            if (preRef.current) {
              preRef.current.scrollTop = e.currentTarget.scrollTop;
              preRef.current.scrollLeft = e.currentTarget.scrollLeft;
            }
          }}
          rows={8}
          autoFocus={autoFocus}
          spellCheck={false}
          placeholder="Enter JSON payload for this Run"
          className="relative z-10 m-0 w-full resize-none overflow-auto whitespace-pre-wrap break-all rounded-md border border-border p-2 font-mono text-xs leading-5 text-transparent caret-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none"
        />
      </div>
      {value.trim() !== "" &&
        (error ? (
          <p className="m-0 mt-1.5 text-xs text-error">Invalid JSON: {error}</p>
        ) : (
          <p className="m-0 mt-1.5 text-xs text-success">Valid JSON</p>
        ))}
    </div>
  );
}
