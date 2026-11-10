import "reflect-metadata";
import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { BadRequestException } from "@nestjs/common";
import { type Model, Types } from "mongoose";
import { createValidationPipe } from "../src/common/validation.pipe";
import { PersonSchema } from "../src/people/person.schema";
import { SearchController } from "../src/search/search.controller";
import { SearchQueryDto } from "../src/search/search-query.dto";
import { searchExcerpt } from "../src/search/search-excerpt";
import { SearchService } from "../src/search/search.service";
import { buildSeedRecords } from "../src/seed/seed-data";
import { Site, SiteSchema } from "../src/sites/site.schema";
import { VisitSchema } from "../src/visits/visit.schema";

const author = {
  _id: new Types.ObjectId("650000000000000001000001"),
  name: "Mira Qureshi",
};

interface Hit {
  address: string;
  title: string;
  plainText: string;
  author: typeof author | null;
  publishedAt: Date;
  score: number;
  html?: string;
}

/** Unit cursor: MongoDB executes the real text index and sort in production. */
function fixture(input: Hit[]) {
  let rows = [...input];
  const exec = mock.fn(async () => rows);
  const lean = mock.fn(() => ({ exec }));
  const populate = mock.fn((_path: string, _fields: string) => ({ lean }));
  const limit = mock.fn((count: number) => {
    rows = rows.slice(0, count);
    return { populate };
  });
  const sort = mock.fn(
    (order: { score: { $meta: string }; address: number }) => {
      assert.deepEqual(order, { score: { $meta: "textScore" }, address: 1 });
      rows = [...input].sort(
        (left, right) =>
          right.score - left.score ||
          (left.address < right.address
            ? -1
            : left.address > right.address
              ? 1
              : 0),
      );
      return { limit };
    },
  );
  const find = mock.fn((_filter: object, _projection: object) => ({ sort }));
  const service = new SearchService({ find } as unknown as Model<Site>);
  return { find, sort, limit, populate, service };
}

function hit(address: string, score = 1): Hit {
  return {
    address,
    score,
    title: "A garden notebook",
    plainText: "The harbor garden stores rain for a dry morning.",
    author,
    publishedAt: new Date("2026-09-14T07:00:00.000Z"),
  };
}

test("indexes both written content fields, with weighted relevance and stable lookup indexes", () => {
  const text = SiteSchema.indexes().find(
    ([, options]) => options.name === "site_content_text",
  );
  assert.ok(text);
  assert.deepEqual(text[0], { title: "text", plainText: "text" });
  assert.deepEqual(text[1].weights, { title: 5, plainText: 1 });
  assert.equal(text[1].default_language, "none");
  assert.ok(
    SiteSchema.indexes().some(
      ([keys, options]) => keys.address === 1 && options.unique,
    ),
  );
  assert.ok(
    PersonSchema.indexes().some(([keys]) => keys.name === 1 && keys._id === 1),
  );
  assert.ok(
    VisitSchema.indexes().some(
      ([keys]) => keys.person === 1 && keys.visitedAt === -1 && keys._id === -1,
    ),
  );
});

test("searches the text index and returns a matching body excerpt when the title does not match", async () => {
  const records = buildSeedRecords();
  const page = records.sites.find((site) => site.address === "night.local");
  assert.ok(page);
  assert.equal(page.title.toLowerCase().includes("bioluminescence"), false);
  assert.ok(page.plainText.includes("bioluminescence"));
  const cursor = fixture([{ ...page, author, score: 1 }]);
  const results = await new SearchController(cursor.service).search({
    q: "bioluminescence",
  });
  assert.deepEqual(cursor.find.mock.calls[0].arguments[0], {
    $text: { $search: "bioluminescence", $language: "none" },
  });
  assert.equal(results[0].address, "night.local");
  assert.ok(results[0].excerpt.includes("bioluminescence"));
  assert.ok(results[0].excerpt.includes("blue spark"));
  assert.deepEqual(results[0].author, {
    _id: author._id.toHexString(),
    name: author.name,
  });
  assert.equal(results[0].publishedAt, page.publishedAt.toISOString());
});

