import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { Error as MongooseError, model } from "mongoose";
import { PersonSchema } from "../src/people/person.schema";
import { SiteSchema } from "../src/sites/site.schema";
import {
  NavigationSource,
  VisitSchema,
  VisitStatus,
} from "../src/visits/visit.schema";
import { PERSON_A, SITE_ID } from "./helpers";

const PersonModel = model("UnitPerson", PersonSchema);
const SiteModel = model("UnitSite", SiteSchema);
const VisitModel = model("UnitVisit", VisitSchema);

test("Person requires a nonempty name", async () => {
  await assert.rejects(
    () => new PersonModel({ name: " " }).validate(),
    (error: unknown) =>
      error instanceof MongooseError.ValidationError && !!error.errors.name,
  );
  assert.equal(new PersonModel({ name: " Ada " }).name, "Ada");
});

test("Site normalizes persisted addresses, stores references, and defaults publishedAt", async () => {
  const site = new SiteModel({
    address: "HTTPS://Example.Local/",
    title: "Example",
    html: "<p>Example</p>",
    plainText: "Example",
    author: PERSON_A,
  });
  await site.validate();
  assert.equal(site.address, "example.local");
  assert.equal(site.author.toHexString(), PERSON_A);
  assert.ok(site.publishedAt instanceof Date);
});

test("Visit stores references, normalizes addresses, and defaults visitedAt", async () => {
  const visit = new VisitModel({
    person: PERSON_A,
    site: SITE_ID,
    address: "HTTP://Example.Local/",
    source: NavigationSource.History,
    status: VisitStatus.Shown,
  });
  await visit.validate();
  assert.equal(visit.address, "example.local");
  assert.equal(visit.person.toHexString(), PERSON_A);
  assert.equal(visit.site?.toHexString(), SITE_ID);
  assert.ok(visit.visitedAt instanceof Date);
});

test("Visit rejects values outside the source and status enums", async () => {
  const visit = new VisitModel({
    person: PERSON_A,
    address: "example.local",
    source: "back",
    status: "success",
  });
  await assert.rejects(
    () => visit.validate(),
    (error: unknown) =>
      error instanceof MongooseError.ValidationError &&
      !!error.errors.source &&
      !!error.errors.status,
  );
});
