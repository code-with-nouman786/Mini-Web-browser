import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { BadRequestException, type Type } from "@nestjs/common";
import { AddressDto } from "../src/common/address.dto";
import { PersonIdDto } from "../src/common/person-id.dto";
import { createValidationPipe } from "../src/common/validation.pipe";
import { CreateSiteDto } from "../src/sites/create-site.dto";
import { CreateVisitDto } from "../src/visits/create-visit.dto";
import { NavigationSource } from "../src/visits/visit.schema";
import { PERSON_A } from "./helpers";

const validSite = {
  address: " HTTPS://Example.Local/ ",
  title: " Example ",
  html: "<h1>Example</h1>",
  plainText: "Example",
  author: PERSON_A,
};

async function assertBadRequest(metatype: Type, payload: unknown) {
  await assert.rejects(
    () => createValidationPipe().transform(payload, { type: "body", metatype }),
    (error: unknown) =>
      error instanceof BadRequestException && error.getStatus() === 400,
  );
}

test("transforms and validates inherited address and site fields", async () => {
  const dto: CreateSiteDto = await createValidationPipe().transform(validSite, {
    type: "body",
    metatype: CreateSiteDto,
  });
  assert.equal(dto.address, "example.local");
  assert.equal(dto.title, "Example");
  assert.equal(dto.html, validSite.html);
});

test("allows empty plain text for HTML with no text content", async () => {
  await createValidationPipe().transform(
    { ...validSite, plainText: "" },
    { type: "body", metatype: CreateSiteDto },
  );
});

test("rejects empty, non-string, whitespace and unsupported-scheme addresses", async () => {
  for (const address of [
    " ",
    "/",
    "https://",
    "bad address",
    "ftp://example",
    42,
    null,
  ]) {
    await assertBadRequest(AddressDto, { address });
  }
});

test("rejects missing site fields, malformed authors and invalid dates", async () => {
  for (const changes of [
    { title: " " },
    { html: "" },
    { html: {} },
    { plainText: undefined },
    { author: "not-an-object-id" },
    { publishedAt: "not-a-date" },
    { publishedAt: null },
  ]) {
    await assertBadRequest(CreateSiteDto, { ...validSite, ...changes });
  }
});

test("validates all four navigation sources", async () => {
  for (const source of Object.values(NavigationSource)) {
    await createValidationPipe().transform(
      { person: PERSON_A, address: "example.local", source },
      { type: "body", metatype: CreateVisitDto },
    );
  }
});

test("rejects invalid visit references and caller-supplied result metadata", async () => {
  const visit = { person: PERSON_A, address: "example.local", source: "typed" };
  for (const changes of [
    { person: "bad-id" },
    { source: "back" },
    { source: undefined },
    { status: "shown" },
    { site: PERSON_A },
    { visitedAt: "2026-11-10T00:00:00.000Z" },
  ]) {
    await assertBadRequest(CreateVisitDto, { ...visit, ...changes });
  }
});

test("rejects malformed history person IDs", async () => {
  await assertBadRequest(PersonIdDto, { personId: "invalid" });
});
