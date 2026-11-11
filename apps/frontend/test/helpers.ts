import { mock } from "node:test";
import type { BrowserApi, Site, VisitInput } from "../src/browser/api";
import { BrowserSession } from "../src/browser/session";

export const PERSON_ID = "650000000000000001000001";
export const OTHER_PERSON_ID = "650000000000000001000002";
export const people = [
  { _id: PERSON_ID, name: "Ada" },
  { _id: OTHER_PERSON_ID, name: "Mira" },
];
export const site: Site = {
  _id: "650000000000000002000001",
  address: "harbor.local",
  title: "A walking map",
  sanitizedHtml:
    '<h1>Harbor</h1><p>Take a walk.</p><a href="#" data-internal-address="tides.local">Tides</a>',
  author: OTHER_PERSON_ID,
  publishedAt: "2026-09-14T07:00:00.000Z",
};
export function fixture() {
  const api = {
    listPeople: mock.fn(async (_signal?: AbortSignal) => people),
    getSite: mock.fn(async (address: string, _signal?: AbortSignal) => ({
      ...site,
      address,
    })),
    recordVisit: mock.fn(
      async (_visit: VisitInput, _signal?: AbortSignal): Promise<void> =>
        undefined,
    ),
  } satisfies BrowserApi;
  return { api, session: new BrowserSession(api) };
}
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
