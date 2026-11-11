import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError } from "../src/browser/api";
import {
  navigationAvailability,
  type SessionEntry,
} from "../src/browser/session";
import { deferred, fixture, PERSON_ID, OTHER_PERSON_ID, site } from "./helpers";

async function browsing() {
  const value = fixture();
  await value.session.loadPeople();
  value.session.selectPerson(PERSON_ID);
  return value;
}
function entry(session: ReturnType<typeof fixture>["session"]): SessionEntry {
  const navigation = session.getSnapshot().navigation;
  assert.ok(navigation.phase === "shown" || navigation.phase === "not_found");
  return navigation;
}
const trail = ["harbor.local", "tides.local", "marsh.local", "roofs.local"];
async function fourPages() {
  const value = await browsing();
  for (const [index, address] of trail.entries())
    await value.session.navigate(address, index === 0 ? "typed" : "link");
  return value;
}

test("a four-page trail stores normalized addresses, resolved snapshots and source metadata", async () => {
  const { session, api } = await browsing();
  await session.navigate(" HTTPS://HARBOR.LOCAL/// ", "typed");
  for (const address of trail.slice(1)) await session.navigate(address, "link");
  const state = session.getSnapshot();
  assert.deepEqual(
    state.trail.entries.map((page) => page.address),
    trail,
  );
  assert.equal(state.trail.index, 3);
  for (const page of state.trail.entries) {
    assert.equal(page.phase, "shown");
    assert.equal(page.title, site.title);
    assert.equal(page.sanitizedHtml, site.sanitizedHtml);
    assert.deepEqual(page.scroll, { x: 0, y: 0 });
  }
  assert.deepEqual(
    api.recordVisit.mock.calls.map((call) => call.arguments[0].source),
    ["typed", "link", "link", "link"],
  );
});

test("multiple back/forward operations restore entries and never fetch, log or append", async () => {
  const { session, api } = await fourPages();
  const ids = session.getSnapshot().trail.entries.map((page) => page.id);
  for (const index of [2, 1, 0]) {
    await session.back();
    assert.equal(entry(session).address, trail[index]);
    assert.equal(session.getSnapshot().addressDraft, trail[index]);
  }
  await session.back();
  assert.equal(session.getSnapshot().trail.index, 0);
  for (const index of [1, 2, 3]) {
    await session.forward();
    assert.equal(entry(session).address, trail[index]);
  }
  await session.forward();
  assert.equal(session.getSnapshot().trail.index, 3);
  assert.deepEqual(
    session.getSnapshot().trail.entries.map((page) => page.id),
    ids,
  );
  assert.equal(api.getSite.mock.callCount(), 4);
  assert.equal(api.recordVisit.mock.callCount(), 4);
});

for (const source of ["typed", "link"] as const) {
  test(`${source} navigation after Back permanently removes the forward branch`, async () => {
    const { session, api } = await fourPages();
    await session.back();
    await session.back();
    await session.navigate("workshop.local", source);
    assert.deepEqual(
      session.getSnapshot().trail.entries.map((page) => page.address),
      ["harbor.local", "tides.local", "workshop.local"],
    );
    assert.deepEqual(navigationAvailability(session.getSnapshot()), {
      back: true,
      forward: false,
    });
    await session.forward();
    assert.equal(entry(session).address, "workshop.local");
    await session.back();
    await session.forward();
    assert.equal(api.getSite.mock.callCount(), 5);
    assert.equal(api.recordVisit.mock.callCount(), 5);
  });
}

test("snapshots preserve original content, title, publication and author even if API data changes", async () => {
  const { session, api } = await browsing();
  const original = { ...site };
  api.getSite.mock.mockImplementationOnce(async () => original);
  await session.navigate("harbor.local", "typed");
  const first = entry(session);
  original.title = "Edited title";
  original.sanitizedHtml = "<h1>Edited content</h1>";
  original.publishedAt = "2026-11-11T12:00:00.000Z";
  await session.navigate("tides.local", "link");
  await session.back();
  assert.deepEqual(entry(session), first);
  assert.equal(entry(session).title, site.title);
  assert.equal(entry(session).sanitizedHtml, site.sanitizedHtml);
  assert.equal(api.getSite.mock.callCount(), 2);
});

