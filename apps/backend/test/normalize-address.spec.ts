import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeAddress } from "../src/common/normalize-address";

const cases = [
  ["  Example.Local  ", "example.local"],
  ["HTTP://Example.Local/", "example.local"],
  ["hTtPs://Example.Local///", "example.local"],
  ["Example.Local/Guide/", "example.local/guide"],
  ["www.Example.Local", "www.example.local"],
  ["  https://Example.Local/Guide///  ", "example.local/guide"],
] as const;

for (const [input, expected] of cases) {
  test(`normalizes ${JSON.stringify(input)} to ${expected}`, () => {
    assert.equal(normalizeAddress(input), expected);
    assert.equal(normalizeAddress(expected), expected);
  });
}
