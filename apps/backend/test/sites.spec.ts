import "reflect-metadata";
import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { type Model, mongo } from "mongoose";
import type { PeopleService } from "../src/people/people.service";
import type { CreateSiteDto } from "../src/sites/create-site.dto";
import { Site, SiteSchema } from "../src/sites/site.schema";
import { SitesService } from "../src/sites/sites.service";
import { PERSON_A, SITE_ID, queryFor } from "./helpers";

const dto: CreateSiteDto = {
  address: " HTTPS://Example.Local/// ",
  title: "Example",
  html: "<p>Example</p>",
  plainText: "Example",
  author: PERSON_A,
};

function fixture() {
  const model = {
    init: mock.fn(async () => undefined),
    create: mock.fn(async (document: Record<string, unknown>) => ({
      _id: SITE_ID,
      ...document,
    })),
    findOne: mock.fn((_filter: { address: string }) =>
      queryFor<object | null>(null),
    ),
  };
  const people = { assertExists: mock.fn(async (_id: string) => undefined) };
  return {
    model,
    people,
    service: new SitesService(
      model as unknown as Model<Site>,
      people as unknown as PeopleService,
    ),
  };
}

test("declares a unique address index and awaits its initialization", async () => {
  assert.ok(
    SiteSchema.indexes().some(
      ([keys, options]) => keys.address === 1 && options.unique,
    ),
  );
  const { model, service } = fixture();
  await service.onModuleInit();
  assert.equal(model.init.mock.callCount(), 1);
});

test("normalizes creation addresses and verifies the author", async () => {
  const { model, people, service } = fixture();
  await service.create(dto);
  assert.deepEqual(people.assertExists.mock.calls[0].arguments, [PERSON_A]);
  const saved = model.create.mock.calls[0].arguments[0];
  assert.equal(saved.address, "example.local");
  assert.equal(saved.html, dto.html);
  assert.equal(saved.plainText, dto.plainText);
  assert.equal("publishedAt" in saved, false);
});

test("converts an optional publishedAt value to a Date", async () => {
  const { model, service } = fixture();
  const publishedAt = "2026-11-10T00:00:00.000Z";
  await service.create({ ...dto, publishedAt });
  assert.deepEqual(
    model.create.mock.calls[0].arguments[0].publishedAt,
    new Date(publishedAt),
  );
});

test("maps database duplicate-address errors to 409, including racing creates", async () => {
  const { model, service } = fixture();
  model.create.mock.mockImplementation(async () => {
    throw new mongo.MongoServerError({
      message: "duplicate address",
      code: 11000,
    });
  });
  await assert.rejects(
    () => service.create(dto),
    (error: unknown) =>
      error instanceof ConflictException && error.getStatus() === 409,
  );
  assert.equal(model.findOne.mock.callCount(), 0);
});

test("preserves database failures unrelated to duplicate addresses", async () => {
  const { model, service } = fixture();
  const failure = new Error("database unavailable");
  model.create.mock.mockImplementation(async () => {
    throw failure;
  });
  await assert.rejects(
    () => service.create(dto),
    (error: unknown) => error === failure,
  );
});

test("returns a proper 404 for an unknown normalized address", async () => {
  const { model, service } = fixture();
  await assert.rejects(
    () => service.getByAddress(" HTTPS://Missing.Local/ "),
    (error: unknown) =>
      error instanceof NotFoundException && error.getStatus() === 404,
  );
  assert.deepEqual(model.findOne.mock.calls[0].arguments, [
    { address: "missing.local" },
  ]);
});

test("finds an existing site through an equivalent address", async () => {
  const { model, service } = fixture();
  const site = { _id: SITE_ID, address: "example.local" };
  model.findOne.mock.mockImplementation(() => queryFor(site));
  assert.deepEqual(await service.getByAddress(dto.address), site);
  assert.deepEqual(model.findOne.mock.calls[0].arguments, [
    { address: "example.local" },
  ]);
});

test("does not create a site whose author does not exist", async () => {
  const { model, people, service } = fixture();
  people.assertExists.mock.mockImplementation(async () => {
    throw new NotFoundException("Person not found");
  });
  await assert.rejects(() => service.create(dto), NotFoundException);
  assert.equal(model.create.mock.callCount(), 0);
});