test("scroll is captured before typed/link departure and restored independently for each entry", async () => {
  const { session, api } = await browsing();
  await session.navigate("harbor.local", "typed");
  const firstId = entry(session).id;
  const firstCapture = deferred<{ x: number; y: number }>();
  let detach = session.attachViewport(firstId, () => firstCapture.promise);
  const next = session.navigate("tides.local", "link");
  assert.equal(
    api.getSite.mock.callCount(),
    1,
    "do not leave before the capture reply",
  );
  assert.equal(entry(session).id, firstId);
  firstCapture.resolve({ x: 12, y: 740 });
  await next;
  detach();
  detach = session.attachViewport(entry(session).id, async () => ({
    x: 0,
    y: 290,
  }));
  await session.navigate("marsh.local", "typed");
  detach();
  await session.back();
  assert.deepEqual(entry(session).scroll, { x: 0, y: 290 });
  await session.back();
  assert.deepEqual(entry(session).scroll, { x: 12, y: 740 });
  await session.forward();
  assert.deepEqual(entry(session).scroll, { x: 0, y: 290 });
  assert.equal(api.getSite.mock.callCount(), 3);
});

test("Back and Forward also capture the page being left without duplicating a Visit", async () => {
  const { session, api } = await fourPages();
  let detach = session.attachViewport(entry(session).id, async () => ({
    x: 0,
    y: 900,
  }));
  await session.back();
  detach();
  detach = session.attachViewport(entry(session).id, async () => ({
    x: 5,
    y: 350,
  }));
  await session.forward();
  detach();
  assert.deepEqual(entry(session).scroll, { x: 0, y: 900 });
  await session.back();
  assert.deepEqual(entry(session).scroll, { x: 5, y: 350 });
  assert.equal(api.recordVisit.mock.callCount(), 4);
});

test("Not-found entries restore Nowhere, their address and original outcome without retrying the API", async () => {
  const { session, api } = await browsing();
  await session.navigate("harbor.local", "typed");
  api.getSite.mock.mockImplementationOnce(async () => {
    throw new ApiError(404, "Missing");
  });
  await session.navigate("ferry.local", "link");
  await session.navigate("tides.local", "typed");
  await session.back();
  assert.equal(entry(session).phase, "not_found");
  assert.equal(entry(session).title, "Nowhere");
  assert.equal(entry(session).sanitizedHtml, "");
  assert.equal(session.getSnapshot().addressDraft, "ferry.local");
  await session.back();
  await session.forward();
  assert.equal(entry(session).phase, "not_found");
  assert.equal(api.getSite.mock.callCount(), 3);
  assert.equal(api.recordVisit.mock.callCount(), 3);
});

test("button availability follows empty, first, middle and last positions", async () => {
  const { session } = await browsing();
  assert.deepEqual(navigationAvailability(session.getSnapshot()), {
    back: false,
    forward: false,
  });
  await session.navigate("harbor.local", "typed");
  assert.deepEqual(navigationAvailability(session.getSnapshot()), {
    back: false,
    forward: false,
  });
  await session.navigate("tides.local", "link");
  assert.deepEqual(navigationAvailability(session.getSnapshot()), {
    back: true,
    forward: false,
  });
  await session.back();
  assert.deepEqual(navigationAvailability(session.getSnapshot()), {
    back: false,
    forward: true,
  });
  await session.forward();
  assert.deepEqual(navigationAvailability(session.getSnapshot()), {
    back: true,
    forward: false,
  });
});

test("switching people resets entries, cursor, draft and scroll; returning never revives the previous person's state", async () => {
  const { session, api } = await fourPages();
  session.saveScroll(entry(session).id, { x: 0, y: 500 });
  session.selectPerson(OTHER_PERSON_ID);
  assert.deepEqual(session.getSnapshot().trail, {
    entries: [],
    index: -1,
    pendingIndex: null,
  });
  assert.equal(session.getSnapshot().navigation.phase, "idle");
  assert.equal(session.getSnapshot().addressDraft, "harbor.local");
  await session.back();
  await session.forward();
  await session.navigate("night.local", "typed");
  assert.equal(
    api.recordVisit.mock.calls.at(-1)?.arguments[0].person,
    OTHER_PERSON_ID,
  );
  session.selectPerson(PERSON_ID);
  assert.equal(session.getSnapshot().trail.entries.length, 0);
  assert.deepEqual(navigationAvailability(session.getSnapshot()), {
    back: false,
    forward: false,
  });
});

test("reselecting the same person preserves their current session", async () => {
  const { session } = await fourPages();
  const before = session.getSnapshot();
  session.selectPerson(PERSON_ID);
  assert.equal(session.getSnapshot(), before);
});

test("a late API reply after traversal cannot append an entry or replace the restored page", async () => {
  const { session, api } = await fourPages();
  const pending = deferred<typeof site>();
  api.getSite.mock.mockImplementationOnce(() => pending.promise);
  const navigation = session.navigate("night.local", "typed");
  await session.back();
  pending.resolve({ ...site, address: "night.local" });
  await navigation;
  assert.equal(entry(session).address, "roofs.local");
  assert.equal(session.getSnapshot().trail.entries.length, 4);
  assert.equal(api.recordVisit.mock.callCount(), 4);
  assert.equal(api.getSite.mock.calls.at(-1)?.arguments[1]?.aborted, true);
});

