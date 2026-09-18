import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ParameterDefinitionDialog } from "./ParameterDefinitionDialog";

describe("ParameterDefinitionDialog", () => {
  it("saves a valid Query parameter", () => {
    const onSave = vi.fn();
    render(<ParameterDefinitionDialog location="QUERY" existingNames={[]} onSave={onSave} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Name *"), { target: { value: "status" } });
    fireEvent.click(screen.getByText("Add Parameter"));

    expect(onSave).toHaveBeenCalledWith({ name: "status", required: false });
  });

  it("rejects an empty name", () => {
    const onSave = vi.fn();
    render(<ParameterDefinitionDialog location="QUERY" existingNames={[]} onSave={onSave} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByText("Add Parameter"));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("Name is required.")).toBeInTheDocument();
  });

  it("rejects Authorization as a normal Header, case-insensitively", () => {
    const onSave = vi.fn();
    render(<ParameterDefinitionDialog location="HEADER" existingNames={[]} onSave={onSave} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Name *"), { target: { value: "AUTHORIZATION" } });
    fireEvent.click(screen.getByText("Add Parameter"));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/is reserved and cannot be configured as a normal Header/)).toBeInTheDocument();
  });

  it("rejects Content-Type as a normal Header, case-insensitively", () => {
    const onSave = vi.fn();
    render(<ParameterDefinitionDialog location="HEADER" existingNames={[]} onSave={onSave} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Name *"), { target: { value: "content-type" } });
    fireEvent.click(screen.getByText("Add Parameter"));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/is reserved and cannot be configured as a normal Header/)).toBeInTheDocument();
  });

  it("does not reject a reserved header name for a Query parameter", () => {
    const onSave = vi.fn();
    render(<ParameterDefinitionDialog location="QUERY" existingNames={[]} onSave={onSave} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Name *"), { target: { value: "authorization" } });
    fireEvent.click(screen.getByText("Add Parameter"));

    expect(onSave).toHaveBeenCalledWith({ name: "authorization", required: false });
  });

  it("rejects a duplicate Query name case-sensitively (same case only)", () => {
    const onSave = vi.fn();
    render(<ParameterDefinitionDialog location="QUERY" existingNames={["status"]} onSave={onSave} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Name *"), { target: { value: "status" } });
    fireEvent.click(screen.getByText("Add Parameter"));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/Duplicate Query parameter name/)).toBeInTheDocument();
  });

  it("accepts a Query name differing only by case from an existing one", () => {
    const onSave = vi.fn();
    render(<ParameterDefinitionDialog location="QUERY" existingNames={["status"]} onSave={onSave} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Name *"), { target: { value: "Status" } });
    fireEvent.click(screen.getByText("Add Parameter"));

    expect(onSave).toHaveBeenCalledWith({ name: "Status", required: false });
  });

  it("rejects a duplicate Header name case-insensitively", () => {
    const onSave = vi.fn();
    render(<ParameterDefinitionDialog location="HEADER" existingNames={["X-Client-ID"]} onSave={onSave} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Name *"), { target: { value: "x-client-id" } });
    fireEvent.click(screen.getByText("Add Parameter"));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/Duplicate Header parameter name/)).toBeInTheDocument();
  });

  it("calls onCancel without saving", () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    render(<ParameterDefinitionDialog location="QUERY" existingNames={[]} onSave={onSave} onCancel={onCancel} />);

    fireEvent.click(screen.getByText("Cancel"));

    expect(onCancel).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("does not render a value/default field", () => {
    render(<ParameterDefinitionDialog location="QUERY" existingNames={[]} onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText("No value is stored here. Value is entered when preparing a Run.")).toBeInTheDocument();
  });
});
