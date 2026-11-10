import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { ApiError, createBrowserApi } from "../src/browser/api";
import { people, PERSON_ID, site } from "./helpers";

function client(data: unknown, status = 200) {
  const fetcher = mock.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  );
  return {
    fetcher,
    api: createBrowserApi(
      "https://api.example.test/api/",
      fetcher as typeof fetch,
    ),
  };
}

test("uses the configured API URL and encodes a normalized address into a single route parameter", async () => {
  const { fetcher, api } = client({ ...site, address: "harbor.local/guide" });
  await api.getSite(" HTTPS://Harbor.Local/Guide/// ");
  assert.equal(
    fetcher.mock.calls[0].arguments[0],
    "https://api.example.test/api/sites/harbor.local%2Fguide",
  );
});

test("loads typed people and never preserves raw HTML on the client page object", async () => {
  assert.deepEqual(await client(people).api.listPeople(), people);
  const result = await client({
    ...site,
    html: "<script>unsafe()</script>",
  }).api.getSite("harbor.local");
  assert.equal("html" in result, false);
  assert.equal(result.sanitizedHtml, site.sanitizedHtml);
});

test("rejects an old or malformed API response without sanitizedHtml", async () => {
  await assert.rejects(
    () =>
      client({
        ...site,
        sanitizedHtml: undefined,
        html: "<h1>raw</h1>",
      }).api.getSite("harbor.local"),
    /sanitized page/,
  );
  await assert.rejects(
    () => client({ people: [] }).api.listPeople(),
    /people list/,
  );
});

test("writes only the Visit input fields with the supplied typed or link source", async () => {
  for (const source of ["typed", "link"] as const) {
    const { fetcher, api } = client({ _id: "visit" }, 201);
    const visit = { person: PERSON_ID, address: "harbor.local", source };
    await api.recordVisit(visit);
    const [url, init] = fetcher.mock.calls[0].arguments;
    assert.equal(url, "https://api.example.test/api/visits");
    assert.equal(init?.method, "POST");
    assert.deepEqual(JSON.parse(init?.body as string), visit);
    assert.equal(init?.credentials, "omit");
    assert.equal(init?.redirect, "error");
  }
});

test("preserves 404 status and exposes validation errors as readable API errors", async () => {
  await assert.rejects(
    () =>
      client({ message: "Site not found" }, 404).api.getSite("harbor.local"),
    (error: unknown) => error instanceof ApiError && error.status === 404,
  );
  await assert.rejects(
    () =>
      client(
        { message: ["person must be valid", "source is required"] },
        400,
      ).api.listPeople(),
    /person must be valid. source is required/,
  );
});

test("reports network failures while retaining cancellation semantics", async () => {
  const failure = async () => {
    throw new TypeError("Network failure");
  };
  await assert.rejects(
    () => createBrowserApi("http://localhost:3001/api", failure).listPeople(),
    /Cannot reach the API/,
  );
  const abort = new DOMException("Cancelled", "AbortError");
  const cancelled = async () => {
    throw abort;
  };
  await assert.rejects(
    () => createBrowserApi("http://localhost:3001/api", cancelled).listPeople(),
    (error: unknown) => error === abort,
  );
});
