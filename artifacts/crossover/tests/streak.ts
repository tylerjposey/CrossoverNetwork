import assert from "node:assert/strict";
import { recordOpen } from "../src/lib/streak.ts";

const values = new Map<string, string>();
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { values.set(key, value); },
};
Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: storage } });
const date = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12);
assert.equal(recordOpen(date(2026, 3, 7))?.count, 1);
assert.equal(recordOpen(date(2026, 3, 7))?.count, 1);
assert.equal(recordOpen(date(2026, 3, 8))?.count, 2);
assert.equal(recordOpen(date(2026, 3, 9))?.count, 3);
assert.equal(recordOpen(date(2026, 3, 12))?.count, 1);
console.log("PASS streak: repeated opens, consecutive days, DST and gap reset");
for (const bad of ["invalid json", "null", '{"count":2,"last":"2026-02-30"}',
  '{"count":-5,"last":"2026-03-11"}', '{"count":2.5,"last":"2026-03-11"}',
  '{"count":1,"last":"2099-01-01"}']) {
  values.set("crossover.streak.v1", bad);
  assert.deepEqual(recordOpen(date(2026, 3, 12)), { count: 1, last: "2026-03-12" });
}
Object.defineProperty(globalThis, "window", { configurable: true, value: {
  get localStorage() { throw new Error("storage blocked"); },
} });
assert.equal(recordOpen(), null);
Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: {
  ...storage, setItem() { throw new Error("storage full"); },
} } });
assert.equal(recordOpen(), null);
console.log("PASS streak: corrupt data, invalid dates, clock rollback and denied/full storage never break rendering");
