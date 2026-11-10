import "reflect-metadata";
import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { type Model, Types } from "mongoose";
import type { Person } from "../src/people/person.schema";
import {
  buildSeedRecords,
  SEED_HISTORY_START,
  SEED_PAGES,
} from "../src/seed/seed-data";
import { SeedService } from "../src/seed/seed.service";
import type { Site } from "../src/sites/site.schema";
import {
  NavigationSource,
  VisitStatus,
  type Visit,
} from "../src/visits/visit.schema";

interface UpsertOperation {
  updateOne: {
    filter: { _id: Types.ObjectId };
    update: { $set: Record<string, unknown>; $unset?: Record<string, number> };
    upsert: boolean;
  };
}

function modelDouble(name: string, events: string[]) {
  const records = new Map<string, Record<string, unknown>>();
  const init = mock.fn(async () => {
    events.push(`${name}:init`);
  });
  const bulkWrite = mock.fn(
    async (operations: UpsertOperation[], _options: object) => {
      assert.equal(init.mock.callCount() > 0, true);
      events.push(`${name}:write`);
      for (const { updateOne } of operations) {
        assert.equal(updateOne.upsert, true);
        const id = updateOne.filter._id.toHexString();
        const document = {
          ...records.get(id),
          _id: updateOne.filter._id,
          ...updateOne.update.$set,
        } as Record<string, unknown>;
        for (const field of Object.keys(updateOne.update.$unset ?? {}))
          delete document[field];
        records.set(id, document);
      }
    },
  );
  return { records, init, bulkWrite };
}

function fixture() {
  const events: string[] = [];
  const people = modelDouble("people", events);
  const sites = modelDouble("sites", events);
  const visits = modelDouble("visits", events);
  return {
    events,
    people,
    sites,
    visits,
    service: new SeedService(
      people as unknown as Model<Person>,
      sites as unknown as Model<Site>,
      visits as unknown as Model<Visit>,
    ),
  };
}

function snapshot(stores: ReturnType<typeof fixture>): string {
  return JSON.stringify(
    [stores.people, stores.sites, stores.visits].map((store) => [
      ...store.records,
    ]),
  );
}

function links(html: string): string[] {
  return [
    ...html.matchAll(/<a href="https:\/\/([^"]+)" data-address="([^"]+)">/g),
  ].map((match) => {
    assert.equal(match[1], match[2]);
    return match[2];
  });
}

test("seeding twice upserts exactly 4 people, 10 sites and 38 visits without duplicates", async () => {
  const stores = fixture();
  assert.deepEqual(await stores.service.seed(), {
    people: 4,
    sites: 10,
    visits: 38,
  });
  const first = snapshot(stores);
  assert.deepEqual(await stores.service.seed(), {
    people: 4,
    sites: 10,
    visits: 38,
  });
  assert.equal(snapshot(stores), first);
  assert.equal(stores.people.records.size, 4);
  assert.equal(stores.sites.records.size, 10);
  assert.equal(stores.visits.records.size, 38);
  assert.deepEqual(
    stores.events.filter((event) => event.endsWith(":write")),
    [
      "people:write",
      "sites:write",
      "visits:write",
      "people:write",
      "sites:write",
      "visits:write",
    ],
  );
});

test("records have fixed identities, content, authors and UTC timestamps", () => {
  const records = buildSeedRecords();
  const first = JSON.stringify(records);
  assert.equal(records.people[0]._id.toHexString(), "650000000000000001000001");
  assert.equal(records.sites[0]._id.toHexString(), "650000000000000002000001");
  assert.equal(records.visits[0]._id.toHexString(), "650000000000000003000001");
  assert.equal(records.visits[0].visitedAt.toISOString(), SEED_HISTORY_START);
  assert.equal(
    records.visits.at(-1)?.visitedAt.toISOString(),
    "2026-10-01T10:00:00.000Z",
  );
  assert.equal(
    records.sites[0].publishedAt.toISOString(),
    "2026-09-14T07:00:00.000Z",
  );
  assert.equal(
    records.sites.at(-1)?.publishedAt.toISOString(),
    "2026-09-23T07:00:00.000Z",
  );
  assert.equal(JSON.stringify(buildSeedRecords()), first);
  records.visits[0].visitedAt.setUTCFullYear(2040);
  records.sites[0].plainText = "changed in memory";
  assert.equal(JSON.stringify(buildSeedRecords()), first);
});

