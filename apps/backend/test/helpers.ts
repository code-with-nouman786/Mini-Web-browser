import { mock } from "node:test";

export const PERSON_A = "64b000000000000000000001";
export const PERSON_B = "64b000000000000000000002";
export const SITE_ID = "64b000000000000000000003";

export function queryFor<T>(value: T) {
  const exec = mock.fn(async () => value);
  const lean = mock.fn(() => ({ exec }));
  const sort = mock.fn((_order: Record<string, number>) => ({ lean, exec }));
  return { exec, lean, sort };
}
