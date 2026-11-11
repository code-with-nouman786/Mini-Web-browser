import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { runInNewContext } from "node:vm";
import { FrameController } from "../src/browser/frame-controller";
import {
  BRIDGE_SCRIPT,
  buildFrameDocument,
  readFrameMessage,
} from "../src/browser/frame-document";
import { isScrollPosition } from "../src/browser/viewport-state";

const channel = "11111111-1111-4111-8111-111111111111";
const origin = "http://mini-browser.test";
function controller() {
  const postMessage = mock.fn(
    (_message: unknown, _origin: string) => undefined,
  );
  const frame = { postMessage } as unknown as Window;
  const onNavigate = mock.fn((_address: string) => undefined);
  const onScroll = mock.fn((_position: { x: number; y: number }) => undefined);
  const bridge = new FrameController(frame, channel, onNavigate, onScroll);
  const receive = (data: object) =>
    bridge.receive({
      source: frame,
      origin: "null",
      data: { ...data, channel },
    });
  return { frame, postMessage, onNavigate, onScroll, bridge, receive };
}

test("scroll messages require the current frame, opaque origin, channel, exact shape and finite bounded coordinates", () => {
  const source = {} as Window;
  const valid = {
    source,
    origin: "null",
    data: { type: "wyxan:scroll", channel, position: { x: 12.5, y: 900 } },
  };
  assert.deepEqual(readFrameMessage(valid, source, channel), {
    type: "wyxan:scroll",
    position: { x: 12.5, y: 900 },
  });
  for (const position of [
    null,
    [],
    { x: 0 },
    { x: 0, y: 1, url: "external" },
    { x: -1, y: 0 },
    { x: 0, y: Infinity },
    { x: NaN, y: 0 },
    { x: 0, y: "900" },
    { x: 0, y: 100_000_001 },
  ]) {
    assert.equal(isScrollPosition(position), false);
    assert.equal(
      readFrameMessage(
        { ...valid, data: { ...valid.data, position } },
        source,
        channel,
      ),
      null,
    );
  }
  for (const event of [
    { ...valid, source: {} as Window },
    { ...valid, origin },
    { ...valid, data: { ...valid.data, channel: "stale" } },
    { ...valid, data: { ...valid.data, extra: true } },
    { ...valid, data: { ...valid.data, type: "wyxan:restore-anything" } },
  ])
    assert.equal(readFrameMessage(event, source, channel), null);
  for (const requestId of [-1, 0, 0.5, Number.MAX_SAFE_INTEGER + 1, "1"])
    assert.equal(
      readFrameMessage(
        {
          ...valid,
          data: { ...valid.data, type: "wyxan:captured-scroll", requestId },
        },
        source,
        channel,
      ),
      null,
    );
});

test("saved scroll is embedded only as validated numeric bridge attributes", () => {
  const document = buildFrameDocument("<h1>Snapshot</h1>", channel, origin, {
    x: 12.5,
    y: 870,
  });
  assert.ok(document.includes('data-scroll-x="12.5" data-scroll-y="870"'));
  assert.throws(
    () => buildFrameDocument("", channel, origin, { x: 0, y: NaN }),
    /scroll/,
  );
});

test("capture waits for frame readiness and resolves only its matching validated response", async () => {
  const value = controller();
  const captured = value.bridge.capture();
  assert.deepEqual(value.postMessage.mock.calls[0].arguments, [
    { type: "wyxan:initialize", channel },
    "*",
  ]);
  value.receive({ type: "wyxan:ready", position: { x: 0, y: 500 } });
  assert.deepEqual(value.postMessage.mock.calls[1].arguments, [
    { type: "wyxan:capture-scroll", requestId: 1, channel },
    "*",
  ]);
  value.receive({
    type: "wyxan:captured-scroll",
    requestId: 99,
    position: { x: 0, y: 999 },
  });
  assert.equal(
    value.onScroll.mock.callCount(),
    1,
    "unrequested replies must not update scroll",
  );
  value.receive({
    type: "wyxan:captured-scroll",
    requestId: 1,
    position: { x: 8, y: 750 },
  });
  assert.deepEqual(await captured, { x: 8, y: 750 });
  value.bridge.dispose();
});

test("forged scroll and link messages cannot complete a capture or trigger navigation", async () => {
  const value = controller();
  const captured = value.bridge.capture();
  value.bridge.receive({
    source: {} as Window,
    origin: "null",
    data: {
      type: "wyxan:captured-scroll",
      channel,
      requestId: 1,
      position: { x: 0, y: 900 },
    },
  });
  value.receive({ type: "wyxan:navigate", address: "HTTPS://tides.local" });
  value.bridge.receive({
    source: value.frame,
    origin,
    data: { type: "wyxan:navigate", channel, address: "tides.local" },
  });
  assert.equal(value.onNavigate.mock.callCount(), 0);
  assert.equal(value.onScroll.mock.callCount(), 0);
  const rejected = assert.rejects(captured, /closed/);
  value.bridge.dispose();
  await rejected;
  value.receive({ type: "wyxan:navigate", address: "tides.local" });
  assert.equal(value.onNavigate.mock.callCount(), 0);
});

test("capture timeout fails visibly instead of pretending an old position is exact", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const value = controller();
  const captured = value.bridge.capture();
  const rejected = assert.rejects(captured, /did not respond/);
  context.mock.timers.tick(1500);
  await rejected;
  value.receive({
    type: "wyxan:captured-scroll",
    requestId: 1,
    position: { x: 0, y: 900 },
  });
  assert.equal(value.onScroll.mock.callCount(), 0);
  value.bridge.dispose();
});

