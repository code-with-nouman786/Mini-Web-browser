import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  enteredAddress,
  isCanonicalInternalAddress,
} from "../src/browser/address";
import {
  BRIDGE_HASH,
  BRIDGE_SCRIPT,
  buildFrameDocument,
  FRAME_CSP,
  FRAME_SANDBOX,
  FRAME_STYLES,
  frameNavigationAddress,
  STYLE_HASH,
} from "../src/browser/frame-document";
import {
  BrowserShell,
  type BrowserActions,
} from "../src/components/browser-shell";
import { fixture } from "./helpers";

const channel = "11111111-1111-4111-8111-111111111111";

test("CSP pins only the controlled bridge and style, and blocks network, forms and active resources", () => {
  assert.equal(
    createHash("sha256").update(BRIDGE_SCRIPT).digest("base64"),
    BRIDGE_HASH,
  );
  assert.equal(
    createHash("sha256").update(FRAME_STYLES).digest("base64"),
    STYLE_HASH,
  );
  for (const directive of [
    "default-src",
    "connect-src",
    "img-src",
    "font-src",
    "media-src",
    "frame-src",
    "child-src",
    "worker-src",
    "object-src",
    "form-action",
    "base-uri",
    "script-src-attr",
    "style-src-attr",
  ])
    assert.ok(FRAME_CSP.includes(`${directive} 'none'`));
  assert.ok(FRAME_CSP.includes(`script-src 'sha256-${BRIDGE_HASH}'`));
  assert.equal(
    /unsafe-inline|unsafe-eval|https?:|\bself\b/.test(FRAME_CSP),
    false,
  );
  assert.equal(FRAME_SANDBOX, "allow-scripts");
  assert.equal(FRAME_SANDBOX.includes("allow-same-origin"), false);
});

test("document policy precedes content and only a trusted bridge is injected after it", () => {
  const html = buildFrameDocument(
    "<h1>Safe content</h1>",
    channel,
    "http://mini-browser.test",
  );
  assert.ok(
    html.indexOf("Content-Security-Policy") < html.indexOf("<h1>Safe content"),
  );
  assert.equal((html.match(/<script /g) ?? []).length, 1);
  assert.ok(html.includes(`data-channel="${channel}"`));
  assert.ok(html.indexOf("<h1>Safe content") < html.indexOf("<script "));
  assert.throws(
    () =>
      buildFrameDocument(
        "",
        '"><script>attack()</script>',
        "http://mini-browser.test",
      ),
    /channel/,
  );
  assert.throws(
    () => buildFrameDocument("", channel, "javascript:attack()"),
    /origin/,
  );
});

test("message acceptance requires exact shape, opaque origin, current source window, channel and canonical internal address", () => {
  const frame = {} as Window;
  const data = { type: "wyxan:navigate", channel, address: "tides.local" };
  const valid = { source: frame, origin: "null", data };
  assert.equal(frameNavigationAddress(valid, frame, channel), "tides.local");
  for (const event of [
    { ...valid, source: {} as Window },
    { ...valid, source: null },
    { ...valid, origin: "https://evil.invalid" },
    { ...valid, data: null },
    { ...valid, data: [] },
    { ...valid, data: "tides.local" },
    { ...valid, data: { ...data, channel: "stale-channel" } },
    { ...valid, data: { ...data, type: "other" } },
    { ...valid, data: { ...data, source: "typed" } },
    { ...valid, data: { address: "tides.local" } },
  ])
    assert.equal(frameNavigationAddress(event, frame, channel), null);
  assert.equal(frameNavigationAddress(valid, null, channel), null);
  for (const address of [
    "HTTPS://tides.local",
    "Tides.Local",
    " tides.local",
    "tides.local/",
    "javascript:alert(1)",
    "data:text/html,attack",
    "//outside.invalid",
    "bad address",
    "a".repeat(2049),
    1,
    null,
  ]) {
    assert.equal(
      frameNavigationAddress(
        { ...valid, data: { ...data, address } },
        frame,
        channel,
      ),
      null,
    );
  }
});

test("normalization accepts stored internal identifiers and never treats them as network destinations", () => {
  assert.equal(
    enteredAddress(" HTTPS://Harbor.Local/Guide/// "),
    "harbor.local/guide",
  );
  assert.equal(isCanonicalInternalAddress("harbor.local/guide"), true);
  assert.equal(enteredAddress("javascript:alert(1)"), null);
  assert.equal(enteredAddress("//outside.invalid"), null);
});

test("the shell displays disabled back and forward controls, a person selector and a named address form", () => {
  const { session } = fixture();
  const noop = () => undefined;
  const actions: BrowserActions = {
    selectPerson: noop,
    setAddress: noop,
    go: noop,
    followLink: noop,
    retryPeople: noop,
    retryNavigation: noop,
  };
  const markup = renderToStaticMarkup(
    <BrowserShell
      state={session.getSnapshot()}
      actions={actions}
      parentOrigin="http://mini-browser.test"
    />,
  );
  for (const label of ["Back", "Forward"]) {
    const button = markup.match(
      new RegExp(`<button[^>]*aria-label="${label}"[^>]*>`),
    )?.[0];
    assert.ok(button?.includes('disabled=""'));
  }
  assert.ok(markup.includes('id="browser-person"'));
  assert.ok(markup.includes('id="site-address"'));
  assert.ok(markup.includes('aria-label="Page viewport"'));
  assert.equal(markup.includes("<iframe"), false);
});
