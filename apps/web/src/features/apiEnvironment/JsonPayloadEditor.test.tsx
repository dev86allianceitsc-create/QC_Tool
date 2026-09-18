import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JsonPayloadEditor } from "./JsonPayloadEditor";

function Wrapper({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <JsonPayloadEditor value={value} onChange={setValue} />;
}

describe("JsonPayloadEditor", () => {
  it("shows a neutral state (no error, no 'Valid JSON') when empty", () => {
    render(<Wrapper />);
    expect(screen.queryByText("Valid JSON")).not.toBeInTheDocument();
    expect(screen.queryByText(/Invalid JSON/)).not.toBeInTheDocument();
  });

  it("accepts a valid JSON object", () => {
    render(<Wrapper />);
    fireEvent.change(screen.getByLabelText("JSON Payload"), { target: { value: '{"a":1}' } });
    expect(screen.getByText("Valid JSON")).toBeInTheDocument();
  });

  it("accepts a valid JSON array", () => {
    render(<Wrapper />);
    fireEvent.change(screen.getByLabelText("JSON Payload"), { target: { value: "[1,2,3]" } });
    expect(screen.getByText("Valid JSON")).toBeInTheDocument();
  });

  it("accepts a valid JSON primitive root", () => {
    render(<Wrapper />);
    fireEvent.change(screen.getByLabelText("JSON Payload"), { target: { value: "42" } });
    expect(screen.getByText("Valid JSON")).toBeInTheDocument();
  });

  it("shows inline feedback for malformed JSON", () => {
    render(<Wrapper />);
    fireEvent.change(screen.getByLabelText("JSON Payload"), { target: { value: "{invalid" } });
    expect(screen.getByText(/Invalid JSON/)).toBeInTheDocument();
  });

  it("clears feedback when the field is emptied again", () => {
    render(<Wrapper />);
    const textarea = screen.getByLabelText("JSON Payload");
    fireEvent.change(textarea, { target: { value: "{invalid" } });
    expect(screen.getByText(/Invalid JSON/)).toBeInTheDocument();
    fireEvent.change(textarea, { target: { value: "" } });
    expect(screen.queryByText(/Invalid JSON/)).not.toBeInTheDocument();
  });
});
