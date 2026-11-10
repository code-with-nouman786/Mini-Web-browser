import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError } from "../src/browser/api";
import { deferred, fixture, PERSON_ID, OTHER_PERSON_ID, site } from "./helpers";

test("typed success normalizes the address, displays the page and records a typed Visit", async () => {
  const { session, api } = fixture();
  await session.loadPeople();
  assert.equal(session.getSnapshot().personId, null);
  session.selectPerson(PERSON_ID);
  await session.navigate(" HTTPS://Harbor.Local/// ", "typed");
  assert.equal(session.getSnapshot().navigation.phase, "shown");
  assert.equal(session.getSnapshot().addressDraft, "harbor.local");
  assert.equal(api.getSite.mock.calls[0].arguments[0], "harbor.local");
  assert.deepEqual(api.recordVisit.mock.calls[0].arguments[0], {
    person: PERSON_ID,
    address: "harbor.local",
    source: "typed",
  });
});

test("typed missing addresses display Nowhere state and still record source typed", async () => {
  const { session, api } = fixture();
  await session.loadPeople();
  session.selectPerson(PERSON_ID);
  api.getSite.mock.mockImplementation(async () => {
    throw new ApiError(404, "Site not found");
  });
  await session.navigate("missing.local/", "typed");
  assert.equal(session.getSnapshot().navigation.phase, "not_found");
  assert.deepEqual(api.recordVisit.mock.calls[0].arguments[0], {
    person: PERSON_ID,
    address: "missing.local",
    source: "typed",
  });
});

for (const missing of [false, true]) {
  test(`internal ${missing ? "broken" : "successful"} links record source link`, async () => {
    const { session, api } = fixture();
    await session.loadPeople();
    session.selectPerson(PERSON_ID);
    if (missing)
      api.getSite.mock.mockImplementation(async () => {
        throw new ApiError(404, "Site not found");
      });
    await session.navigate("tides.local", "link");
    assert.equal(
      session.getSnapshot().navigation.phase,
      missing ? "not_found" : "shown",
    );
    assert.deepEqual(api.recordVisit.mock.calls[0].arguments[0], {
      person: PERSON_ID,
      address: "tides.local",
      source: "link",
    });
  });
}

test("no selected or unknown person means no site request and no visit", async () => {
  const { session, api } = fixture();
  await session.loadPeople();
  await session.navigate("harbor.local", "typed");
  session.selectPerson("unlisted-person");
  await session.navigate("harbor.local", "link");
  assert.equal(api.getSite.mock.callCount(), 0);
  assert.equal(api.recordVisit.mock.callCount(), 0);
  assert.match(session.getSnapshot().formError ?? "", /person/i);
});

test("API failures are not mistaken for missing pages and do not record a visit", async () => {
  const { session, api } = fixture();
  await session.loadPeople();
  session.selectPerson(PERSON_ID);
  api.getSite.mock.mockImplementation(async () => {
    throw new ApiError(503, "Temporarily unavailable");
  });
  await session.navigate("harbor.local", "typed");
  assert.equal(session.getSnapshot().navigation.phase, "error");
  assert.equal(api.recordVisit.mock.callCount(), 0);
});

test("a logging failure remains visible without hiding the resolved page", async () => {
  const { session, api } = fixture();
  await session.loadPeople();
  session.selectPerson(PERSON_ID);
  api.recordVisit.mock.mockImplementation(async () => {
    throw new ApiError(503, "Visit API unavailable");
  });
  await session.navigate("harbor.local", "typed");
  const navigation = session.getSnapshot().navigation;
  assert.equal(navigation.phase, "shown");
  if (navigation.phase === "shown")
    assert.match(navigation.visitError ?? "", /Visit API unavailable/);
});

test("loading state is explicit and retry preserves the navigation source", async () => {
  const { session, api } = fixture();
  await session.loadPeople();
  session.selectPerson(PERSON_ID);
  const pending = deferred<typeof site>();
  api.getSite.mock.mockImplementationOnce(() => pending.promise);
  const navigation = session.navigate("harbor.local", "link");
  assert.equal(session.getSnapshot().navigation.phase, "loading");
  pending.resolve(site);
  await navigation;
  api.getSite.mock.mockImplementationOnce(async () => {
    throw new ApiError(503, "Retry me");
  });
  await session.navigate("harbor.local", "link");
  await session.retryNavigation();
  assert.equal(session.getSnapshot().navigation.phase, "shown");
  assert.equal(api.recordVisit.mock.calls.at(-1)?.arguments[0].source, "link");
});

test("changing people cancels an old page request and cannot attribute its visit to the new person", async () => {
  const { session, api } = fixture();
  await session.loadPeople();
  session.selectPerson(PERSON_ID);
  const pending = deferred<typeof site>();
  api.getSite.mock.mockImplementationOnce(() => pending.promise);
  const navigation = session.navigate("harbor.local", "typed");
  session.selectPerson(OTHER_PERSON_ID);
  pending.resolve(site);
  await navigation;
  assert.equal(api.recordVisit.mock.callCount(), 0);
  assert.equal(session.getSnapshot().navigation.phase, "idle");
  assert.equal(api.getSite.mock.calls[0].arguments[1]?.aborted, true);
});

test("a late response cannot replace a newer navigation or add a stale visit", async () => {
  const { session, api } = fixture();
  await session.loadPeople();
  session.selectPerson(PERSON_ID);
  const pending = deferred<typeof site>();
  api.getSite.mock.mockImplementationOnce(() => pending.promise);
  const old = session.navigate("harbor.local", "typed");
  await session.navigate("tides.local", "link");
  pending.resolve(site);
  await old;
  const navigation = session.getSnapshot().navigation;
  assert.notEqual(navigation.phase, "idle");
  if (navigation.phase !== "idle")
    assert.equal(navigation.address, "tides.local");
  assert.equal(api.recordVisit.mock.callCount(), 1);
});

test("people errors can be retried without selecting a person automatically", async () => {
  const { session, api } = fixture();
  api.listPeople.mock.mockImplementationOnce(async () => {
    throw new ApiError(0, "Offline");
  });
  await session.loadPeople();
  assert.equal(session.getSnapshot().people.phase, "error");
  await session.loadPeople();
  assert.equal(session.getSnapshot().people.phase, "ready");
  assert.equal(session.getSnapshot().personId, null);
});

test("invalid addresses and disposed requests cannot record visits", async () => {
  const { session, api } = fixture();
  await session.loadPeople();
  session.selectPerson(PERSON_ID);
  for (const address of [
    "",
    "javascript:alert(1)",
    "//outside.invalid",
    "bad address",
  ])
    await session.navigate(address, "typed");
  assert.equal(api.getSite.mock.callCount(), 0);
  const pending = deferred<typeof site>();
  api.getSite.mock.mockImplementationOnce(() => pending.promise);
  const navigation = session.navigate("harbor.local", "typed");
  session.dispose();
  pending.resolve(site);
  await navigation;
  assert.equal(api.recordVisit.mock.callCount(), 0);
});
