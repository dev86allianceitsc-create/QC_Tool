export type JsonTokenType = "key" | "string" | "number" | "boolean" | "null" | "punctuation" | "text";

interface JsonToken {
  type: JsonTokenType;
  value: string;
}

const PUNCTUATION = new Set(["{", "}", "[", "]", ":", ","]);

// A lexer, not a parser: it never throws and never requires balanced or
// complete JSON, so it can color a payload that's still being typed
// (JsonPayloadEditor's live overlay) as well as a known-valid payload the
// backend returned (RunExecutePanel/RunRequestPreviewPanel). A quoted string
// is classified as a "key" only when the next non-whitespace character is a
// ':' — the one piece of structural lookahead this needs.
function tokenizeJson(input: string): JsonToken[] {
  const tokens: JsonToken[] = [];
  let i = 0;
  const n = input.length;

  while (i < n) {
    const ch = input[i];

    if (/\s/.test(ch)) {
      let j = i + 1;
      while (j < n && /\s/.test(input[j])) j++;
      tokens.push({ type: "text", value: input.slice(i, j) });
      i = j;
      continue;
    }

    if (ch === '"') {
      let j = i + 1;
      let closed = false;
      while (j < n) {
        if (input[j] === "\\") {
          j += 2;
          continue;
        }
        if (input[j] === '"') {
          closed = true;
          j++;
          break;
        }
        j++;
      }
      const end = closed ? j : n;
      let k = end;
      while (k < n && /\s/.test(input[k])) k++;
      tokens.push({ type: input[k] === ":" ? "key" : "string", value: input.slice(i, end) });
      i = end;
      continue;
    }

    const lookahead = input.slice(i, i + 5);
    if (/^(true|false)/.test(lookahead)) {
      const value = lookahead.startsWith("false") ? "false" : "true";
      tokens.push({ type: "boolean", value });
      i += value.length;
      continue;
    }
    if (/^null/.test(lookahead)) {
      tokens.push({ type: "null", value: "null" });
      i += 4;
      continue;
    }

    if (ch === "-" || (ch >= "0" && ch <= "9")) {
      let j = ch === "-" ? i + 1 : i;
      while (j < n && input[j] >= "0" && input[j] <= "9") j++;
      if (input[j] === ".") {
        j++;
        while (j < n && input[j] >= "0" && input[j] <= "9") j++;
      }
      if (input[j] === "e" || input[j] === "E") {
        j++;
        if (input[j] === "+" || input[j] === "-") j++;
        while (j < n && input[j] >= "0" && input[j] <= "9") j++;
      }
      if (j > i + (ch === "-" ? 1 : 0)) {
        tokens.push({ type: "number", value: input.slice(i, j) });
        i = j;
        continue;
      }
    }

    if (PUNCTUATION.has(ch)) {
      tokens.push({ type: "punctuation", value: ch });
      i++;
      continue;
    }

    let j = i + 1;
    while (j < n && !PUNCTUATION.has(input[j]) && input[j] !== '"' && !/\s/.test(input[j])) j++;
    tokens.push({ type: "text", value: input.slice(i, j) });
    i = j;
  }

  return tokens;
}

const TOKEN_CLASS: Record<JsonTokenType, string> = {
  key: "text-json-key",
  string: "text-json-string",
  number: "text-json-number",
  boolean: "text-json-boolean",
  null: "text-json-null",
  punctuation: "text-json-punctuation",
  text: "",
};

// Colors JSON like a real code editor without a syntax-highlighting
// dependency. Purely presentational — it tokenizes and wraps in colored
// <span>s, never altering the text itself, so it's safe to use both over
// already-validated JSON and over still-being-typed, possibly-invalid input.
export function JsonHighlight({ value }: { value: string }) {
  return (
    <>
      {tokenizeJson(value).map((token, index) => (
        <span key={index} className={TOKEN_CLASS[token.type]}>
          {token.value}
        </span>
      ))}
    </>
  );
}