test("rapid new navigations ignore out-of-order successful and missing replies", async () => {
  const { session, api } = await browsing();
  const first = deferred<typeof site>();
  const second = deferred<typeof site>();
  api.getSite.mock.mockImplementationOnce(() => first.promise);
  api.getSite.mock.mockImplementationOnce(() => second.promise);
  const old = session.navigate("harbor.local", "typed");
  const middle = session.navigate("tides.local", "link");
  await session.navigate("marsh.local", "typed");
  second.reject(new ApiError(404, "Late missing response"));
  first.resolve({ ...site, address: "harbor.local" });
  await Promise.all([old, middle]);
  assert.deepEqual(
    session.getSnapshot().trail.entries.map((page) => page.address),
    ["marsh.local"],
  );
  assert.equal(api.recordVisit.mock.callCount(), 1);
});

test("rapid Back/Back/Forward clicks reserve distinct destinations while scroll capture is pending", async () => {
  const { session } = await fourPages();
  const captures = Array.from({ length: 3 }, () =>
    deferred<{ x: number; y: number }>(),
  );
  let index = 0;
  session.attachViewport(entry(session).id, () => captures[index++].promise);
  const one = session.back();
  const two = session.back();
  const three = session.forward();
  assert.equal(session.getSnapshot().trail.pendingIndex, 2);
  captures[2].resolve({ x: 0, y: 444 });
  await three;
  captures[0].resolve({ x: 0, y: 111 });
  captures[1].resolve({ x: 0, y: 222 });
  await Promise.all([one, two]);
  assert.equal(entry(session).address, "marsh.local");
  assert.deepEqual(session.getSnapshot().trail.entries[3].scroll, {
    x: 0,
    y: 444,
  });
});

test("a person change during scroll capture cancels departure and cannot save into another session", async () => {
  const { session, api } = await fourPages();
  const capture = deferred<{ x: number; y: number }>();
  session.attachViewport(entry(session).id, () => capture.promise);
  const navigation = session.navigate("night.local", "link");
  session.selectPerson(OTHER_PERSON_ID);
  await session.navigate("dawn.local", "typed");
  capture.resolve({ x: 0, y: 1234 });
  await navigation;
  assert.deepEqual(
    session.getSnapshot().trail.entries.map((page) => page.address),
    ["dawn.local"],
  );
  assert.deepEqual(entry(session).scroll, { x: 0, y: 0 });
  assert.equal(api.getSite.mock.callCount(), 5);
});

test("late Visit failures remain attached to their original entry without changing the cursor or posting twice", async () => {
  const { session, api } = await browsing();
  const pending = deferred<void>();
  api.recordVisit.mock.mockImplementationOnce(async () => {
    await pending.promise;
    throw new Error("Logging unavailable");
  });
  const first = session.navigate("harbor.local", "typed");
  await Promise.resolve();
  assert.equal(entry(session).address, "harbor.local");
  await session.navigate("tides.local", "link");
  pending.resolve();
  await first;
  assert.equal(entry(session).address, "tides.local");
  assert.equal(entry(session).visitError, null);
  await session.back();
  assert.equal(entry(session).visitError, "Logging unavailable");
  await session.forward();
  assert.equal(api.recordVisit.mock.callCount(), 2);
});

test("person changes abort pending Visit posts; late completion cannot leak across a switch away and back", async () => {
  const { session, api } = await browsing();
  const pending = deferred<void>();
  api.recordVisit.mock.mockImplementationOnce(async () => {
    await pending.promise;
    throw new Error("Old failure");
  });
  const old = session.navigate("harbor.local", "typed");
  await Promise.resolve();
  session.selectPerson(OTHER_PERSON_ID);
  assert.equal(api.recordVisit.mock.calls[0].arguments[1]?.aborted, true);
  session.selectPerson(PERSON_ID);
  await session.navigate("tides.local", "typed");
  pending.resolve();
  await old;
  assert.equal(session.getSnapshot().trail.entries.length, 1);
  assert.equal(entry(session).visitError, null);
});

