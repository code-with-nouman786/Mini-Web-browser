import "reflect-metadata";
import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { NotFoundException } from "@nestjs/common";
import type { Model } from "mongoose";
import type { PeopleService } from "../src/people/people.service";
import type { SitesService } from "../src/sites/sites.service";
import {
  NavigationSource,
  Visit,
  VisitStatus,
} from "../src/visits/visit.schema";
import { VisitsService } from "../src/visits/visits.service";
import { PERSON_A, PERSON_B, SITE_ID, queryFor } from "./helpers";

const rows = [
  {
    person: PERSON_A,
    address: "new.local",
    visitedAt: new Date("2026-11-10T12:00:00Z"),
  },
  {
    person: PERSON_B,
    address: "private.local",
    visitedAt: new Date("2026-11-10T11:00:00Z"),
  },
  {
    person: PERSON_A,
    address: "old.local",
    visitedAt: new Date("2026-11-09T12:00:00Z"),
  },
];

function fixture() {
  const queries: ReturnType<typeof queryFor<typeof rows>>[] = [];
  const model = {
    create: mock.fn(async (document: Record<string, unknown>) => document),
    find: mock.fn((filter: { person: string }) => {
      const query = queryFor(
        rows.filter((row) => row.person === filter.person),
      );
      queries.push(query);
      return query;
    }),
  };
  const people = { assertExists: mock.fn(async (_id: string) => undefined) };
  const sites = {
    findByAddress: mock.fn(
      async (_address: string): Promise<{ _id: string } | null> => ({
        _id: SITE_ID,
      }),
    ),
  };
  return {
    model,
    people,
    sites,
    queries,
    service: new VisitsService(
      model as unknown as Model<Visit>,
      people as unknown as PeopleService,
      sites as unknown as SitesService,
    ),
  };
}

test("records a shown visit with the normalized address and existing site reference", async () => {
  const { model, people, sites, service } = fixture();
  await service.create({
    person: PERSON_A,
    address: " HTTPS://Example.Local/ ",
    source: NavigationSource.Link,
  });
  assert.deepEqual(people.assertExists.mock.calls[0].arguments, [PERSON_A]);
  assert.deepEqual(sites.findByAddress.mock.calls[0].arguments, [
    "example.local",
  ]);
  assert.deepEqual(model.create.mock.calls[0].arguments[0], {
    person: PERSON_A,
    address: "example.local",
    site: SITE_ID,
    source: NavigationSource.Link,
    status: VisitStatus.Shown,
  });
});

test("records a not_found visit without a site reference for a missing address", async () => {
  const { model, sites, service } = fixture();
  sites.findByAddress.mock.mockImplementation(async () => null);
  await service.create({
    person: PERSON_A,
    address: "Missing.Local/",
    source: NavigationSource.Typed,
  });
  const saved = model.create.mock.calls[0].arguments[0];
  assert.equal(saved.address, "missing.local");
  assert.equal(saved.status, VisitStatus.NotFound);
  assert.equal("site" in saved, false);
  assert.equal("visitedAt" in saved, false);
});

test("does not record a visit for an unknown person", async () => {
  const { model, people, sites, service } = fixture();
  people.assertExists.mock.mockImplementation(async () => {
    throw new NotFoundException("Person not found");
  });
  await assert.rejects(
    () =>
      service.create({
        person: PERSON_A,
        address: "example.local",
        source: NavigationSource.Typed,
      }),
    NotFoundException,
  );
  assert.equal(model.create.mock.callCount(), 0);
  assert.equal(sites.findByAddress.mock.callCount(), 0);
});

test("history contains only the requested person's visits, ordered newest first", async () => {
  const { model, queries, service } = fixture();
  const history = await service.historyForPerson(PERSON_A);
  assert.deepEqual(
    history.map((visit) => visit.address),
    ["new.local", "old.local"],
  );
  assert.deepEqual(model.find.mock.calls[0].arguments, [{ person: PERSON_A }]);
  assert.deepEqual(queries[0].sort.mock.calls[0].arguments, [
    { visitedAt: -1, _id: -1 },
  ]);
  const otherHistory = await service.historyForPerson(PERSON_B);
  assert.deepEqual(
    otherHistory.map((visit) => visit.address),
    ["private.local"],
  );
});

test("returns empty history for an existing person with no visits", async () => {
  const { service } = fixture();
  assert.deepEqual(
    await service.historyForPerson("64b000000000000000000099"),
    [],
  );
});

test("returns a 404 for an unknown history person without querying visits", async () => {
  const { model, people, service } = fixture();
  people.assertExists.mock.mockImplementation(async () => {
    throw new NotFoundException("Person not found");
  });
  await assert.rejects(
    () => service.historyForPerson(PERSON_A),
    NotFoundException,
  );
  assert.equal(model.find.mock.callCount(), 0);
});