test("concurrent capture replies are correlated and cannot resolve another request", async () => {
  const value = controller();
  value.receive({ type: "wyxan:ready", position: { x: 0, y: 0 } });
  const first = value.bridge.capture();
  const second = value.bridge.capture();
  value.receive({
    type: "wyxan:captured-scroll",
    requestId: 2,
    position: { x: 0, y: 600 },
  });
  assert.deepEqual(await second, { x: 0, y: 600 });
  value.receive({
    type: "wyxan:captured-scroll",
    requestId: 1,
    position: { x: 0, y: 300 },
  });
  assert.deepEqual(await first, { x: 0, y: 300 });
  value.bridge.dispose();
});

type Listener = (event: Record<string, unknown>) => void;
function scriptFixture() {
  const windowEvents = new Map<string, Listener>();
  const documentEvents = new Map<string, Listener>();
  const animationFrames: Array<() => void> = [];
  const messages: Array<{ data: Record<string, unknown>; origin: string }> = [];
  const parent = {
    postMessage: (data: Record<string, unknown>, target: string) =>
      messages.push({ data: structuredClone(data), origin: target }),
  };
  const attributes: Record<string, string> = {
    "data-channel": channel,
    "data-parent-origin": origin,
    "data-scroll-x": "10",
    "data-scroll-y": "880",
  };
  const scrollTo = mock.fn((x: number, y: number) => {
    window.scrollX = x;
    window.scrollY = y;
  });
  const window = {
    parent,
    scrollX: 0,
    scrollY: 0,
    scrollTo,
    addEventListener: (name: string, listener: Listener) =>
      windowEvents.set(name, listener),
  };
  class Element {
    closest(selector: string) {
      return selector === "a" ? this : null;
    }
    getAttribute(name: string) {
      return name === "data-internal-address" ? "tides.local" : null;
    }
  }
  runInNewContext(BRIDGE_SCRIPT, {
    window,
    Element,
    document: {
      currentScript: { getAttribute: (name: string) => attributes[name] },
      readyState: "loading",
      addEventListener: (name: string, listener: Listener) =>
        documentEvents.set(name, listener),
    },
    requestAnimationFrame: (callback: () => void) =>
      animationFrames.push(callback),
  });
  const flush = () => {
    for (const callback of animationFrames.splice(0)) callback();
  };
  const send = (data: object, source: unknown = parent, eventOrigin = origin) =>
    windowEvents.get("message")?.({
      data: { ...data, channel },
      source,
      origin: eventOrigin,
    });
  return {
    window,
    parent,
    windowEvents,
    documentEvents,
    messages,
    flush,
    send,
    Element,
    scrollTo,
  };
}

test("the actual pinned bridge restores once, reports live scroll and captures before departure", () => {
  const value = scriptFixture();
  assert.equal(value.messages.length, 0);
  value.windowEvents.get("load")?.({});
  value.flush();
  assert.deepEqual(
    Array.from(value.scrollTo.mock.calls[0].arguments),
    [10, 880],
  );
  assert.deepEqual(value.messages[0], {
    data: { type: "wyxan:ready", channel, position: { x: 10, y: 880 } },
    origin,
  });
  value.window.scrollY = 1250;
  value.windowEvents.get("scroll")?.({});
  value.flush();
  assert.deepEqual(value.messages.at(-1)?.data, {
    type: "wyxan:scroll",
    channel,
    position: { x: 10, y: 1250 },
  });
  value.send({ type: "wyxan:capture-scroll", requestId: 3 });
  assert.deepEqual(value.messages.at(-1)?.data, {
    type: "wyxan:captured-scroll",
    channel,
    requestId: 3,
    position: { x: 10, y: 1250 },
  });
  value.send({ type: "wyxan:initialize" });
  value.flush();
  assert.equal(
    value.scrollTo.mock.callCount(),
    1,
    "a late load/initialize must never jump back",
  );
  assert.equal(value.window.scrollY, 1250);
});

test("the actual bridge rejects forged parent commands, extra fields and invalid capture identifiers", () => {
  const value = scriptFixture();
  value.windowEvents.get("load")?.({});
  value.flush();
  const initial = value.messages.length;
  value.send({ type: "wyxan:capture-scroll", requestId: 1 }, {});
  value.send(
    { type: "wyxan:capture-scroll", requestId: 1 },
    value.parent,
    "https://forged.invalid",
  );
  for (const data of [
    { type: "wyxan:capture-scroll", requestId: 1, channel: "forged" },
    { type: "wyxan:capture-scroll", requestId: 1, extra: true },
    { type: "wyxan:capture-scroll", requestId: -1 },
    { type: "wyxan:capture-scroll", requestId: 0.5 },
    { type: "wyxan:capture-scroll", requestId: "1" },
    { type: "wyxan:execute", script: "attack()" },
  ])
    value.windowEvents.get("message")?.({
      data: { channel, ...data },
      source: value.parent,
      origin,
    });
  assert.equal(value.messages.length, initial);
});

test("the actual bridge still intercepts internal clicks while scroll messaging is active", () => {
  const value = scriptFixture();
  const preventDefault = mock.fn();
  const stopPropagation = mock.fn();
  value.documentEvents.get("click")?.({
    target: new value.Element(),
    button: 0,
    preventDefault,
    stopPropagation,
  });
  assert.equal(preventDefault.mock.callCount(), 1);
  assert.equal(stopPropagation.mock.callCount(), 1);
  assert.deepEqual(value.messages.at(-1), {
    data: { type: "wyxan:navigate", channel, address: "tides.local" },
    origin,
  });
});
