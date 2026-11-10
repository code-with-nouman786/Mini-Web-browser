import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSeedRecords } from "../src/seed/seed-data";
import { sanitizeSiteHtml } from "../src/sites/sanitize-site-html";

test("strips scripts, event handlers and all author styles", () => {
  const result = sanitizeSiteHtml(
    '<script>alert(1)</script><style>@import "https://evil.invalid/a";</style><h1 onload="attack()" onclick="attack()" style="background:url(https://evil.invalid/b)">Heading</h1><p onmouseover="attack()">Text</p>',
  );
  assert.equal(result, "<h1>Heading</h1><p>Text</p>");
});

test("removes external resources, forms, frames, plugins and document navigation", () => {
  const html =
    '<base href="https://evil.invalid"><meta http-equiv="refresh" content="0;url=https://evil.invalid"><link rel="stylesheet" href="https://evil.invalid/style"><img src="https://evil.invalid/image" srcset="https://evil.invalid/2x 2x"><video src="https://evil.invalid/video"><source src="https://evil.invalid/source"></video><audio src="https://evil.invalid/audio"></audio><iframe src="https://evil.invalid/frame" srcdoc="<script>attack()</script>"></iframe><object data="https://evil.invalid/plugin"></object><embed src="https://evil.invalid/embed"><form action="https://evil.invalid/post"><input name="data"><button>Send</button></form><p>Safe</p>';
  const result = sanitizeSiteHtml(html);
  assert.equal(result, "<p>Safe</p>");
});

test("discards unsafe URL schemes, encoded scripts, protocol-relative and unmarked external URLs", () => {
  for (const href of [
    "javascript:alert(1)",
    "java&#x0a;script:alert(1)",
    "data:text/html,attack",
    "blob:https://evil.invalid/id",
    "file:///secret",
    "//evil.invalid/path",
    "https://evil.invalid/path",
    "  https://evil.invalid/path  ",
    "https:\\evil.invalid",
  ]) {
    const result = sanitizeSiteHtml(
      `<a href="${href}" target="_top" download onclick="attack()">Read</a>`,
    );
    assert.equal(result, "<span>Read</span>");
  }
});

test("preserves safe headings, prose, emphasis, lists, tables and code blocks", () => {
  const html =
    "<h1>Title</h1><h2>Section</h2><p>A <strong>strong</strong> and <em>quiet</em> page.</p><ul><li>One</li></ul><ol><li>Two</li></ol><blockquote>Note</blockquote><table><caption>Data</caption><thead><tr><th>Name</th></tr></thead><tbody><tr><td>Ada</td></tr></tbody></table><pre><code>&lt;safe&gt;</code></pre>";
  assert.equal(sanitizeSiteHtml(html), html);
});

test("turns matching marked internal links into inert, normalized address links", () => {
  const result = sanitizeSiteHtml(
    '<a href="HTTPS://TIDES.LOCAL/" data-address=" Tides.Local " target="_top" rel="opener" style="color:red" onclick="attack()"><strong>Water</strong></a>',
  );
  assert.equal(
    result,
    '<a href="#" data-internal-address="tides.local"><strong>Water</strong></a>',
  );
  assert.equal(
    sanitizeSiteHtml('<a href="harbor.local/guide/">Guide</a>'),
    '<a href="#" data-internal-address="harbor.local/guide">Guide</a>',
  );
});

test("rejects marker mismatches and author attempts to forge the sanitized link attribute", () => {
  assert.equal(
    sanitizeSiteHtml(
      '<a href="https://evil.invalid" data-address="harbor.local">Mismatch</a>',
    ),
    "<span>Mismatch</span>",
  );
  assert.equal(
    sanitizeSiteHtml(
      '<a href="#" data-internal-address="harbor.local">Forged</a>',
    ),
    "<span>Forged</span>",
  );
  assert.equal(
    sanitizeSiteHtml(
      '<a href="javascript:attack()" data-address="javascript:attack()">Unsafe</a>',
    ),
    "<span>Unsafe</span>",
  );
});

test("broken internal links survive without requiring a corresponding Site record", () => {
  const records = buildSeedRecords();
  assert.equal(
    records.sites.some((site) => site.address === "ferry.local"),
    false,
  );
  const html = records.sites.find(
    (site) => site.address === "harbor.local",
  )?.html;
  assert.ok(html);
  const result = sanitizeSiteHtml(html);
  assert.ok(result.includes('href="#" data-internal-address="ferry.local"'));
  assert.equal(result.includes("https://"), false);
});

test("malformed foreign-content and DOM-clobbering payloads cannot introduce active markup", () => {
  const payloads = [
    '<svg><a href="javascript:attack()"><animate attributeName="href" values="javascript:attack()"/></a></svg><p id="parent" name="currentScript">After</p>',
    '<math><mtext><table><mglyph><style><!--</style><img title="--><img src=x onerror=attack()>">',
    '<div id="frame" name="parent" style="position:fixed"><iframe srcdoc="attack"></iframe><p onpointerenter="attack()">Text</p></div>',
    '<a href="data:text/html,&lt;script&gt;attack()&lt;/script&gt;" data-address="harbor.local">Unsafe</a>',
  ];
  for (const payload of payloads) {
    const result = sanitizeSiteHtml(payload);
    assert.equal(
      /<(script|style|iframe|img|form|object|embed|svg|math|base|meta|link)\b/i.test(
        result,
      ),
      false,
    );
    assert.equal(/\s(?:on\w+|id|name|style|srcdoc)\s*=/i.test(result), false);
  }
});