test("API errors and cancelled attempts never prune a forward branch before a new page resolves", async () => {
  const { session, api } = await fourPages();
  await session.back();
  api.getSite.mock.mockImplementationOnce(async () => {
    throw new ApiError(503, "Offline");
  });
  await session.navigate("night.local", "typed");
  assert.equal(session.getSnapshot().navigation.phase, "error");
  assert.equal(session.getSnapshot().trail.entries.length, 4);
  await session.forward();
  assert.equal(entry(session).address, "roofs.local");
  assert.equal(api.recordVisit.mock.callCount(), 4);
});

test("failed scroll capture keeps the original entry and branch instead of losing its position", async () => {
  const { session, api } = await fourPages();
  session.attachViewport(entry(session).id, async () => {
    throw new Error("Frame unavailable");
  });
  await session.back();
  assert.equal(session.getSnapshot().trail.index, 3);
  assert.equal(session.getSnapshot().trail.pendingIndex, null);
  assert.match(session.getSnapshot().formError ?? "", /save the page position/);
  await session.navigate("night.local", "typed");
  assert.equal(api.getSite.mock.callCount(), 4);
  assert.equal(entry(session).address, "roofs.local");
});

test("repeat visits to the same address are separate entries with independent snapshots and scroll", async () => {
  const { session, api } = await browsing();
  await session.navigate("harbor.local", "typed");
  const firstId = entry(session).id;
  session.saveScroll(firstId, { x: 0, y: 800 });
  api.getSite.mock.mockImplementationOnce(async () => ({
    ...site,
    title: "Version two",
    sanitizedHtml: "<p>New version</p>",
  }));
  await session.navigate("harbor.local", "typed");
  assert.notEqual(entry(session).id, firstId);
  assert.deepEqual(entry(session).scroll, { x: 0, y: 0 });
  await session.back();
  assert.equal(entry(session).title, site.title);
  assert.deepEqual(entry(session).scroll, { x: 0, y: 800 });
  await session.forward();
  assert.equal(entry(session).title, "Version two");
  assert.equal(api.recordVisit.mock.callCount(), 2);
});

test("new typed intent wins over an earlier navigation still awaiting scroll capture", async () => {
  const { session, api } = await fourPages();
  const earlier = deferred<{ x: number; y: number }>();
  const latest = deferred<{ x: number; y: number }>();
  let captures = 0;
  session.attachViewport(entry(session).id, () =>
    ++captures === 1 ? earlier.promise : latest.promise,
  );
  const old = session.navigate("night.local", "link");
  const current = session.navigate("dawn.local", "typed");
  latest.resolve({ x: 0, y: 700 });
  await current;
  earlier.resolve({ x: 0, y: 100 });
  await old;
  assert.equal(entry(session).address, "dawn.local");
  assert.equal(api.getSite.mock.callCount(), 5);
  assert.equal(api.recordVisit.mock.callCount(), 5);
  assert.deepEqual(session.getSnapshot().trail.entries[3].scroll, {
    x: 0,
    y: 700,
  });
});

test("a pruned entry's late Visit result cannot change its replacement or resurrect the branch", async () => {
  const { session, api } = await browsing();
  await session.navigate("harbor.local", "typed");
  const visit = deferred<void>();
  api.recordVisit.mock.mockImplementationOnce(() => visit.promise);
  const old = session.navigate("tides.local", "link");
  await Promise.resolve();
  await session.back();
  await session.navigate("marsh.local", "typed");
  visit.reject(new Error("Old Visit failure"));
  await old;
  assert.deepEqual(
    session.getSnapshot().trail.entries.map((page) => page.address),
    ["harbor.local", "marsh.local"],
  );
  assert.equal(entry(session).visitError, null);
  assert.equal(api.recordVisit.mock.callCount(), 3);
});

test("Back dismisses loading or API-error attempts to the last resolved entry, even at the first page", async () => {
  const { session, api } = await browsing();
  await session.navigate("harbor.local", "typed");
  const pending = deferred<typeof site>();
  api.getSite.mock.mockImplementationOnce(() => pending.promise);
  const navigation = session.navigate("tides.local", "link");
  assert.equal(navigationAvailability(session.getSnapshot()).back, true);
  await session.back();
  assert.equal(entry(session).address, "harbor.local");
  pending.resolve({ ...site, address: "tides.local" });
  await navigation;
  assert.equal(session.getSnapshot().trail.entries.length, 1);
  api.getSite.mock.mockImplementationOnce(async () => {
    throw new ApiError(503, "Offline");
  });
  await session.navigate("marsh.local", "typed");
  assert.equal(navigationAvailability(session.getSnapshot()).back, true);
  await session.back();
  assert.equal(entry(session).address, "harbor.local");
  assert.deepEqual(navigationAvailability(session.getSnapshot()), {
    back: false,
    forward: false,
  });
  assert.equal(api.recordVisit.mock.callCount(), 1);
});
