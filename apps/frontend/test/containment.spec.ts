import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { chromium, type Browser, type Page } from "playwright";
import type { ScrollPosition } from "../src/browser/viewport-state";
import {
  buildFrameDocument,
  FRAME_PERMISSIONS,
  FRAME_SANDBOX,
} from "../src/browser/frame-document";

let browser: Browser;
const channel = "11111111-1111-4111-8111-111111111111";
const origin = "http://mini-browser.test";

before(async () => {
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
  });
});
after(async () => {
  await browser?.close();
});

async function viewport(
  page: Page,
  content: string,
  scroll: ScrollPosition = { x: 0, y: 0 },
) {
  await page.route(`${origin}/**`, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html><body><h1 id="outer">Outer application</h1></body></html>',
    }),
  );
  await page.goto(origin);
  await page.evaluate(
    ({ document, sandbox, permissions }) => {
      const frame = window.document.createElement("iframe");
      frame.title = "Isolated page";
      frame.sandbox.value = sandbox;
      frame.allow = permissions;
      frame.referrerPolicy = "no-referrer";
      frame.style.width = "700px";
      frame.style.height = "500px";
      const received: unknown[] = [];
      Object.assign(window, { received });
      window.addEventListener("message", (event) => {
        if (event.data?.type !== "wyxan:navigate") return;
        received.push({
          data: event.data,
          origin: event.origin,
          fromFrame: event.source === frame.contentWindow,
        });
      });
      frame.srcdoc = document;
      window.document.body.append(frame);
    },
    {
      document: buildFrameDocument(content, channel, origin, scroll),
      sandbox: FRAME_SANDBOX,
      permissions: FRAME_PERMISSIONS,
    },
  );
  const handle = await page.locator("iframe").elementHandle();
  const frame = await handle?.contentFrame();
  assert.ok(frame);
  await frame.waitForLoadState();
  return frame;
}

test("Chromium intercepts normal, modified and middle link clicks without navigating the outer tab", async () => {
  const page = await browser.newPage();
  try {
    const frame = await viewport(
      page,
      '<h1>Page</h1><a href="#" data-internal-address="tides.local"><strong>Read tides</strong></a><a href="#" data-internal-address="ferry.local">Broken ferry link</a>',
    );
    await frame.getByRole("link", { name: "Read tides" }).click();
    await page.waitForFunction(
      () =>
        (window as unknown as { received: unknown[] }).received.length === 1,
    );
    await frame
      .getByRole("link", { name: "Read tides" })
      .click({ modifiers: ["ControlOrMeta"] });
    await frame
      .getByRole("link", { name: "Broken ferry link" })
      .click({ button: "middle" });
    await page.waitForFunction(
      () =>
        (window as unknown as { received: unknown[] }).received.length === 3,
    );
    const messages = await page.evaluate(
      () => (window as unknown as { received: unknown[] }).received,
    );
    assert.deepEqual(messages, [
      {
        data: { type: "wyxan:navigate", channel, address: "tides.local" },
        origin: "null",
        fromFrame: true,
      },
      {
        data: { type: "wyxan:navigate", channel, address: "tides.local" },
        origin: "null",
        fromFrame: true,
      },
      {
        data: { type: "wyxan:navigate", channel, address: "ferry.local" },
        origin: "null",
        fromFrame: true,
      },
    ]);
    assert.equal(page.url(), `${origin}/`);
    assert.equal(page.context().pages().length, 1);
    assert.equal(frame.url(), "about:srcdoc");
  } finally {
    await page.close();
  }
});

test("Chromium enforces opaque-origin isolation: neither frame nor parent can read the other's document", async () => {
  const page = await browser.newPage();
  try {
    const frame = await viewport(page, "<h1>Contained content</h1>");
    const denied = await frame.evaluate(() => {
      try {
        return window.parent.document.body.textContent;
      } catch (error: unknown) {
        return error instanceof DOMException ? error.name : "unexpected";
      }
    });
    assert.equal(denied, "SecurityError");
    assert.equal(
      await page.evaluate(
        () => document.querySelector("iframe")?.contentDocument,
      ),
      null,
    );
    assert.equal(
      await page.locator("iframe").getAttribute("sandbox"),
      "allow-scripts",
    );
  } finally {
    await page.close();
  }
});

test("Chromium CSP blocks author scripts, handlers, forms and all resource requests even beyond sanitization", async () => {
  const page = await browser.newPage();
  const requests: string[] = [];
  await page.route("https://untrusted.invalid/**", (route) => {
    requests.push(route.request().url());
    return route.abort();
  });
  try {
    // Deliberately bypass the backend sanitizer here to test the second boundary.
    const frame = await viewport(
      page,
      '<h1>Defense in depth</h1><script>document.body.dataset.attacked="script"</script><style>@import "https://untrusted.invalid/import";body{background:url(https://untrusted.invalid/background)}</style><img src="https://untrusted.invalid/image"><iframe src="https://untrusted.invalid/frame"></iframe><object data="https://untrusted.invalid/object"></object><form action="https://untrusted.invalid/form"><button type="submit">Send</button></form><a href="#" data-internal-address="tides.local" onclick="document.body.dataset.attacked=\'event\'">Safe link</a>',
    );
    await frame.getByRole("button", { name: "Send" }).click();
    await frame.getByRole("link", { name: "Safe link" }).click();
    await page.waitForFunction(
      () =>
        (window as unknown as { received: unknown[] }).received.length === 1,
    );
    assert.equal(
      await frame.evaluate(() => document.body.dataset.attacked),
      undefined,
    );
    assert.deepEqual(requests, []);
    assert.equal(page.url(), `${origin}/`);
    assert.equal(frame.url(), "about:srcdoc");
  } finally {
    await page.close();
  }
});

test("Chromium restores saved iframe scroll and captures its exact departure position across a remount", async () => {
  const page = await browser.newPage();
  try {
    const content = `<h1>Original snapshot</h1>${"<p>A long original page for scrolling.</p>".repeat(150)}`;
    const frame = await viewport(page, content, { x: 0, y: 880 });
    await frame.waitForFunction(() => window.scrollY === 880);
    await frame.evaluate(() => window.scrollTo(0, 1240));
    const captured = await page.evaluate(
      ({ channel }) =>
        new Promise<{ x: number; y: number }>((resolve) => {
          const frameWindow = document.querySelector("iframe")!.contentWindow!;
          const receive = (event: MessageEvent) => {
            if (
              event.source === frameWindow &&
              event.origin === "null" &&
              event.data?.type === "wyxan:captured-scroll" &&
              event.data?.channel === channel &&
              event.data.requestId === 1
            ) {
              window.removeEventListener("message", receive);
              resolve(event.data.position);
            }
          };
          window.addEventListener("message", receive);
          frameWindow.postMessage(
            { type: "wyxan:capture-scroll", channel, requestId: 1 },
            "*",
          );
        }),
      { channel },
    );
    assert.deepEqual(captured, { x: 0, y: 1240 });
    const restored = await viewport(page, content, captured);
    await restored.waitForFunction(() => window.scrollY === 1240);
    assert.equal(
      await restored
        .getByRole("heading", { name: "Original snapshot" })
        .count(),
      1,
    );
    assert.equal(
      await page.locator("iframe").getAttribute("sandbox"),
      "allow-scripts",
    );
  } finally {
    await page.close();
  }
});
