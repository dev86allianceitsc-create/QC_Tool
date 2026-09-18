import { ValidationPipe } from "@nestjs/common";
import { PutRequestInputDto } from "./put-request-input.dto";

// Exercises the same global ValidationPipe (whitelist + forbidNonWhitelisted +
// transform) that main.ts installs, to empirically verify the required-but-
// nullable requestBody semantics (§6.1) and the §6.2 field exclusions that a
// hand-built DTO instance would not catch.
describe("PutRequestInputDto (real ValidationPipe)", () => {
  function transformBody(body: unknown) {
    const pipe = new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true });
    return pipe.transform(body, { type: "body", metatype: PutRequestInputDto, data: "" });
  }

  it("accepts the full frozen shape: query/header parameters plus a JSON body definition", async () => {
    const result = (await transformBody({
      queryParameters: [{ name: "status", required: true }],
      headerParameters: [{ name: "X-Trace-Id", required: false }],
      requestBody: { bodyType: "JSON" },
    })) as PutRequestInputDto;

    expect(result).toBeInstanceOf(PutRequestInputDto);
    expect(result.queryParameters[0]).toMatchObject({ name: "status", required: true });
    expect(result.headerParameters[0]).toMatchObject({ name: "X-Trace-Id", required: false });
    expect(result.requestBody).toMatchObject({ bodyType: "JSON" });
  });

  it("accepts requestBody: null to mean 'no Body Definition', with empty query/header arrays", async () => {
    const result = (await transformBody({ queryParameters: [], headerParameters: [], requestBody: null })) as PutRequestInputDto;

    expect(result.queryParameters).toEqual([]);
    expect(result.headerParameters).toEqual([]);
    expect(result.requestBody).toBeNull();
  });

  it("rejects an omitted requestBody field — required-but-nullable, not optional", async () => {
    await expect(transformBody({ queryParameters: [], headerParameters: [] })).rejects.toMatchObject({
      response: { message: expect.arrayContaining([expect.stringContaining("requestBody")]) },
    });
  });

  it("rejects an omitted queryParameters field", async () => {
    await expect(transformBody({ headerParameters: [], requestBody: null })).rejects.toMatchObject({
      response: { message: expect.arrayContaining([expect.stringContaining("queryParameters")]) },
    });
  });

  it("rejects an omitted headerParameters field", async () => {
    await expect(transformBody({ queryParameters: [], requestBody: null })).rejects.toMatchObject({
      response: { message: expect.arrayContaining([expect.stringContaining("headerParameters")]) },
    });
  });

  it("rejects a bodyType outside the supported allowlist (400, not silently coerced)", async () => {
    await expect(
      transformBody({ queryParameters: [], headerParameters: [], requestBody: { bodyType: "XML" } }),
    ).rejects.toMatchObject({
      response: { message: expect.arrayContaining([expect.stringContaining("bodyType")]) },
    });
  });

  it.each(["pathParameters", "apiId", "projectId", "httpMethod", "path"])(
    "rejects the excluded top-level field '%s' via whitelist/forbidNonWhitelisted",
    async (field) => {
      await expect(
        transformBody({ queryParameters: [], headerParameters: [], requestBody: null, [field]: "nope" }),
      ).rejects.toMatchObject({
        response: { message: [expect.stringContaining(`property ${field} should not exist`)] },
      });
    },
  );

  it.each(["parameter", "value", "defaultValue", "example", "schema"])(
    "rejects the excluded per-parameter field '%s' on a queryParameters item",
    async (field) => {
      await expect(
        transformBody({ queryParameters: [{ name: "status", required: true, [field]: "nope" }], headerParameters: [], requestBody: null }),
      ).rejects.toMatchObject({
        response: { message: [expect.stringContaining(`property ${field} should not exist`)] },
      });
    },
  );

  it("rejects a requestBody payload carrying credential-shaped fields (authorization/credential/token/password)", async () => {
    await expect(
      transformBody({ queryParameters: [], headerParameters: [], requestBody: { bodyType: "JSON", authorization: "Bearer x" } }),
    ).rejects.toMatchObject({
      response: { message: [expect.stringContaining("property authorization should not exist")] },
    });
  });

  it.each(["runValues", "bodyValue", "jsonPayload"])(
    "rejects the excluded Run-scoped field '%s' at the top level",
    async (field) => {
      await expect(
        transformBody({ queryParameters: [], headerParameters: [], requestBody: null, [field]: {} }),
      ).rejects.toMatchObject({
        response: { message: [expect.stringContaining(`property ${field} should not exist`)] },
      });
    },
  );
});
