import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

test("customer tickets refresh on SSE events and reconnects, and stop after completion", async () => {
  const source = readFileSync(
    new URL("../app/customer/[tenantCode]/page.tsx", import.meta.url),
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const state = [];
  const effects = [];
  let hookIndex = 0;
  let currentTicket = { id: "ticket-1", status: "waiting", people_ahead: 2 };
  const storage = new Map([
    ["qms_ticket_ABC1234", JSON.stringify(currentTicket)],
  ]);
  const streams = [];
  let intervalCleared = false;
  let refreshCount = 0;
  let pendingResponse = null;
  const dependencies = {
    react: {
      useState(initial) {
        const index = hookIndex++;
        if (!(index in state)) state[index] = initial;
        return [
          state[index],
          (value) => {
            state[index] =
              typeof value === "function" ? value(state[index]) : value;
          },
        ];
      },
      useEffect(effect, deps) {
        const index = hookIndex++;
        const previous = effects[index];
        if (
          !previous ||
          deps.some(
            (value, dependencyIndex) =>
              value !== previous.deps[dependencyIndex],
          )
        ) {
          previous?.cleanup?.();
          effects[index] = { deps, pending: effect };
        }
      },
    },
    "react/jsx-runtime": { jsx: () => null, jsxs: () => null },
    "lucide-react": {},
    "@/lib/theme-style": { DEFAULT_APP_THEME: {}, themeStyle: () => ({}) },
  };
  class EventSource {
    constructor(url) {
      this.url = url;
      this.listeners = {};
      this.closed = false;
      streams.push(this);
    }
    addEventListener(name, listener) {
      this.listeners[name] = listener;
    }
    close() {
      this.closed = true;
    }
  }
  const window = {
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
    setInterval: () => 1,
    clearInterval: () => {
      intervalCleared = true;
    },
  };
  const fetch = async (url) => {
    if (url.endsWith("/tickets/ticket-1")) {
      refreshCount++;
      if (pendingResponse) {
        const response = pendingResponse;
        pendingResponse = null;
        return response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ ticket: currentTicket }),
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ branches: [], services: [] }),
    };
  };
  const module = { exports: {} };
  new Function(
    "require",
    "module",
    "exports",
    "window",
    "document",
    "EventSource",
    "fetch",
    compiled,
  )(
    (name) => dependencies[name],
    module,
    module.exports,
    window,
    { body: { style: {} } },
    EventSource,
    fetch,
  );
  const render = () => {
    hookIndex = 0;
    module.exports.default({ params: { tenantCode: "ABC1234" } });
    for (const effect of effects) {
      if (effect?.pending) {
        const pending = effect.pending;
        delete effect.pending;
        effect.cleanup = pending();
      }
    }
  };
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  try {
    render();
    render();
    await settle();
    assert.equal(streams.length, 1);
    assert.equal(streams[0].url, "/api/public/ABC1234/tickets/ticket-1/events");
    let resolveResponse;
    pendingResponse = new Promise((resolve) => {
      resolveResponse = resolve;
    });
    const olderTicket = { ...currentTicket };
    const inFlight = streams[0].listeners.open();
    currentTicket = {
      ...currentTicket,
      status: "serving",
      counter_name: "Counter 2",
      people_ahead: 0,
    };
    await streams[0].listeners["tickets-updated"]();
    resolveResponse({
      ok: true,
      status: 200,
      json: async () => ({ ticket: olderTicket }),
    });
    await inFlight;
    await settle();
    assert.equal(
      JSON.parse(storage.get("qms_ticket_ABC1234")).counter_name,
      "Counter 2",
    );
    const beforeReconnect = refreshCount;
    await streams[0].listeners.open();
    assert.equal(refreshCount, beforeReconnect + 1);
    currentTicket = { ...currentTicket, status: "completed" };
    await streams[0].listeners["tickets-updated"]();
    assert.equal(storage.has("qms_ticket_ABC1234"), false);
    render();
    assert.equal(streams[0].closed, true);
    assert.equal(intervalCleared, true);
  } finally {
    for (const effect of effects) effect?.cleanup?.();
  }
});
