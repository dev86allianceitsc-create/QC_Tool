import { ValidationPipe } from "@nestjs/common";
import { ImportOpenApiCandidateDto, ImportOpenApiDto } from "./import-openapi.dto";

// Regression test for a confirmed bug: the frozen selectedCandidates item
// shape {httpMethod, path} was rejected by the real request pipeline with
// "property httpMethod should not exist" / "property path should not exist",
// even though those are exactly the fields ImportOpenApiCandidateDto
// declares. Must exercise the same global ValidationPipe (whitelist +
// forbidNonWhitelisted + transform) that main.ts installs — validating a
// hand-built DTO instance directly would not have caught this, since the bug
// only manifests when the multipart JSON string is parsed and transformed
// into nested instances by the pipe itself.
describe("ImportOpenApiDto (multipart confirm-import request)", () => {
  function transformBody(rawSelectedCandidates: string) {
    const pipe = new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true });
    return pipe.transform(
      { selectedCandidates: rawSelectedCandidates },
      { type: "body", metatype: ImportOpenApiDto, data: "" },
    );
  }

  it("accepts the real UI request shape — selectedCandidates as a JSON-encoded array of {httpMethod, path}", async () => {
    const raw = JSON.stringify([
      { httpMethod: "GET", path: "/users" },
      { httpMethod: "POST", path: "/users" },
    ]);

    const result = (await transformBody(raw)) as ImportOpenApiDto;

    expect(result.selectedCandidates).toHaveLength(2);
    expect(result.selectedCandidates[0]).toBeInstanceOf(ImportOpenApiCandidateDto);
    expect(result.selectedCandidates[0]).toMatchObject({ httpMethod: "GET", path: "/users" });
    expect(result.selectedCandidates[1]).toMatchObject({ httpMethod: "POST", path: "/users" });
  });

  it("still rejects a candidate with an actually-unknown property", async () => {
    const raw = JSON.stringify([{ httpMethod: "GET", path: "/users", extra: "nope" }]);

    await expect(transformBody(raw)).rejects.toMatchObject({
      response: { message: [expect.stringContaining("property extra should not exist")] },
    });
  });

  it("still rejects a candidate missing a required field", async () => {
    const raw = JSON.stringify([{ httpMethod: "GET" }]);

    await expect(transformBody(raw)).rejects.toMatchObject({
      response: { message: expect.arrayContaining([expect.stringContaining("path")]) },
    });
  });
});
