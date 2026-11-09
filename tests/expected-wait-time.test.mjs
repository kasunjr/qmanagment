import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../lib/expected-wait-time.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const module = { exports: {} };
new Function("require", "module", "exports", compiled)(() => ({}), module, module.exports);
const { simulateQueue } = module.exports;

// Counter 1 serves Deposit and Loans, Counter 2 serves Deposit only.
// Deposit takes 5 minutes, Loans 20. The customer holds ticket #4 for Deposit.
const DEPOSIT = "deposit";
const LOANS = "loans";
const deposit = { service_id: DEPOSIT, duration_minutes: 5 };
const loans = { service_id: LOANS, duration_minutes: 20 };
const counters = (c1Busy, c2Busy) => [
  { id: "c1", service_ids: [DEPOSIT, LOANS], busy_seconds: c1Busy },
  { id: "c2", service_ids: [DEPOSIT], busy_seconds: c2Busy },
];

test("at booking with both counters free, Counter 2 serves #1 and #3 before #4", () => {
  assert.deepEqual(simulateQueue(DEPOSIT, counters(0, 0), [deposit, loans, deposit]), {
    people_ahead: 3,
    estimated_wait_minutes: 10,
  });
});

test("Counter 1 took #1 and Counter 2 took #3: #4 is next at Counter 2", () => {
  assert.deepEqual(simulateQueue(DEPOSIT, counters(5 * 60, 5 * 60), [loans]), {
    people_ahead: 1,
    estimated_wait_minutes: 5,
  });
});

test("Counter 2 took #1 and Counter 1 took #2: #3 goes first at Counter 2", () => {
  assert.deepEqual(simulateQueue(DEPOSIT, counters(20 * 60, 5 * 60), [deposit]), {
    people_ahead: 1,
    estimated_wait_minutes: 10,
  });
});

test("the estimate counts down while the counters work", () => {
  // One minute after Counter 2 called #1 and Counter 1 called #2.
  assert.equal(simulateQueue(DEPOSIT, counters(19 * 60, 4 * 60), [deposit]).estimated_wait_minutes, 9);
});

test("a Loans ticket can only wait for Counter 1", () => {
  assert.deepEqual(simulateQueue(LOANS, counters(0, 0), [deposit, loans, deposit]), {
    people_ahead: 3,
    estimated_wait_minutes: 20,
  });
});

test("tickets only other counters can serve are not ahead", () => {
  const other = { service_id: "other", duration_minutes: 30 };
  const withOther = [...counters(0, 0), { id: "c3", service_ids: ["other"], busy_seconds: 0 }];
  assert.deepEqual(simulateQueue(DEPOSIT, withOther, [other, other]), {
    people_ahead: 0,
    estimated_wait_minutes: 0,
  });
});

test("no counter serving the service gives no estimate", () => {
  assert.deepEqual(simulateQueue("tax", counters(0, 0), [deposit, { service_id: "tax", duration_minutes: 5 }]), {
    people_ahead: 1,
    estimated_wait_minutes: null,
  });
});