test("both authors own multiple original pages and one person visits every site with repeats", () => {
  const records = buildSeedRecords();
  const authorCounts = new Map<string, number>();
  for (const site of records.sites) {
    const author = site.author.toHexString();
    authorCounts.set(author, (authorCounts.get(author) ?? 0) + 1);
    assert.ok(site.plainText.split(/\s+/).length >= 100);
    assert.ok(site.publishedAt < records.visits[0].visitedAt);
  }
  assert.deepEqual([...authorCounts.values()], [5, 5]);
  const reader = records.people[2]._id.toHexString();
  const read = records.visits.filter(
    (visit) =>
      visit.person.toHexString() === reader &&
      visit.status === VisitStatus.Shown,
  );
  assert.equal(new Set(read.map((visit) => visit.address)).size, 10);
  assert.ok(read.length > 10);
  assert.deepEqual(
    new Set(records.visits.map((visit) => visit.person.toHexString())),
    new Set(records.people.map((person) => person._id.toHexString())),
  );
  assert.deepEqual(
    new Set(records.visits.map((visit) => visit.source)),
    new Set(Object.values(NavigationSource)),
  );
});

test("seeded HTML preserves multiple broken links without creating phantom sites", async () => {
  const stores = fixture();
  await stores.service.seed();
  const records = buildSeedRecords();
  const addresses = new Set(records.sites.map((site) => site.address));
  const targets = records.sites.flatMap((site) => {
    assert.equal(
      links(site.html).length,
      SEED_PAGES.find((page) => page.address === site.address)?.links.length,
    );
    return links(site.html);
  });
  const missing = new Set(targets.filter((address) => !addresses.has(address)));
  assert.ok(missing.size >= 3);
  assert.ok(targets.filter((address) => !addresses.has(address)).length >= 3);
  for (const visit of records.visits.filter(
    (visit) => visit.status === VisitStatus.NotFound,
  )) {
    assert.ok(missing.has(visit.address));
    assert.equal(visit.site, undefined);
  }
  assert.equal(stores.sites.records.size, 10);
});

test("one chronological browsing trail follows at least four real page-to-page links", () => {
  const records = buildSeedRecords();
  const reader = records.people[2]._id.toHexString();
  const trail = records.visits
    .filter((visit) => visit.person.toHexString() === reader)
    .slice(0, 10);
  assert.equal(trail.length, 10);
  assert.equal(new Set(trail.map((visit) => visit.address)).size, 10);
  for (let index = 1; index < trail.length; index++) {
    const previous = records.sites.find(
      (site) => site.address === trail[index - 1].address,
    );
    assert.ok(previous);
    assert.ok(links(previous.html).includes(trail[index].address));
    assert.equal(trail[index].source, NavigationSource.Link);
    assert.ok(trail[index].visitedAt > trail[index - 1].visitedAt);
  }
});

test("rerunning repairs altered seed records and clears stale missing-site references", async () => {
  const stores = fixture();
  await stores.service.seed();
  const expected = snapshot(stores);
  const missing = [...stores.visits.records.values()].find(
    (visit) => visit.status === VisitStatus.NotFound,
  );
  assert.ok(missing);
  missing.site = new Types.ObjectId();
  missing.status = VisitStatus.Shown;
  [...stores.people.records.values()][0].name = "edited";
  await stores.service.seed();
  assert.equal(snapshot(stores), expected);
});

test("seeding retains unrelated records", async () => {
  const stores = fixture();
  const id = "640000000000000000000001";
  const person = { _id: new Types.ObjectId(id), name: "An existing reader" };
  stores.people.records.set(id, person);
  await stores.service.seed();
  await stores.service.seed();
  assert.deepEqual(stores.people.records.get(id), person);
  assert.equal(stores.people.records.size, 5);
});

test("a rerun after a partial failure completes without duplicating earlier writes", async () => {
  const stores = fixture();
  stores.visits.bulkWrite.mock.mockImplementationOnce(async () => {
    throw new Error("interrupted");
  });
  await assert.rejects(() => stores.service.seed(), /interrupted/);
  assert.equal(stores.people.records.size, 4);
  assert.equal(stores.sites.records.size, 10);
  assert.equal(stores.visits.records.size, 0);
  await stores.service.seed();
  assert.equal(stores.people.records.size, 4);
  assert.equal(stores.sites.records.size, 10);
  assert.equal(stores.visits.records.size, 38);
});
