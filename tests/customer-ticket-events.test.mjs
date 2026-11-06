import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const source = readFileSync(
  new URL(
    "../app/api/public/[tenantCode]/tickets/[ticketId]/events/route.ts",
    import.meta.url,
  ),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const ticketId = "12345678-1234-4234-8234-123456789abc";

function loadRoute(rows = [{ branch_id: "branch-1" }]) {
  const queries = [];
  const subscriptions = [];
  const dependencies = {
    "@/lib/db": {
      db: {
        query: async (sql, values) => {
          queries.push({ sql, values });
          return { rows };
        },
      },
    },
    "@/lib/staff-users": {
      isUuid: (value) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          value,
        ),
    },
    "@/lib/queue-events": {
      createQueueEventResponse: async (...args) => {
        subscriptions.push(args);
        return new Response("event: ready\ndata: {}\n\n", {
          headers: { "Content-Type": "text/event-stream" },
        });
      },
    },
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)(
    (name) => dependencies[name],
    module,
    module.exports,
  );
  return { GET: module.exports.GET, queries, subscriptions };
}

test("public SSE validates ticket identifiers before querying", async () => {
  for (const params of [
    { tenantCode: "INVALID", ticketId },
    { tenantCode: "ABC1234", ticketId: "invalid" },
  ]) {
    const { GET, queries, subscriptions } = loadRoute();
    const response = await GET(
      { signal: new AbortController().signal },
      { params },
    );
    assert.equal(response.status, 404);
    assert.equal(queries.length, 0);
    assert.equal(subscriptions.length, 0);
  }
});

test("missing, expired, or other-tenant tickets cannot subscribe", async () => {
  const { GET, queries, subscriptions } = loadRoute([]);
  const response = await GET(
    { signal: new AbortController().signal },
    { params: { tenantCode: "ABC1234", ticketId } },
  );
  assert.equal(response.status, 404);
  assert.match(
    queries[0].sql,
    /id = \$1 AND tenant_code = \$2 AND ticket_date = CURRENT_DATE/,
  );
  assert.equal(subscriptions.length, 0);
});

test("public SSE derives its branch from the ticket and normalizes the tenant", async () => {
  const { GET, queries, subscriptions } = loadRoute();
  const request = { signal: new AbortController().signal };
  const response = await GET(request, {
    params: { tenantCode: "abc1234", ticketId },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(queries[0].values, [ticketId, "ABC1234"]);
  assert.deepEqual(subscriptions, [[request, "branch-1"]]);
  assert.equal(await response.text(), "event: ready\ndata: {}\n\n");
});
