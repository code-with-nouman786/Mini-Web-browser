import "reflect-metadata";
import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { NotFoundException } from "@nestjs/common";
import type { Model } from "mongoose";
import { PeopleService } from "../src/people/people.service";
import type { Person } from "../src/people/person.schema";
import { PERSON_A, queryFor } from "./helpers";

test("lists existing people with stable ordering", async () => {
  const rows = [{ _id: PERSON_A, name: "Ada" }];
  const query = queryFor(rows);
  const model = { find: mock.fn(() => query) };
  const people = new PeopleService(model as unknown as Model<Person>);
  assert.deepEqual(await people.findAll(), rows);
  assert.deepEqual(query.sort.mock.calls[0].arguments, [{ name: 1, _id: 1 }]);
});

test("returns a 404 for an unknown person", async () => {
  const model = { exists: mock.fn(() => queryFor(null)) };
  const people = new PeopleService(model as unknown as Model<Person>);
  await assert.rejects(
    () => people.assertExists(PERSON_A),
    (error: unknown) =>
      error instanceof NotFoundException && error.getStatus() === 404,
  );
});