test("orders by text relevance then unique address, identically across repeated searches", async () => {
  const cursor = fixture([
    hit("z.local", 1),
    hit("b.local", 2),
    hit("a.local", 2),
    hit("top.local", 5),
  ]);
  const first = await cursor.service.search("harbor");
  const second = await cursor.service.search("harbor");
  assert.deepEqual(
    first.map((result) => result.address),
    ["top.local", "a.local", "b.local", "z.local"],
  );
  assert.deepEqual(second, first);
  assert.deepEqual(cursor.limit.mock.calls[0].arguments, [50]);
});

test("returns only public search fields and does not return HTML, score, or the entire body", async () => {
  const cursor = fixture([
    { ...hit("garden.local"), html: "<script>not search output</script>" },
  ]);
  const results = await cursor.service.search("garden");
  assert.deepEqual(Object.keys(results[0]).sort(), [
    "address",
    "author",
    "excerpt",
    "publishedAt",
    "title",
  ]);
  assert.deepEqual(cursor.find.mock.calls[0].arguments[1], {
    _id: 0,
    address: 1,
    title: 1,
    plainText: 1,
    author: 1,
    publishedAt: 1,
    score: { $meta: "textScore" },
  });
  assert.deepEqual(cursor.populate.mock.calls[0].arguments, ["author", "name"]);
  assert.equal(JSON.stringify(results).includes("<script>"), false);
});

test("missing, empty and whitespace-only queries return [] without a database query", async () => {
  const cursor = fixture([]);
  for (const raw of [{}, { q: "" }, { q: " \t\n " }]) {
    const dto: SearchQueryDto = await createValidationPipe().transform(raw, {
      type: "query",
      metatype: SearchQueryDto,
    });
    assert.equal(dto.q, "");
    assert.deepEqual(await cursor.service.search(dto.q), []);
  }
  assert.equal(cursor.find.mock.callCount(), 0);
});

test("normalizes query whitespace and permits literal Unicode words and internal apostrophes or hyphens", async () => {
  for (const [input, expected] of [
    ["  harbor   garden  ", "harbor garden"],
    ["CAFÉ", "CAFÉ"],
    ["lantern-lit O'Reilly", "lantern-lit O'Reilly"],
  ]) {
    const dto: SearchQueryDto = await createValidationPipe().transform(
      { q: input },
      { type: "query", metatype: SearchQueryDto },
    );
    assert.equal(dto.q, expected);
  }
});

test("malformed, oversized, repeated and object queries return 400", async () => {
  for (const q of [
    ["harbor", "garden"],
    { $ne: "" },
    null,
    42,
    "a".repeat(201),
    '"unclosed',
    "harbor -garden",
    ".*",
    "harbor\u0000garden",
  ]) {
    await assert.rejects(
      () =>
        createValidationPipe().transform(
          { q },
          { type: "query", metatype: SearchQueryDto },
        ),
      (error: unknown) =>
        error instanceof BadRequestException && error.getStatus() === 400,
    );
  }
});

test("no matching sites return an empty result list", async () => {
  assert.deepEqual(await fixture([]).service.search("unlistedword"), []);
});

test("excerpts find late body matches, handle accents, and fall back to title-only matches", () => {
  const body = `${"An ordinary shoreline observation. ".repeat(20)}A café serves breakfast beside the harbor. ${"More field notes. ".repeat(20)}`;
  const excerpt = searchExcerpt(body, "Field log", "cafe");
  assert.ok(excerpt.includes("café"));
  assert.ok(excerpt.startsWith("…"));
  assert.ok(excerpt.length <= 242);
  assert.equal(
    searchExcerpt("A quiet morning.", "Harbor Repairs", "repairs"),
    "Harbor Repairs",
  );
});

test("a missing author record is represented as null without breaking search", async () => {
  const results = await fixture([
    { ...hit("garden.local"), author: null },
  ]).service.search("garden");
  assert.equal(results[0].author, null);
});

test("database failures are not reported as successful empty searches", async () => {
  const failure = new Error("database unavailable");
  const model = {
    find: () => {
      throw failure;
    },
  };
  const service = new SearchService(model as unknown as Model<Site>);
  await assert.rejects(
    () => service.search("harbor"),
    (error: unknown) => error === failure,
  );
});
