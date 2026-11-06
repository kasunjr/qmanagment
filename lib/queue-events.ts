import { Client } from "pg";
import { DAILY_LIMIT_CHANNEL } from "@/lib/plans";
import { BRANCH_TICKETS_CHANNEL } from "@/lib/tickets";

const encoder = new TextEncoder();

export async function createQueueEventResponse(
  request: { signal: AbortSignal },
  branchId: string,
  tenantCode?: string,
): Promise<Response> {
  let connectionString =
    process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  if (!process.env.DIRECT_DATABASE_URL && connectionString) {
    const databaseUrl = new URL(connectionString);
    if (databaseUrl.hostname.endsWith(".neon.tech")) {
      databaseUrl.hostname = databaseUrl.hostname.replace(/-pooler(?=\.)/, "");
      connectionString = databaseUrl.toString();
    }
  }
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 5_000,
  });
  try {
    await client.connect();
    await client.query(`LISTEN ${BRANCH_TICKETS_CHANNEL}`);
    if (tenantCode) await client.query(`LISTEN ${DAILY_LIMIT_CHANNEL}`);
  } catch (error) {
    await client.end().catch(() => {});
    console.error("Queue event subscription failed:", error);
    return new Response("Unable to subscribe to queue events.", {
      status: 500,
    });
  }

  let streamController: ReadableStreamDefaultController<Uint8Array> | null =
    null;
  let closed = false;
  const heartbeat = setInterval(() => {
    if (!closed) {
      try {
        streamController?.enqueue(encoder.encode(": keepalive\n\n"));
      } catch {
        void close();
      }
    }
  }, 25_000);

  const close = async () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    request.signal.removeEventListener("abort", onAbort);
    client.off("notification", onNotification);
    client.off("error", onError);
    client.off("end", onEnd);
    await client.end().catch(() => {});
  };
  const onAbort = () => void close();
  const onNotification = (notification: {
    channel?: string;
    payload?: string;
  }) => {
    let event: string;
    if (
      notification.channel === BRANCH_TICKETS_CHANNEL &&
      notification.payload === branchId
    ) {
      event = "tickets-updated";
    } else if (
      tenantCode &&
      notification.channel === DAILY_LIMIT_CHANNEL &&
      notification.payload === tenantCode
    ) {
      event = "daily-limit-changed";
    } else {
      return;
    }
    try {
      streamController?.enqueue(
        encoder.encode(`event: ${event}\ndata: {}\n\n`),
      );
    } catch {
      void close();
    }
  };
  const onError = (error: Error) => {
    console.error("Queue event stream failed:", error);
    try {
      streamController?.error(error);
    } catch {}
    void close();
  };
  const onEnd = () => {
    try {
      streamController?.close();
    } catch {}
    void close();
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller;
      client.on("notification", onNotification);
      client.on("error", onError);
      client.on("end", onEnd);
      request.signal.addEventListener("abort", onAbort, { once: true });
      controller.enqueue(encoder.encode("event: ready\ndata: {}\n\n"));
      if (request.signal.aborted) onEnd();
    },
    cancel() {
      void close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
