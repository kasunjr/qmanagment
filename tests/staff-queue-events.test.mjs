import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const source = readFileSync(
  new URL("../app/api/staff/queue/events/route.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const sharedSource = readFileSync(
  new URL("../lib/queue-events.ts", import.meta.url),
  "utf8",
);
const sharedCompiled = ts.transpileModule(sharedSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;

function loadRoute(
  staffUser = { branch_id: "branch-1", tenant_code: "tenant-1" },
) {
  const clients = [];
  class Client extends EventEmitter {
    constructor(config) {
      super();
      this.config = config;
      this.queries = [];
      this.ended = false;
      clients.push(this);
    }
    async connect() {}
    async query(sql) {
      this.queries.push(sql);
    }
    async end() {
      this.ended = true;
    }
  }
  const dependencies = {
    pg: { Client },
    "@/lib/staff-auth": { authenticateStaffRequest: async () => staffUser },
    "@/lib/plans": { DAILY_LIMIT_CHANNEL: "daily_ticket_limit_changed" },
    "@/lib/tickets": { BRANCH_TICKETS_CHANNEL: "branch_tickets_changed" },
  };
  const sharedModule = { exports: {} };
  new Function("require", "module", "exports", sharedCompiled)(
    (name) => dependencies[name],
    sharedModule,
    sharedModule.exports,
  );
  dependencies["@/lib/queue-events"] = sharedModule.exports;
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)(
    (name) => {
      assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
    module,
    module.exports,
  );
  return { GET: module.exports.GET, clients };
}

test("staff queue SSE", async (suite) => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalDirectUrl = process.env.DIRECT_DATABASE_URL;
  suite.after(() => {
    for (const [key, value] of [
      ["DATABASE_URL", originalDatabaseUrl],
      ["DIRECT_DATABASE_URL", originalDirectUrl],
    ]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  for (const config of [
    {
      name: "Neon pooler uses the direct host",
      database:
        "postgresql://user:pass@ep-example-pooler.region.aws.neon.tech/db?sslmode=require",
      direct: "",
      expected:
        "postgresql://user:pass@ep-example.region.aws.neon.tech/db?sslmode=require",
    },
    {
      name: "explicit direct URL takes precedence",
      database: "postgresql://user:pass@pooler.example/db",
      direct: "postgresql://user:pass@direct.example/db",
      expected: "postgresql://user:pass@direct.example/db",
    },
    {
      name: "regular PostgreSQL URL is unchanged",
      database: "postgresql://user:pass@localhost:5432/db",
      direct: "",
      expected: "postgresql://user:pass@localhost:5432/db",
    },
  ]) {
    await suite.test(config.name, async () => {
      process.env.DATABASE_URL = config.database;
      process.env.DIRECT_DATABASE_URL = config.direct;
      const { GET, clients } = loadRoute();
      const response = await GET({ signal: new AbortController().signal });
      try {
        assert.equal(response.status, 200);
        assert.equal(clients[0].config.connectionString, config.expected);
        assert.equal(clients[0].config.connectionTimeoutMillis, 5000);
        assert.deepEqual(clients[0].queries, [
          "LISTEN branch_tickets_changed",
          "LISTEN daily_ticket_limit_changed",
        ]);
      } finally {
        await response.body.cancel();
      }
      assert.equal(clients[0].ended, true);
    });
  }

  await suite.test(
    "notifications are scoped and emitted as named SSE events",
    async () => {
      const { GET, clients } = loadRoute();
      const response = await GET({ signal: new AbortController().signal });
      const reader = response.body.getReader();
      const readEvent = async () =>
        new TextDecoder().decode((await reader.read()).value);
      try {
        assert.match(
          response.headers.get("content-type"),
          /text\/event-stream/,
        );
        assert.equal(response.headers.get("X-Accel-Buffering"), "no");
        assert.equal(await readEvent(), "event: ready\ndata: {}\n\n");
        clients[0].emit("notification", {
          channel: "branch_tickets_changed",
          payload: "other-branch",
        });
        clients[0].emit("notification", {
          channel: "daily_ticket_limit_changed",
          payload: "other-tenant",
        });
        clients[0].emit("notification", {
          channel: "branch_tickets_changed",
          payload: "branch-1",
        });
        assert.equal(await readEvent(), "event: tickets-updated\ndata: {}\n\n");
        clients[0].emit("notification", {
          channel: "daily_ticket_limit_changed",
          payload: "tenant-1",
        });
        assert.equal(
          await readEvent(),
          "event: daily-limit-changed\ndata: {}\n\n",
        );
      } finally {
        await reader.cancel();
      }
      assert.equal(clients[0].listenerCount("notification"), 0);
      assert.equal(clients[0].ended, true);
    },
  );

  await suite.test(
    "unauthenticated requests never open a database connection",
    async () => {
      const { GET, clients } = loadRoute(null);
      const response = await GET({ signal: new AbortController().signal });
      assert.equal(response.status, 401);
      assert.equal(clients.length, 0);
    },
  );

  await suite.test(
    "staff without a branch do not open an event stream",
    async () => {
      const { GET, clients } = loadRoute({ branch_id: null });
      const response = await GET({ signal: new AbortController().signal });
      assert.equal(response.status, 204);
      assert.equal(clients.length, 0);
    },
  );
});
